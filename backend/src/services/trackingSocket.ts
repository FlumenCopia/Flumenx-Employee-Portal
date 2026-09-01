import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';
import { TrackingService, LocationInput } from './trackingService.js';

interface AuthenticatedTrackingSocket extends Socket {
  user?: any;
  employee?: any;
}

export function setupTrackingSockets(io: SocketIOServer) {
  // Authentication middleware for socket connections
  io.use(async (socket: AuthenticatedTrackingSocket, next) => {
    try {
      if (socket.user && socket.employee) {
        return next();
      }

      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
        socket.handshake.query?.token;

      if (token && typeof token === 'string') {
        const decoded: any = jwt.verify(token, config.jwtSecret);
        const targetId = decoded.userId || decoded.id || decoded.sub;

        if (targetId) {
          const user = await User.findById(targetId).select('-password').populate('dynamicRole');
          if (user && user.isActive) {
            socket.user = user;
            let emp = await Employee.findOne({ user: user._id });
            if (!emp && user.email) {
              emp = await Employee.findOne({ email: user.email });
            }
            socket.employee = emp;
          }
        }
      }
      return next();
    } catch (err) {
      // Continue anyway, but socket.user will be undefined
      return next();
    }
  });

  io.on('connection', (socket: AuthenticatedTrackingSocket) => {
    // 1. Subscribe to Live Tracking Room (for Admins / Managers / Team Leads)
    socket.on('tracking:subscribe-live', async () => {
      try {
        if (!socket.user) {
          return socket.emit('tracking:error', { message: 'Authentication required for live tracking.' });
        }

        const role = (socket.user.role || '').toUpperCase();
        const isManager =
          role === 'SUPER_ADMIN' ||
          role === 'ADMIN' ||
          role === 'HR' ||
          role === 'OPERATIONS' ||
          role === 'OPERATIONS_HEAD' ||
          role === 'TEAM_LEAD' ||
          socket.user.isSuperuser;

        if (isManager) {
          socket.join('tracking:managers');
          // Send initial snapshot of live employees
          const employees = await TrackingService.getLiveEmployees(
            role === 'TEAM_LEAD' && socket.employee ? { teamLeadId: socket.employee._id } : {}
          );
          socket.emit('tracking:initial-state', { employees });
        }
      } catch (err: any) {
        console.error('[Socket:tracking] Error subscribing to live:', err);
      }
    });

    socket.on('tracking:unsubscribe-live', () => {
      socket.leave('tracking:managers');
    });

    // 2. Employee GO ONLINE
    socket.on('tracking:go-online', async (data: { location?: LocationInput; deviceInfo?: string }) => {
      try {
        if (!socket.user) {
          return socket.emit('tracking:error', { message: 'Authentication required.' });
        }

        let employee = socket.employee;
        if (!employee) {
          employee = await Employee.findOne({ user: socket.user._id });
          socket.employee = employee;
        }

        if (!employee) {
          return socket.emit('tracking:error', { message: 'Employee profile not found for this user account.' });
        }

        const { session, employee: updatedEmp } = await TrackingService.startSession(
          employee._id,
          socket.user._id,
          data?.location,
          data?.deviceInfo
        );

        socket.join(`tracking:employee:${employee._id}`);

        // Acknowledge to employee device
        socket.emit('tracking:status-update', {
          trackingStatus: 'ONLINE',
          sessionId: session._id,
          startedAt: session.startedAt,
          currentLocation: updatedEmp.currentLocation,
        });

        // Broadcast to live managers room
        io.to('tracking:managers').emit('tracking:employee-updated', {
          id: employee._id,
          _id: employee._id,
          name: employee.name,
          employeeCode: employee.employeeCode,
          department: employee.department,
          designation: employee.designation,
          avatar: employee.avatar || '',
          trackingStatus: 'ONLINE',
          isStale: false,
          trackingStartedAt: session.startedAt,
          lastLocationAt: updatedEmp.lastLocationAt,
          currentLocation: updatedEmp.currentLocation,
          totalDistanceKm: session.totalDistance || 0,
        });
      } catch (err: any) {
        console.error('[Socket:tracking] Error in go-online:', err);
        socket.emit('tracking:error', { message: err.message || 'Failed to start tracking session.' });
      }
    });

    // 3. Employee Location Update (Live GPS Tick)
    socket.on('tracking:location-update', async (loc: LocationInput) => {
      try {
        if (!socket.user) return;

        let employee = socket.employee;
        if (!employee) {
          employee = await Employee.findOne({ user: socket.user._id });
          socket.employee = employee;
        }

        if (!employee || !loc) return;

        if (!TrackingService.isValidCoordinate(loc.latitude, loc.longitude)) {
          return socket.emit('tracking:location-error', { message: 'Invalid GPS coordinates received.' });
        }

        const result = await TrackingService.recordLocationUpdate(employee._id, loc);

        // Acknowledge location recorded to employee
        socket.emit('tracking:location-ack', {
          timestamp: loc.timestamp || Date.now(),
          totalDistanceKm: result.totalDistanceKm,
          persisted: result.persisted,
        });

        // Broadcast real-time marker update to managers
        io.to('tracking:managers').emit('tracking:employee-updated', {
          id: employee._id,
          _id: employee._id,
          name: employee.name,
          employeeCode: employee.employeeCode,
          department: employee.department,
          designation: employee.designation,
          avatar: employee.avatar || '',
          trackingStatus: 'ONLINE',
          isStale: false,
          trackingStartedAt: result.employee.trackingStartedAt,
          lastLocationAt: result.employee.lastLocationAt,
          currentLocation: result.employee.currentLocation,
          totalDistanceKm: result.totalDistanceKm,
        });
      } catch (err: any) {
        console.error('[Socket:tracking] Error in location-update:', err);
        socket.emit('tracking:location-error', { message: err.message });
      }
    });

    // 4. Employee Batch Location Sync (Restored from offline queue)
    socket.on('tracking:sync-batch', async (data: { points: LocationInput[] }) => {
      try {
        if (!socket.user) return;
        const employee = socket.employee || (await Employee.findOne({ user: socket.user._id }));
        if (!employee || !data?.points) return;

        const res = await TrackingService.recordBatchLocations(employee._id, data.points);
        socket.emit('tracking:batch-synced', {
          count: res.insertedCount,
          totalDistanceKm: res.totalDistanceKm,
        });

        // Also broadcast update to managers
        const updatedEmp = await Employee.findById(employee._id);
        if (updatedEmp) {
          io.to('tracking:managers').emit('tracking:employee-updated', {
            id: employee._id,
            _id: employee._id,
            name: employee.name,
            employeeCode: employee.employeeCode,
            department: employee.department,
            designation: employee.designation,
            avatar: employee.avatar || '',
            trackingStatus: updatedEmp.trackingStatus,
            lastLocationAt: updatedEmp.lastLocationAt,
            currentLocation: updatedEmp.currentLocation,
            totalDistanceKm: res.totalDistanceKm,
          });
        }
      } catch (err: any) {
        console.error('[Socket:tracking] Error in sync-batch:', err);
      }
    });

    // 5. Employee GO OFFLINE
    socket.on('tracking:go-offline', async (data?: { location?: LocationInput }) => {
      try {
        if (!socket.user) return;

        let employee = socket.employee;
        if (!employee) {
          employee = await Employee.findOne({ user: socket.user._id });
          socket.employee = employee;
        }

        if (!employee) return;

        const { session, employee: updatedEmp } = await TrackingService.stopSession(
          employee._id,
          data?.location
        );

        socket.leave(`tracking:employee:${employee._id}`);

        socket.emit('tracking:status-update', {
          trackingStatus: 'OFFLINE',
          endedSession: session,
          currentLocation: updatedEmp.currentLocation,
        });

        io.to('tracking:managers').emit('tracking:employee-updated', {
          id: employee._id,
          _id: employee._id,
          name: employee.name,
          employeeCode: employee.employeeCode,
          department: employee.department,
          designation: employee.designation,
          avatar: employee.avatar || '',
          trackingStatus: 'OFFLINE',
          isStale: false,
          trackingStartedAt: null,
          lastLocationAt: updatedEmp.lastLocationAt,
          currentLocation: updatedEmp.currentLocation,
          totalDistanceKm: session?.totalDistance || 0,
        });
      } catch (err: any) {
        console.error('[Socket:tracking] Error in go-offline:', err);
        socket.emit('tracking:error', { message: err.message || 'Failed to stop tracking session.' });
      }
    });

    // 6. Handle client-side GPS errors & permission denial
    socket.on('tracking:location-error', async (errData: { message: string; code?: number }) => {
      if (socket.employee) {
        io.to('tracking:managers').emit('tracking:employee-error', {
          employeeId: socket.employee._id,
          employeeName: socket.employee.name,
          error: errData.message,
        });
      }
    });

    socket.on('tracking:permission-denied', async () => {
      if (socket.employee) {
        io.to('tracking:managers').emit('tracking:employee-error', {
          employeeId: socket.employee._id,
          employeeName: socket.employee.name,
          error: 'Location permission was denied on employee device.',
        });
      }
    });

    // 7. Socket Disconnect
    socket.on('disconnect', async () => {
      try {
        if (socket.employee && socket.employee.trackingStatus === 'ONLINE') {
          // Notify managers that this employee might have connection trouble
          io.to('tracking:managers').emit('tracking:employee-updated', {
            id: socket.employee._id,
            _id: socket.employee._id,
            name: socket.employee.name,
            employeeCode: socket.employee.employeeCode,
            department: socket.employee.department,
            designation: socket.employee.designation,
            avatar: socket.employee.avatar || '',
            trackingStatus: 'DISCONNECTED',
            isStale: true,
            lastLocationAt: socket.employee.lastLocationAt,
            currentLocation: socket.employee.currentLocation,
          });
        }
      } catch (err) {
        // Disconnect cleanup error
      }
    });
  });
}
