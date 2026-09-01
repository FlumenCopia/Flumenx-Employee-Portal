import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';

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

      console.log(`[Socket Presence] User Online: ${uId} (${userName}) [Total online: ${onlineUsersMap.size}]`);

      io.emit('presence:update', {
        userId: uId,
        status: 'online',
        onlineUserIds: getOnlineUserIds(),
      });

      socket.emit('presence:registered', { userId: uId });
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
    socket.on('chat:join-conversation', (data: { conversationId: string }) => {
      if (data?.conversationId) {
        socket.join(`conversation:${data.conversationId}`);
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

    // =========================================================================
    // 3. 1-TO-1 AUDIO / VIDEO CALL SIGNALING (WebRTC)
    // =========================================================================
    socket.on('call:start', async (data: {
      toUserId: string;
      callType: 'audio' | 'video';
      sdpOffer?: any;
      conversationId?: string;
    }) => {
      const { toUserId, callType, sdpOffer, conversationId } = data;
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

      const targetSockets = onlineUsersMap.get(String(toUserId));
      if (!targetSockets || targetSockets.size === 0) {
        return socket.emit('call:unavailable', {
          toUserId,
          message: 'The recipient is currently offline.',
        });
      }

      // Forward incoming call invitation to all sockets of target user
      io.to(`user:${toUserId}`).emit('call:incoming', {
        fromUserId: uId,
        fromSocketId: socket.id,
        callerName,
        callerAvatar,
        callType,
        sdpOffer,
        conversationId,
      });

      socket.emit('call:ringing', { toUserId });
    });

    socket.on('call:accept', (data: {
      toSocketId: string;
      sdpAnswer?: any;
    }) => {
      const { toSocketId, sdpAnswer } = data;
      const uId = socket.userId;
      if (!toSocketId) return;

      io.to(toSocketId).emit('call:accepted', {
        fromSocketId: socket.id,
        fromUserId: uId,
        sdpAnswer,
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
      toSocketId: string;
    }) => {
      const { toSocketId } = data;
      if (toSocketId) {
        io.to(toSocketId).emit('call:ended', {
          fromSocketId: socket.id,
        });
      }
    });

    // =========================================================================
    // 4. DISCONNECTION CLEANUP
    // =========================================================================
    socket.on('disconnect', () => {
      const uId = socket.userId;
      if (uId && onlineUsersMap.has(uId)) {
        const userSockets = onlineUsersMap.get(uId)!;
        userSockets.delete(socket.id);

        if (userSockets.size === 0) {
          onlineUsersMap.delete(uId);
          console.log(`[Socket Presence] User Offline: ${uId} [Total online: ${onlineUsersMap.size}]`);
          io.emit('presence:update', {
            userId: uId,
            status: 'offline',
            onlineUserIds: getOnlineUserIds(),
          });
        }
      }
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
