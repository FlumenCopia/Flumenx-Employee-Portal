import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';
import { ChatConversation } from '../models/ChatConversation.js';
import { ChatMessage } from '../models/ChatMessage.js';

let ioInstance: SocketIOServer | null = null;

// Track online users: userId -> Map of socketId -> SocketMetadata
export interface UserSocketMeta {
  socketId: string;
  userId: string;
  employeeId?: string;
  name: string;
  avatar?: string;
  role: string;
  department?: string;
  connectedAt: Date;
}

const onlineUsersMap: Map<string, Map<string, UserSocketMeta>> = new Map();

function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach((c) => {
    const parts = c.split('=');
    if (parts.length >= 2) {
      cookies[parts[0].trim()] = decodeURIComponent(parts.slice(1).join('=').trim());
    }
  });
  return cookies;
}

export function getSocketServer(): SocketIOServer | null {
  return ioInstance;
}

export function getOnlineUserIds(): string[] {
  return Array.from(onlineUsersMap.keys());
}

export function setupChatAndCallSockets(io: SocketIOServer) {
  ioInstance = io;

  io.on('connection', (socket: any) => {
    const registerUser = (u: any, emp: any) => {
      const uId = u._id ? u._id.toString() : String(u.id);
      socket.userId = uId;
      socket.user = u;
      socket.employee = emp;

      socket.join(`user:${uId}`);
      if (emp?._id) {
        socket.join(`employee:${emp._id.toString()}`);
        socket.join(`user:${emp._id.toString()}`);
      }

      // Auto-join all conversation rooms for this user so they receive new messages & calls on ANY page
      ChatConversation.find({
        $or: [
          { 'participants.user': uId },
          ...(emp?._id ? [{ 'participants.employee': emp._id }, { 'participants.user': emp._id }] : []),
        ],
      })
        .select('_id')
        .then((userConvs) => {
          userConvs.forEach((c) => {
            socket.join(`conversation:${c._id.toString()}`);
          });
        })
        .catch(() => {});

      const userName =
        emp?.name ||
        (u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : null) ||
        u.username ||
        'Colleague';

      const meta: UserSocketMeta = {
        socketId: socket.id,
        userId: uId,
        employeeId: emp?._id?.toString(),
        name: userName,
        avatar: u.avatar || emp?.avatar || '',
        role: u.role || 'EMPLOYEE',
        department: emp?.department || '',
        connectedAt: new Date(),
      };

      if (!onlineUsersMap.has(uId)) {
        onlineUsersMap.set(uId, new Map());
      }
      onlineUsersMap.get(uId)!.set(socket.id, meta);

      if (emp?._id) {
        const empIdStr = emp._id.toString();
        if (!onlineUsersMap.has(empIdStr)) {
          onlineUsersMap.set(empIdStr, new Map());
        }
        onlineUsersMap.get(empIdStr)!.set(socket.id, meta);
      }

      console.log(`[Socket Presence] User Online: ${uId} (${userName}) [Total online: ${onlineUsersMap.size}]`);

      io.emit('presence:update', {
        userId: uId,
        status: 'online',
        onlineUserIds: getOnlineUserIds(),
      });

      socket.emit('presence:registered', { userId: uId });
      socket.emit('presence:online-users', { onlineUserIds: getOnlineUserIds() });
    };

    if (socket.user) {
      registerUser(socket.user, socket.employee);
    }

    socket.on('presence:register', async (data: { token?: string }) => {
      try {
        const token = data?.token;
        if (token) {
          const decoded: any = jwt.verify(token, config.jwtSecret);
          const userId = decoded.userId || decoded.id || decoded.sub;
          if (userId) {
            const u = await User.findById(userId).select('-password');
            if (u) {
              const emp = await Employee.findOne({
                $or: [{ user: u._id }, { email: u.email }],
              });
              registerUser(u, emp);
              socket.emit('presence:registered', { userId: u._id.toString() });
              socket.emit('presence:online-users', { onlineUserIds: getOnlineUserIds() });
            }
          }
        }
      } catch (err) {
        console.error('Failed to register presence via token:', err);
      }
    });

    // =========================================================================
    // 1. PRESENCE SYSTEM
    // =========================================================================
    socket.on('presence:get-online-users', () => {
      socket.emit('presence:online-users', {
        onlineUserIds: getOnlineUserIds(),
      });
    });

    socket.on('presence:ping', () => {
      const uId = socket.userId;
      if (uId) {
        socket.emit('presence:pong', {
          userId: uId,
          onlineUserIds: getOnlineUserIds(),
        });
      }
    });

    // =========================================================================
    // 2. REAL-TIME TEAM CHAT ROOMS & EVENTS
    // =========================================================================
    socket.on('chat:join-conversation', async (data: { conversationId: string }) => {
      if (data?.conversationId && socket.userId) {
        try {
          const conv = await ChatConversation.findById(data.conversationId).select('participants');
          if (conv) {
            const isPart = (conv.participants || []).some(
              (p) => String((p.user as any)?._id || p.user) === String(socket.userId)
            );
            if (isPart) {
              socket.join(`conversation:${data.conversationId}`);
            }
          }
        } catch (err) {
          console.error('Error verifying chat room join:', err);
        }
      }
    });

    socket.on('chat:leave-conversation', (data: { conversationId: string }) => {
      if (data?.conversationId) {
        socket.leave(`conversation:${data.conversationId}`);
      }
    });

    socket.on('chat:typing', (data: { conversationId: string; name?: string }) => {
      const uId = socket.userId;
      const emp = socket.employee;
      const u = socket.user;
      if (data?.conversationId && uId) {
        socket.to(`conversation:${data.conversationId}`).emit('chat:typing', {
          conversationId: data.conversationId,
          userId: uId,
          name: data.name || emp?.name || u?.username || 'Someone',
        });
      }
    });

    socket.on('chat:stop-typing', (data: { conversationId: string }) => {
      const uId = socket.userId;
      if (data?.conversationId && uId) {
        socket.to(`conversation:${data.conversationId}`).emit('chat:stop-typing', {
          conversationId: data.conversationId,
          userId: uId,
        });
      }
    });

    socket.on('chat:mark-read', async (data: { conversationId: string }) => {
      const uId = socket.userId;
      if (!data?.conversationId || !uId) return;
      try {
        const now = new Date();
        await ChatConversation.updateOne(
          { _id: data.conversationId, 'participants.user': uId },
          { $set: { 'participants.$.lastReadAt': now } }
        );
        await ChatMessage.updateMany(
          {
            conversation: data.conversationId,
            sender: { $ne: uId },
            'readBy.user': { $ne: uId },
          },
          {
            $addToSet: {
              readBy: { user: uId, readAt: now },
            },
          }
        );
        io.to(`conversation:${data.conversationId}`).emit('chat:messages-read', {
          conversationId: data.conversationId,
          userId: uId,
          readAt: now.toISOString(),
        });
      } catch (err) {
        console.error('Error handling chat:mark-read:', err);
      }
    });

    // =========================================================================
    // 3. 1-TO-1 AUDIO / VIDEO CALL SIGNALING (WebRTC)
    // =========================================================================
    socket.on('call:start', async (data: {
      toUserId: string;
      callType: 'audio' | 'video';
      sdpOffer?: any;
      conversationId?: string;
      roomId?: string;
    }) => {
      const { toUserId, callType, sdpOffer, conversationId, roomId } = data;
      const uId = socket.userId;
      const u = socket.user;
      const emp = socket.employee;

      if (!toUserId || !uId) {
        return socket.emit('call:error', { message: 'Invalid call target or unauthenticated.' });
      }

      const callerName =
        emp?.name ||
        (u?.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : null) ||
        u?.username ||
        'Colleague';

      const callerAvatar = u?.avatar || emp?.avatar || '';

      let targetSockets = onlineUsersMap.get(String(toUserId));
      let resolvedUserId = String(toUserId);

      // Search by employeeId in onlineUsersMap if direct userId lookup was empty
      if (!targetSockets || targetSockets.size === 0) {
        for (const [uIdKey, userMap] of onlineUsersMap.entries()) {
          for (const meta of userMap.values()) {
            if (meta.employeeId && String(meta.employeeId) === String(toUserId)) {
              targetSockets = userMap;
              resolvedUserId = uIdKey;
              break;
            }
          }
          if (targetSockets && targetSockets.size > 0) break;
        }
      }

      // Try database lookup if target is Employee ID
      if (!targetSockets || targetSockets.size === 0) {
        try {
          const empObj = await Employee.findById(toUserId).select('user');
          if (empObj && empObj.user) {
            resolvedUserId = empObj.user.toString();
            targetSockets = onlineUsersMap.get(resolvedUserId);
          }
        } catch {
          // Ignore
        }
      }

      if (!targetSockets || targetSockets.size === 0) {
        return socket.emit('call:unavailable', {
          toUserId,
          message: 'The recipient is currently offline or unreachable.',
        });
      }

      const activeRoomId = roomId || (conversationId ? `room_${conversationId}` : `call_${uId}_${Date.now()}`);
      socket.join(`call-room:${activeRoomId}`);

      io.to(`user:${resolvedUserId}`).emit('call:incoming', {
        fromUserId: uId,
        fromSocketId: socket.id,
        callerName,
        callerAvatar,
        callType,
        sdpOffer,
        conversationId,
        roomId: activeRoomId,
      });

      socket.emit('call:ringing', { toUserId, roomId: activeRoomId });
    });

    socket.on('call:group-start', async (data: {
      conversationId: string;
      conversationName?: string;
      callType: 'audio' | 'video';
      sdpOffer?: any;
    }) => {
      const { conversationId, conversationName, callType, sdpOffer } = data;
      const uId = socket.userId;
      const u = socket.user;
      const emp = socket.employee;
      if (!conversationId || !uId) return;

      const callerName =
        emp?.name ||
        (u?.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : null) ||
        u?.username ||
        'Colleague';
      const callerAvatar = u?.avatar || emp?.avatar || '';

      const roomId = `room_${conversationId}`;
      socket.join(`call-room:${roomId}`);

      // Broadcast call:incoming directly to all member user rooms so it rings ON ANY PAGE
      ChatConversation.findById(conversationId)
        .select('participants name')
        .then((conv) => {
          if (conv && conv.participants) {
            for (const p of conv.participants) {
              const pUserId = (p as any).user ? (p as any).user.toString() : (p as any).toString();
              if (pUserId && pUserId !== uId) {
                io.to(`user:${pUserId}`).emit('call:incoming', {
                  fromUserId: uId,
                  fromSocketId: socket.id,
                  callerName: `${callerName} (${conversationName || conv.name || 'Group'})`,
                  callerAvatar,
                  callType,
                  sdpOffer: null, // mesh room: peer joins room and exchanges offers with everyone
                  conversationId,
                  roomId,
                  isGroup: true,
                });
              }
            }
          }
        })
        .catch(() => {});

      // Also broadcast to conversation room as fallback
      socket.to(`conversation:${conversationId}`).emit('call:incoming', {
        fromUserId: uId,
        fromSocketId: socket.id,
        callerName: `${callerName} (${conversationName || 'Group'})`,
        callerAvatar,
        callType,
        sdpOffer: null,
        conversationId,
        roomId,
        isGroup: true,
      });

      socket.emit('call:ringing', { conversationId, roomId });
    });

    socket.on('call:invite-user', async (data: {
      toUserId: string;
      callType: 'audio' | 'video';
      conversationId?: string;
      roomId?: string;
      sdpOffer?: any;
    }) => {
      const { toUserId, callType, sdpOffer, conversationId, roomId } = data;
      const uId = socket.userId;
      const u = socket.user;
      const emp = socket.employee;
      if (!toUserId || !uId) return;

      const callerName =
        emp?.name ||
        (u?.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : null) ||
        u?.username ||
        'Colleague';
      const callerAvatar = u?.avatar || emp?.avatar || '';

      let targetSockets = onlineUsersMap.get(String(toUserId));
      let resolvedUserId = String(toUserId);

      if (!targetSockets || targetSockets.size === 0) {
        for (const [uIdKey, userMap] of onlineUsersMap.entries()) {
          for (const meta of userMap.values()) {
            if (meta.employeeId && String(meta.employeeId) === String(toUserId)) {
              targetSockets = userMap;
              resolvedUserId = uIdKey;
              break;
            }
          }
          if (targetSockets && targetSockets.size > 0) break;
        }
      }

      if (!targetSockets || targetSockets.size === 0) {
        try {
          const empObj = await Employee.findById(toUserId).select('user');
          if (empObj && empObj.user) {
            resolvedUserId = empObj.user.toString();
            targetSockets = onlineUsersMap.get(resolvedUserId);
          }
        } catch {
          // Ignore
        }
      }

      if (!targetSockets || targetSockets.size === 0) {
        return socket.emit('call:unavailable', {
          toUserId,
          message: 'Colleague is currently offline.',
        });
      }

      const activeRoomId = roomId || (conversationId ? `room_${conversationId}` : `call_${uId}`);
      socket.join(`call-room:${activeRoomId}`);

      io.to(`user:${resolvedUserId}`).emit('call:incoming', {
        fromUserId: uId,
        fromSocketId: socket.id,
        callerName: `${callerName} (Added you to Call)`,
        callerAvatar,
        callType,
        sdpOffer: null, // mesh invite: peer joins room and exchanges offers with all peers
        conversationId,
        roomId: activeRoomId,
        isGroup: true,
      });

      socket.emit('call:invited', { toUserId, roomId: activeRoomId, status: 'calling' });
    });

    socket.on('call:accept', (data: {
      toSocketId: string;
      sdpAnswer?: any;
      roomId?: string;
    }) => {
      const { toSocketId, sdpAnswer, roomId } = data;
      const uId = socket.userId;
      if (!toSocketId) return;

      if (roomId) {
        socket.join(`call-room:${roomId}`);
      }

      io.to(toSocketId).emit('call:accepted', {
        fromSocketId: socket.id,
        fromUserId: uId,
        sdpAnswer,
        roomId,
      });
    });

    // =========================================================================
    // MULTI-PEER FULL MESH CALL SIGNALING (3+ Participants)
    // =========================================================================
    socket.on('call:join-room', (data: { roomId: string; name?: string; avatar?: string; callType?: 'audio' | 'video' }) => {
      if (!data?.roomId) return;
      const roomKey = `call-room:${data.roomId}`;
      socket.join(roomKey);
      const emp = socket.employee;
      const u = socket.user;
      const peerName = data.name || emp?.name || u?.username || 'Colleague';
      const peerAvatar = data.avatar || u?.avatar || emp?.avatar || '';

      // Announce new peer to existing room peers
      socket.to(roomKey).emit('call:peer-joined', {
        peerSocketId: socket.id,
        userId: socket.userId,
        name: peerName,
        avatar: peerAvatar,
        callType: data.callType || 'video',
      });
    });

    socket.on('call:relay-offer', (data: { toSocketId: string; sdpOffer: any; name?: string; avatar?: string; roomId?: string }) => {
      if (!data?.toSocketId) return;
      const emp = socket.employee;
      const u = socket.user;
      io.to(data.toSocketId).emit('call:relay-offer', {
        fromSocketId: socket.id,
        fromUserId: socket.userId,
        sdpOffer: data.sdpOffer,
        name: data.name || emp?.name || u?.username || 'Colleague',
        avatar: data.avatar || u?.avatar || emp?.avatar || '',
        roomId: data.roomId,
      });
    });

    socket.on('call:relay-answer', (data: { toSocketId: string; sdpAnswer: any; roomId?: string }) => {
      if (!data?.toSocketId) return;
      io.to(data.toSocketId).emit('call:relay-answer', {
        fromSocketId: socket.id,
        fromUserId: socket.userId,
        sdpAnswer: data.sdpAnswer,
        roomId: data.roomId,
      });
    });

    socket.on('call:relay-ice', (data: { toSocketId: string; candidate: any }) => {
      if (!data?.toSocketId || !data.candidate) return;
      io.to(data.toSocketId).emit('call:relay-ice', {
        fromSocketId: socket.id,
        candidate: data.candidate,
      });
    });

    socket.on('call:leave-room', (data: { roomId: string }) => {
      if (!data?.roomId) return;
      const roomKey = `call-room:${data.roomId}`;
      socket.leave(roomKey);
      socket.to(roomKey).emit('call:peer-left', {
        peerSocketId: socket.id,
        userId: socket.userId,
      });
    });

    socket.on('call:ice-candidate', (data: {
      toSocketId: string;
      candidate: any;
    }) => {
      const { toSocketId, candidate } = data;
      if (toSocketId && candidate) {
        io.to(toSocketId).emit('call:ice-candidate', {
          fromSocketId: socket.id,
          candidate,
        });
      }
    });

    socket.on('call:reject', (data: {
      toSocketId: string;
      reason?: string;
    }) => {
      const { toSocketId, reason } = data;
      if (toSocketId) {
        io.to(toSocketId).emit('call:rejected', {
          fromSocketId: socket.id,
          reason: reason || 'Call declined',
        });
      }
    });

    socket.on('call:end', (data: {
      toSocketId?: string;
      roomId?: string;
    }) => {
      const { toSocketId, roomId } = data;
      if (toSocketId) {
        io.to(toSocketId).emit('call:ended', {
          fromSocketId: socket.id,
          fromUserId: socket.userId,
          roomId,
        });
      }
      if (roomId) {
        const roomKey = `call-room:${roomId}`;
        socket.leave(roomKey);
        socket.to(roomKey).emit('call:peer-left', {
          peerSocketId: socket.id,
          userId: socket.userId,
          roomId,
        });
      }
    });

    // =========================================================================
    // 4. DISCONNECTION CLEANUP
    // =========================================================================
    socket.on('disconnect', () => {
      const uId = socket.userId;
      const empId = socket.employee?._id?.toString();

      if (uId && onlineUsersMap.has(uId)) {
        const userSockets = onlineUsersMap.get(uId)!;
        userSockets.delete(socket.id);

        if (userSockets.size === 0) {
          onlineUsersMap.delete(uId);
          console.log(`[Socket Presence] User Offline: ${uId} [Total online: ${onlineUsersMap.size}]`);
        }
      }

      if (empId && onlineUsersMap.has(empId)) {
        const empSockets = onlineUsersMap.get(empId)!;
        empSockets.delete(socket.id);
        if (empSockets.size === 0) {
          onlineUsersMap.delete(empId);
        }
      }

      io.emit('presence:update', {
        userId: uId,
        status: 'offline',
        onlineUserIds: getOnlineUserIds(),
      });
    });
  });
}

/**
 * Broadcasts newly created chat message to active conversation room & user inboxes in real-time
 */
export function broadcastChatMessage(conversationId: string, messagePayload: any, participantUserIds: string[] = []) {
  if (!ioInstance) return;

  // 1. Broadcast to open conversation room
  ioInstance.to(`conversation:${conversationId}`).emit('chat:new-message', {
    conversationId,
    message: messagePayload,
  });

  // 2. Broadcast conversation preview update to all participant private user rooms
  for (const uId of participantUserIds) {
    ioInstance.to(`user:${uId}`).emit('chat:conversation-updated', {
      conversationId,
      lastMessage: messagePayload,
    });
  }
}

/**
 * Broadcasts meeting scheduled event to all employees in real-time
 */
export function broadcastMeetingScheduled(meetingPayload: any) {
  if (!ioInstance) return;
  ioInstance.emit('meeting:scheduled', {
    meeting: meetingPayload,
  });
}
