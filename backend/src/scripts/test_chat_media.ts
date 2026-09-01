import fs from 'fs';
import path from 'path';

async function testChatMedia() {
  console.log('Testing Chat Media Upload & Static Serving with native fetch...');
  const API_BASE = 'http://127.0.0.1:8000/api';

  // 1. Login Super Admin
  const loginRes = await fetch(`${API_BASE}/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin@flumenx.com',
      password: 'password123',
    }),
  });
  const setCookie = loginRes.headers.get('set-cookie') || '';
  const loginData: any = await loginRes.json();
  const token = loginData.access;
  console.log('✓ Super Admin authenticated, token exists:', Boolean(token));

  // 2. Upload file via /chat/upload
  const formData = new FormData();
  const fileBlob = new Blob([Buffer.from('fake-image-png-content')], { type: 'image/png' });
  formData.append('file', fileBlob, 'sample-screenshot.png');

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (setCookie) headers['Cookie'] = setCookie;

  const uploadRes = await fetch(`${API_BASE}/chat/upload/`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const uploadData: any = await uploadRes.json();
  console.log('✓ File uploaded response:', uploadData);
  const returnedUrl = uploadData.url;

  if (!returnedUrl) {
    throw new Error('No URL in upload response: ' + JSON.stringify(uploadData));
  }

  // 3. Test retrieving the file via http://127.0.0.1:8000 + returnedUrl
  const fetchDirect = await fetch(`http://127.0.0.1:8000${returnedUrl}`);
  console.log(`✓ Direct media retrieval [${returnedUrl}] status:`, fetchDirect.status);

  // 4. Test legacy /uploads/... path
  const filename = returnedUrl.split('/').pop();
  const fetchLegacy = await fetch(`http://127.0.0.1:8000/uploads/${filename}`);
  console.log(`✓ Legacy uploads retrieval [/uploads/${filename}] status:`, fetchLegacy.status);

  if (fetchDirect.status === 200 && fetchLegacy.status === 200) {
    console.log('🎉 All Chat Media tests PASSED successfully!');
  } else {
    throw new Error(`Failed static file status (direct: ${fetchDirect.status}, legacy: ${fetchLegacy.status})`);
  }
}

testChatMedia().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
