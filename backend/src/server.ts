import express from 'express';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './config/env.js';
import { connectDB } from './config/db.js';
import routes from './routes/index.js';
import { verifyCsrf } from './middleware/csrf.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authenticateToken } from './middleware/auth.js';
import jwt from 'jsonwebtoken';
import { User } from './models/User.js';
import { Employee } from './models/Employee.js';
import { setupMeetingSockets } from './services/meetingSocket.js';
import { setupTrackingSockets } from './services/trackingSocket.js';
import { setupChatAndCallSockets } from './services/chatSocket.js';
import { syncDefaultPortalPages } from './services/portalSync.js';

const app = express();
const server = http.createServer(app);

// Initialize Socket.io Server for WebRTC signaling, meeting chat, presence, and live tracking
const io = new SocketIOServer(server, {
  path: '/socket.io',
  transports: ['polling', 'websocket'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  cors: {
    origin: (origin, callback) => {
      callback(null, true);
    },
    credentials: true,
  },
});

function parseSocketCookies(cookieHeader?: string): Record<string, string> {
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

// Unified Universal Socket Authentication Middleware
io.use(async (socket: any, next) => {
  try {
    console.log('[io.use Debug Handshake]', {
      auth: socket.handshake?.auth,
      query: socket.handshake?.query,
      headersAuth: socket.handshake?.headers?.authorization,
      cookie: socket.handshake?.headers?.cookie,
    });
    const cookies = parseSocketCookies(socket.handshake.headers?.cookie);
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '') ||
      cookies['flumenx_access_token'] ||
      cookies['access_token'] ||
      cookies['jwt'] ||
      socket.handshake.query?.token;

    if (token && typeof token === 'string' && token !== 'undefined' && token !== 'null') {
      const decoded: any = jwt.verify(token, config.jwtSecret);
      const userId = decoded.userId || decoded.id || decoded.sub;
      if (userId) {
        const user = await User.findById(userId).select('-password');
        if (user && user.isActive) {
          socket.user = user;
          socket.userId = user._id.toString();
          let emp = await Employee.findOne({ $or: [{ user: user._id }, { email: user.email }] });
          if (!emp && user.username) {
            emp = await Employee.findOne({ name: user.username });
          }
          socket.employee = emp;
        }
      }
    }
    console.log(`[io.use Auth] socketId: ${socket.id}, userId: ${socket.userId || 'none'}, token: ${token ? 'present' : 'none'}`);
    return next();
  } catch (err) {
    console.error('[io.use Auth Error]', err);
    return next();
  }
});

setupMeetingSockets(io);
setupTrackingSockets(io);
setupChatAndCallSockets(io);

// Handle any proxied /socket.io HTTP polling requests seamlessly
app.use((req, res, next) => {
  if (req.path.startsWith('/socket.io')) {
    (io.engine as any).handleRequest(req, res);
    return;
  }
  next();
});

// CORS configuration matching Next.js frontend requirements
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || config.corsOrigins.includes(origin) || origin.startsWith('http://localhost')) {
        callback(null, true);
      } else {
        callback(null, true); // Allow all dev origins
      }
    },
    credentials: true,
    exposedHeaders: ['Content-Disposition', 'X-CSRFToken'],
  })
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve media files statically (Avatars, documents, photos, chat attachments)
const mediaPath = path.join(process.cwd(), 'media');

const mediaFallbackMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const reqPath = req.path;
  const fullFilePath = path.join(mediaPath, reqPath);

  if (fs.existsSync(fullFilePath)) return next();

  const ext = path.extname(reqPath).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
    const basePath = fullFilePath.substring(0, fullFilePath.lastIndexOf('.'));
    const altExts = ['.webp', '.png', '.jpg', '.jpeg'].filter((e) => e !== ext);

    for (const altExt of altExts) {
      const altFile = `${basePath}${altExt}`;
      if (fs.existsSync(altFile)) {
        return res.sendFile(altFile);
      }
    }
  }
  next();
};

app.use('/media', mediaFallbackMiddleware, express.static(mediaPath));
app.use('/uploads', mediaFallbackMiddleware, express.static(mediaPath));
app.use('/uploads', express.static(path.join(mediaPath, 'chat')));
app.use('/uploads', express.static(path.join(mediaPath, 'employee_documents')));
app.use('/api/media', mediaFallbackMiddleware, express.static(mediaPath));
app.use('/api/uploads', mediaFallbackMiddleware, express.static(mediaPath));

// CSRF Verification for state-changing requests
app.use(verifyCsrf);

// Mount API routes under /api and root /
app.use('/api', routes);
app.use('/', routes);

// Global Error Handler
app.use(errorHandler);

const PORT = config.port;

async function startServer() {
  await connectDB();
  await syncDefaultPortalPages();
  server.listen(PORT, () => {
    console.log(`[Express Backend] Server running on http://127.0.0.1:${PORT}`);
    console.log(`[Express Backend] API Base URL: http://127.0.0.1:${PORT}/api`);
    console.log(`[Express Backend] Realtime Meeting WebSockets active`);
  });
}

process.on('uncaughtException', (err) => {
  console.error('[Express Backend] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Express Backend] Unhandled Rejection:', reason);
});

startServer();

export default app;
