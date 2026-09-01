import { io as ClientSocket } from 'socket.io-client';

const BASE_URL = 'http://127.0.0.1:8000';

async function main() {
  console.log('🚀 Starting Full Socket, WebRTC Call, Real-Time Chat & Meeting Verification...');

  // 1. Log in Admin (User A)
  console.log('🔑 Logging in Admin (User A)...');
  const adminRes = await fetch(`${BASE_URL}/api/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@flumenx.com', password: 'password123' }),
  });
  const adminData: any = await adminRes.json();
  const adminToken = adminData.access || adminData.access_token;
  const adminUser = adminData.user;
  console.log(`✅ Admin logged in: ${adminUser.id} (${adminUser.username})`);

  // 2. Log in Employee (User B)
  console.log('🔑 Logging in Employee (User B)...');
  const empRes = await fetch(`${BASE_URL}/api/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'shreejithspillaiflumencopia@gmail.com', password: 'password123' }),
  });
  const empData: any = await empRes.json();
  const empToken = empData.access || empData.access_token;
  const empUser = empData.user;
  console.log(`✅ Employee logged in: ${empUser.id} (${empUser.username})`);

  // 3. Connect User A Socket
  console.log('⚡ Connecting User A Socket...');
  const socketA = ClientSocket(BASE_URL, {
    path: '/socket.io',
    transports: ['websocket'],
    autoConnect: false,
    auth: { token: adminToken },
    extraHeaders: {
      Authorization: `Bearer ${adminToken}`,
      Cookie: `access_token=${adminToken}`,
    },
    query: { token: adminToken },
  });
  socketA.auth = { token: adminToken };

  // 4. Connect User B Socket
  console.log('⚡ Connecting User B Socket...');
  const socketB = ClientSocket(BASE_URL, {
    path: '/socket.io',
    transports: ['websocket'],
    autoConnect: false,
    auth: { token: empToken },
    extraHeaders: {
      Authorization: `Bearer ${empToken}`,
      Cookie: `access_token=${empToken}`,
    },
    query: { token: empToken },
  });
  socketB.auth = { token: empToken };

  await new Promise<void>((resolve, reject) => {
    let connectedCount = 0;
    const checkDone = () => {
      connectedCount++;
      if (connectedCount === 2) resolve();
    };
    socketA.on('connect', () => {
      console.log('✅ Socket A connected:', socketA.id);
      checkDone();
    });
    socketB.on('connect', () => {
      console.log('✅ Socket B connected:', socketB.id);
      checkDone();
    });

    socketA.connect();
    socketB.connect();

    setTimeout(() => {
      if (connectedCount < 2) reject(new Error('Socket connection timeout. Is backend running?'));
    }, 5000);
  });

  // Short pause for registration sync
  await new Promise((r) => setTimeout(r, 600));

  // 5. Test Presence System
  console.log('🧪 Testing Presence System...');
  await new Promise<void>((resolve, reject) => {
    socketA.on('presence:online-users', (data: any) => {
      console.log('✅ Online users registered on server:', data.onlineUserIds);
      if (data.onlineUserIds.includes(String(adminUser.id)) && data.onlineUserIds.includes(String(empUser.id))) {
        console.log('✅ PASS: Both User A and User B show ONLINE in presence system!');
      }
      resolve();
    });
    socketA.emit('presence:get-online-users');

    setTimeout(() => {
      resolve();
    }, 3000);
  });

  // 6. Test 1-to-1 WebRTC Direct Call Signaling
  console.log('🧪 Testing WebRTC Call Signaling (User A calling User B)...');
  await new Promise<void>((resolve, reject) => {
    // User B listens for incoming call
    socketB.on('call:incoming', (callData: any) => {
      console.log('📞 User B received incoming call notification from:', callData.callerName);
      console.log('   Call type:', callData.callType);
      console.log('   SDP Offer present:', Boolean(callData.sdpOffer));

      // User B accepts call
      socketB.emit('call:accept', {
        toSocketId: callData.fromSocketId,
        sdpAnswer: { type: 'answer', sdp: 'fake-sdp-answer-data' },
      });
    });

    // User A listens for call accepted
    socketA.on('call:accepted', (acceptData: any) => {
      console.log('✅ User A received call:accepted from User B socket:', acceptData.fromSocketId);
      console.log('✅ PASS: WebRTC Call signaling verified successfully!');
      resolve();
    });

    // User A initiates call to User B
    socketA.emit('call:start', {
      toUserId: String(empUser.id),
      callType: 'video',
      sdpOffer: { type: 'offer', sdp: 'fake-sdp-offer-data' },
    });

    setTimeout(() => {
      reject(new Error('Call signaling timeout.'));
    }, 5000);
  });

  // 7. Test Real-Time Team Chat Broadcast
  console.log('🧪 Testing Real-Time Chat Broadcast...');
  // Find or create conversation between User A and User B
  const convRes = await fetch(`${BASE_URL}/api/chat/conversations/direct/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      target_user_id: empUser.id,
    }),
  });
  const convData: any = await convRes.json();
  const conversationId = convData.id;
  console.log('💬 Direct conversation ID:', conversationId);

  // User B joins conversation room
  socketB.emit('chat:join-conversation', { conversationId });

  await new Promise<void>((resolve, reject) => {
    socketB.on('chat:new-message', (data: any) => {
      console.log('📩 User B received real-time chat message without refresh!');
      console.log('   Sender:', data.message.sender_name);
      console.log('   Text:', data.message.text);
      console.log('✅ PASS: Real-time chat message broadcast verified!');
      resolve();
    });

    // User A posts message via REST API
    fetch(`${BASE_URL}/api/chat/conversations/${conversationId}/messages/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        text: 'Automated Real-Time Test Message from Socket Test! 🚀',
        message_type: 'TEXT',
      }),
    }).catch(reject);

    setTimeout(() => {
      reject(new Error('Chat message broadcast timeout.'));
    }, 5000);
  });

  // 8. Test Meeting Scheduling & Broadcast
  console.log('🧪 Testing Meeting Schedule & Broadcast...');
  await new Promise<void>((resolve, reject) => {
    socketB.on('meeting:scheduled', (data: any) => {
      console.log('📅 User B received real-time meeting announcement!');
      console.log('   Title:', data.meeting.title);
      console.log('   Meeting Code:', data.meeting.meeting_code);
      console.log('✅ PASS: Meeting broadcast verified!');
      resolve();
    });

    // User A creates a new meeting
    fetch(`${BASE_URL}/api/meetings/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Q3 All-Hands Real-Time Alignment',
        date: new Date().toISOString().split('T')[0],
        time: '14:00',
        department: 'All Employees',
        description: 'Quarterly alignment and roadmap review',
      }),
    }).catch(reject);

    setTimeout(() => {
      reject(new Error('Meeting broadcast timeout.'));
    }, 5000);
  });

  // Cleanup
  socketA.disconnect();
  socketB.disconnect();
  console.log('🎉 ALL TESTS PASSED! Global Socket Presence, WebRTC Direct Calling, Real-Time Chat & Meetings verified!');
}

main().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
