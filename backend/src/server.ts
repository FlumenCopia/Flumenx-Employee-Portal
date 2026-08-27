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
import { setupMeetingSockets } from './services/meetingSocket.js';

const app = express();
const server = http.createServer(app);

// Initialize Socket.io Server for WebRTC signaling and meeting chat
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

setupMeetingSockets(io);

// Handle any proxied /socket.io HTTP polling requests seamlessly
app.use((req, res, next) => {
  if (req.path === '/socket.io' || req.originalUrl?.startsWith('/socket.io')) {
    if (!req.url.startsWith('/socket.io/')) {
      req.url = req.url.replace('/socket.io', '/socket.io/');
    }
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

// Serve media files statically (Protected by Authentication)
const mediaPath = path.join(process.cwd(), 'media');
app.use('/media', authenticateToken, express.static(mediaPath));

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
