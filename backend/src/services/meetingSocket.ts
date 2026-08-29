import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { Meeting } from '../models/Meeting.js';
import { MeetingMessage } from '../models/MeetingMessage.js';
import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';

interface AuthenticatedSocket extends Socket {
  user?: any;
}

interface RoomPeer {
  socketId: string;
  userId?: string;
  name: string;
  role: string;
  avatar?: string;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  joinedAt: Date;
}

// In-memory active meeting rooms state
const activeRooms: Map<string, Map<string, RoomPeer>> = new Map();

export function setupMeetingSockets(io: SocketIOServer) {
  // Authentication Middleware for Sockets
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
        socket.handshake.query?.token;

      if (token && typeof token === 'string') {
        const decoded: any = jwt.verify(token, config.jwtSecret);
        if (decoded && decoded.id) {
          const user = await User.findById(decoded.id).select('-password');
          if (user) {
            const emp = await Employee.findOne({ user: user._id });
            socket.user = user;
            (socket.user as any).employee = emp;
          }
        }
      }
      return next();
    } catch {
      // Allow guest / unauthenticated connection if permitted by room, but mark user as guest
      return next();
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    let currentMeetingCode: string | null = null;

    // 1. Join Meeting Room
    socket.on('join-meeting', async (data: { meetingCode: string; name?: string }) => {
      const { meetingCode, name } = data;
      if (!meetingCode) return socket.emit('error', { message: 'Meeting code is required.' });

      try {
        const meeting = await Meeting.findOne({ meetingCode });
        if (!meeting) {
          return socket.emit('meeting-error', { message: 'Meeting not found or invalid meeting link.' });
        }

        if (meeting.status === 'ENDED') {
          return socket.emit('meeting-error', { message: 'This meeting has already ended.' });
        }

        if (meeting.status === 'CANCELLED') {
          return socket.emit('meeting-error', { message: 'This meeting was cancelled by the organizer.' });
        }

        if (meeting.settings?.isLocked && String(meeting.createdBy) !== String(socket.user?._id)) {
          return socket.emit('meeting-error', { message: 'This meeting is locked by the host.' });
        }

        // Determine user identity & role
        const isHost =
          (socket.user && String(meeting.createdBy) === String(socket.user._id)) ||
          socket.user?.role === 'SUPER_ADMIN' ||
          socket.user?.isSuperuser;

        const participantName =
          socket.user?.employee?.name ||
          (socket.user?.first_name ? `${socket.user.first_name} ${socket.user.last_name || ''}`.trim() : null) ||
          socket.user?.username ||
          name ||
          'Team Member';

        const participantRole = isHost ? 'HOST' : socket.user?.role || 'PARTICIPANT';

        currentMeetingCode = meetingCode;
        socket.join(`meeting:${meetingCode}`);

        // Update DB status to LIVE if scheduled
        if (meeting.status === 'SCHEDULED') {
          meeting.status = 'LIVE';
          meeting.startedAt = meeting.startedAt || new Date();
        }

        // Add to MongoDB participants if not already registered
        const existingPart = meeting.participants.find(
          (p) => p.user && socket.user && String(p.user) === String(socket.user._id)
        );

        if (!existingPart) {
          meeting.participants.push({
            user: socket.user?._id || null,
            name: participantName,
            email: socket.user?.email || '',
            role: isHost ? 'HOST' : 'PARTICIPANT',
            joinedAt: new Date(),
          });
        }
        await meeting.save();

        // Manage In-Memory Active Room State
        if (!activeRooms.has(meetingCode)) {
          activeRooms.set(meetingCode, new Map());
        }
        const roomPeers = activeRooms.get(meetingCode)!;

        const newPeer: RoomPeer = {
          socketId: socket.id,
          userId: socket.user?._id?.toString(),
          name: participantName,
          role: participantRole,
          avatar: socket.user?.avatar || socket.user?.employee?.avatar || '',
          isAudioMuted: false,
          isVideoOff: false,
          isScreenSharing: false,
          joinedAt: new Date(),
        };

        // Send existing participants to the newcomer
        const existingPeersList = Array.from(roomPeers.values());
        socket.emit('joined-successfully', {
          meeting: {
            id: meeting._id,
            meetingCode: meeting.meetingCode,
            title: meeting.title,
            description: meeting.description,
            department: meeting.department,
            status: meeting.status,
            isHost,
            settings: meeting.settings,
          },
          self: newPeer,
          peers: existingPeersList,
        });

        // Add new peer and notify existing participants
        roomPeers.set(socket.id, newPeer);
        socket.to(`meeting:${meetingCode}`).emit('peer-joined', newPeer);
      } catch (err: any) {
        console.error('Error joining meeting:', err);
        socket.emit('meeting-error', { message: 'Failed to join meeting room.' });
      }
    });

    // 2. WebRTC Signaling: Offer
    socket.on('signal-offer', (data: { to: string; offer: any }) => {
      io.to(data.to).emit('signal-offer', {
        from: socket.id,
        offer: data.offer,
      });
    });

    // 3. WebRTC Signaling: Answer
    socket.on('signal-answer', (data: { to: string; answer: any }) => {
      io.to(data.to).emit('signal-answer', {
        from: socket.id,
        answer: data.answer,
      });
    });

    // 4. WebRTC Signaling: ICE Candidate
    socket.on('signal-ice-candidate', (data: { to: string; candidate: any }) => {
      io.to(data.to).emit('signal-ice-candidate', {
        from: socket.id,
        candidate: data.candidate,
      });
    });

    // 5. Toggle Audio / Video Media Status
    socket.on('toggle-media', (data: { meetingCode: string; isAudioMuted: boolean; isVideoOff: boolean }) => {
      const { meetingCode, isAudioMuted, isVideoOff } = data;
      const room = activeRooms.get(meetingCode);
      if (room && room.has(socket.id)) {
        const peer = room.get(socket.id)!;
        peer.isAudioMuted = isAudioMuted;
        peer.isVideoOff = isVideoOff;
        io.to(`meeting:${meetingCode}`).emit('peer-media-toggled', {
          socketId: socket.id,
          isAudioMuted,
          isVideoOff,
        });
      }
    });

    // 6. Screen Share Status Toggle
    socket.on('toggle-screen-share', (data: { meetingCode: string; isSharing: boolean }) => {
      const { meetingCode, isSharing } = data;
      const room = activeRooms.get(meetingCode);
      if (room && room.has(socket.id)) {
        const peer = room.get(socket.id)!;
        peer.isScreenSharing = isSharing;
        io.to(`meeting:${meetingCode}`).emit('peer-screen-shared', {
          socketId: socket.id,
          name: peer.name,
          isSharing,
        });
      }
    });

    // 7. In-Meeting Chat Message (Persisted)
    socket.on('send-chat-message', async (data: { meetingCode: string; text: string }) => {
      const { meetingCode, text } = data;
      if (!meetingCode || !text || !text.trim()) return;

      try {
        const room = activeRooms.get(meetingCode);
        const peer = room ? room.get(socket.id) : null;
        const senderName = peer ? peer.name : socket.user?.first_name || 'Participant';

        const meeting = await Meeting.findOne({ meetingCode });
        if (!meeting) return;

        const messageDoc = new MeetingMessage({
          meeting: meeting._id,
          meetingCode,
          sender: socket.user?._id || null,
          senderName,
          senderRole: peer?.role || 'PARTICIPANT',
          text: text.trim(),
          timestamp: new Date(),
        });
        await messageDoc.save();

        // Broadcast to everyone else in the meeting room
        socket.to(`meeting:${meetingCode}`).emit('new-chat-message', {
          id: String(messageDoc._id),
          sender_name: senderName,
          senderName: senderName,
          sender_role: messageDoc.senderRole,
          senderRole: messageDoc.senderRole,
          text: messageDoc.text,
          timestamp: messageDoc.timestamp,
          is_self: false,
          isSelf: false,
        });
      } catch (err) {
        console.error('Error saving in-meeting chat message:', err);
      }
    });

    // 8. Host Action: Mute Remote Participant
    socket.on('host-mute-peer', (data: { meetingCode: string; targetSocketId: string }) => {
      io.to(data.targetSocketId).emit('host-muted-you');
    });

    // 8b. Host Action: Turn Off Remote Camera
    socket.on('host-off-camera-peer', (data: { meetingCode: string; targetSocketId: string }) => {
      io.to(data.targetSocketId).emit('host-camera-off-you');
    });

    // 8c. Host Action: Kick Remote Participant
    socket.on('host-kick-peer', (data: { meetingCode: string; targetSocketId: string }) => {
      const { meetingCode, targetSocketId } = data;
      io.to(targetSocketId).emit('host-kicked-you');
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.leave(`meeting:${meetingCode}`);
      }
      const room = activeRooms.get(meetingCode);
      if (room && room.has(targetSocketId)) {
        const peer = room.get(targetSocketId)!;
        room.delete(targetSocketId);
        io.to(`meeting:${meetingCode}`).emit('peer-left', {
          socketId: targetSocketId,
          name: peer.name,
        });
      }
    });

    // 9. Host Action: End Meeting for All
    socket.on('host-end-meeting-all', async (data: { meetingCode: string }) => {
      const { meetingCode } = data;
      try {
        const meeting = await Meeting.findOne({ meetingCode });
        if (meeting) {
          meeting.status = 'ENDED';
          meeting.endedAt = new Date();
          await meeting.save();
        }

        io.to(`meeting:${meetingCode}`).emit('meeting-ended-by-host');
        activeRooms.delete(meetingCode);
      } catch (err) {
        console.error('Error ending meeting by host:', err);
      }
    });

    // 10. Disconnect / Leave
    const handleLeave = async () => {
      if (!currentMeetingCode) return;
      const room = activeRooms.get(currentMeetingCode);
      if (room && room.has(socket.id)) {
        const leavingPeer = room.get(socket.id)!;
        room.delete(socket.id);
        socket.to(`meeting:${currentMeetingCode}`).emit('peer-left', {
          socketId: socket.id,
          name: leavingPeer.name,
        });

        // Record leftAt timestamp in DB
        try {
          if (leavingPeer.userId) {
            await Meeting.updateOne(
              { meetingCode: currentMeetingCode, 'participants.user': leavingPeer.userId },
              { $set: { 'participants.$.leftAt': new Date() } }
            );
          }
        } catch (err) {
          console.error('Error recording leave time:', err);
        }

        // If no more participants, check room cleanup
        if (room.size === 0) {
          activeRooms.delete(currentMeetingCode);
        }
      }
      currentMeetingCode = null;
    };

    socket.on('leave-meeting', handleLeave);
    socket.on('disconnect', handleLeave);
  });
}
