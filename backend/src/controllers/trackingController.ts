import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { TrackingService } from '../services/trackingService.js';
import { Employee } from '../models/Employee.js';
import { TrackingSession } from '../models/TrackingSession.js';
import { LocationHistory } from '../models/LocationHistory.js';

// Helper to determine if user can access target employee's location
async function canAccessEmployee(
  reqUser: any,
  targetEmployeeId: string | mongoose.Types.ObjectId
): Promise<{ allowed: boolean; employee: any }> {
  const targetEmployee = await Employee.findById(targetEmployeeId);
  if (!targetEmployee) {
    return { allowed: false, employee: null };
  }

  const role = (reqUser.role || '').toUpperCase();
  const isSuper = role === 'SUPER_ADMIN' || reqUser.isSuperuser;
  const isCompanyManager = role === 'ADMIN' || role === 'HR' || role === 'OPERATIONS' || role === 'OPERATIONS_HEAD';

  if (isSuper || isCompanyManager) {
    return { allowed: true, employee: targetEmployee };
  }

  const ownEmployee = await Employee.findOne({ user: reqUser._id });
  if (!ownEmployee) {
    return { allowed: false, employee: null };
  }

  // Self access
  if (ownEmployee._id.toString() === targetEmployee._id.toString()) {
    return { allowed: true, employee: targetEmployee };
  }

  // Team Lead access
  if (role === 'TEAM_LEAD' && targetEmployee.teamLead?.toString() === ownEmployee._id.toString()) {
    return { allowed: true, employee: targetEmployee };
  }

  return { allowed: false, employee: null };
}

/**
 * Helper to get current authenticated employee
 */
async function getAuthenticatedEmployee(reqUser: any): Promise<any> {
  let employee = await Employee.findOne({ user: reqUser._id });
  if (!employee && (reqUser.role === 'SUPER_ADMIN' || reqUser.isSuperuser)) {
    // If super admin has no employee doc, find or create one for tracking
    employee = await Employee.findOne({ email: reqUser.email });
  }
  return employee;
}

/**
 * POST /api/tracking/go-online
 */
export async function goOnline(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ detail: 'Authentication required.' });
      return;
    }

    const employee = await getAuthenticatedEmployee(req.user);
    if (!employee) {
      res.status(404).json({ detail: 'Employee record not found for authenticated user.' });
      return;
    }

    const { location, deviceInfo } = req.body || {};
    const result = await TrackingService.startSession(
      employee._id,
      req.user._id,
      location,
      deviceInfo
    );

    res.status(200).json({
      success: true,
      message: 'Location tracking started successfully.',
      trackingStatus: 'ONLINE',
      session: result.session,
      employee: {
        id: result.employee._id,
        trackingStatus: result.employee.trackingStatus,
        trackingStartedAt: result.employee.trackingStartedAt,
        lastLocationAt: result.employee.lastLocationAt,
        currentLocation: result.employee.currentLocation,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to start tracking session' });
  }
}

/**
 * POST /api/tracking/go-offline
 */
export async function goOffline(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ detail: 'Authentication required.' });
      return;
    }

    const employee = await getAuthenticatedEmployee(req.user);
    if (!employee) {
      res.status(404).json({ detail: 'Employee record not found for authenticated user.' });
      return;
    }

    const { location } = req.body || {};
    const result = await TrackingService.stopSession(employee._id, location);

    res.status(200).json({
      success: true,
      message: 'Location tracking stopped successfully.',
      trackingStatus: 'OFFLINE',
      session: result.session,
      employee: {
        id: result.employee._id,
        trackingStatus: result.employee.trackingStatus,
        lastLocationAt: result.employee.lastLocationAt,
        currentLocation: result.employee.currentLocation,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to stop tracking session' });
  }
}

/**
 * POST /api/tracking/location
 * Update live location or batch sync
 */
export async function recordLocation(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ detail: 'Authentication required.' });
      return;
    }

    const employee = await getAuthenticatedEmployee(req.user);
    if (!employee) {
      res.status(404).json({ detail: 'Employee record not found.' });
      return;
    }

    const { points, latitude, longitude, accuracy, speed, heading, timestamp, batteryLevel } = req.body || {};

    if (Array.isArray(points) && points.length > 0) {
      const batchRes = await TrackingService.recordBatchLocations(employee._id, points);
      res.status(200).json({
        success: true,
        batch: true,
        insertedCount: batchRes.insertedCount,
        totalDistanceKm: batchRes.totalDistanceKm,
      });
      return;
    }

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      res.status(400).json({ detail: 'Valid latitude and longitude are required.' });
      return;
    }

    const singleRes = await TrackingService.recordLocationUpdate(employee._id, {
      latitude,
      longitude,
      accuracy,
      speed,
      heading,
      timestamp,
      batteryLevel,
    });

    res.status(200).json({
      success: true,
      persisted: singleRes.persisted,
      totalDistanceKm: singleRes.totalDistanceKm,
      currentLocation: singleRes.employee.currentLocation,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to record location update' });
  }
}

/**
 * GET /api/tracking/status
 * Get current employee's tracking status and active session
 */
export async function getTrackingStatus(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ detail: 'Authentication required.' });
      return;
    }

    const employee = await getAuthenticatedEmployee(req.user);
    if (!employee) {
      res.status(404).json({ detail: 'Employee record not found.' });
      return;
    }

    const activeSession = await TrackingSession.findOne({
      employee: employee._id,
      status: 'ACTIVE',
    }).sort({ startedAt: -1 });

    // Today's summary metrics
    const todayStr = new Date().toISOString().split('T')[0];
    const todaySummary = await TrackingService.getDailyLocationSummary(employee._id, todayStr);

    res.status(200).json({
      trackingStatus: employee.trackingStatus || 'OFFLINE',
      activeSession,
      trackingStartedAt: employee.trackingStartedAt,
      lastLocationAt: employee.lastLocationAt,
      currentLocation: employee.currentLocation,
      todaySummary: {
        totalDistanceKm: todaySummary.totalDistanceKm,
        totalDurationSeconds: todaySummary.trackingDurationSeconds,
        totalPoints: todaySummary.totalPoints,
        trackingStarted: todaySummary.trackingStarted,
        trackingEnded: todaySummary.trackingEnded,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch tracking status' });
  }
}

/**
 * GET /api/tracking/live
 * Live employee tracking list for admin live map
 */
export async function getLiveTracking(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ detail: 'Authentication required.' });
      return;
    }

    const role = (req.user.role || '').toUpperCase();
    const ownEmployee = await Employee.findOne({ user: req.user._id });

    const filter: any = {};
    if (role === 'TEAM_LEAD' && ownEmployee) {
      filter.teamLeadId = ownEmployee._id;
    }
    if (req.query.department) {
      filter.department = String(req.query.department);
    }

    const employees = await TrackingService.getLiveEmployees(filter);
    const onlineCount = employees.filter((e) => e.trackingStatus === 'ONLINE').length;
    const disconnectedCount = employees.filter((e) => e.trackingStatus === 'DISCONNECTED').length;

    res.status(200).json({
      employees,
      stats: {
        totalEmployees: employees.length,
        onlineCount,
        disconnectedCount,
        offlineCount: employees.length - onlineCount - disconnectedCount,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch live employees' });
  }
}

/**
 * GET /api/tracking/route
 * Get compiled daily route & GeoJSON for an employee + date
 */
export async function getDailyRoute(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ detail: 'Authentication required.' });
      return;
    }

    let targetEmployeeId = req.query.employeeId as string;
    if (!targetEmployeeId) {
      const ownEmp = await Employee.findOne({ user: req.user._id });
      if (!ownEmp) {
        res.status(404).json({ detail: 'Employee record not found.' });
        return;
      }
      targetEmployeeId = ownEmp._id.toString();
    }

    const { allowed, employee } = await canAccessEmployee(req.user, targetEmployeeId);
    if (!allowed || !employee) {
      res.status(403).json({ detail: 'You do not have permission to view this employee route.' });
      return;
    }

    const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const routeData = await TrackingService.getDailyRoute(targetEmployeeId, dateStr);

    res.status(200).json({
      employee: {
        id: employee._id,
        name: employee.name,
        employeeCode: employee.employeeCode,
        department: employee.department,
        designation: employee.designation,
        avatar: employee.avatar || '',
      },
      ...routeData,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch daily route' });
  }
}

/**
 * GET /api/tracking/summary
 * Daily Location Summary Analytics
 */
export async function getDailySummary(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ detail: 'Authentication required.' });
      return;
    }

    let targetEmployeeId = req.query.employeeId as string;
    if (!targetEmployeeId) {
      const ownEmp = await Employee.findOne({ user: req.user._id });
      if (!ownEmp) {
        res.status(404).json({ detail: 'Employee record not found.' });
        return;
      }
      targetEmployeeId = ownEmp._id.toString();
    }

    const { allowed } = await canAccessEmployee(req.user, targetEmployeeId);
    if (!allowed) {
      res.status(403).json({ detail: 'You do not have permission to view this location summary.' });
      return;
    }

    const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const summary = await TrackingService.getDailyLocationSummary(targetEmployeeId, dateStr);

    res.status(200).json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to generate daily summary' });
  }
}

/**
 * GET /api/tracking/history
 * Raw Location History Points Table with pagination & filtering
 */
export async function getLocationHistory(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ detail: 'Authentication required.' });
      return;
    }

    let targetEmployeeId = req.query.employeeId as string;
    if (!targetEmployeeId) {
      const ownEmp = await Employee.findOne({ user: req.user._id });
      if (!ownEmp) {
        res.status(404).json({ detail: 'Employee record not found.' });
        return;
      }
      targetEmployeeId = ownEmp._id.toString();
    }

    const { allowed, employee } = await canAccessEmployee(req.user, targetEmployeeId);
    if (!allowed || !employee) {
      res.status(403).json({ detail: 'You do not have permission to view location history.' });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const skip = (page - 1) * limit;

    const query: any = { employee: targetEmployeeId };

    if (req.query.date) {
      const startOfDay = new Date(req.query.date as string);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(req.query.date as string);
      endOfDay.setHours(23, 59, 59, 999);
      query.timestamp = { $gte: startOfDay, $lte: endOfDay };
    } else if (req.query.startDate && req.query.endDate) {
      const start = new Date(req.query.startDate as string);
      start.setHours(0, 0, 0, 0);
      const end = new Date(req.query.endDate as string);
      end.setHours(23, 59, 59, 999);
      query.timestamp = { $gte: start, $lte: end };
    }

    if (req.query.sessionId) {
      query.session = req.query.sessionId;
    }

    const [results, total] = await Promise.all([
      LocationHistory.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LocationHistory.countDocuments(query),
    ]);

    res.status(200).json({
      results,
      count: total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      employee: {
        id: employee._id,
        name: employee.name,
        employeeCode: employee.employeeCode,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch location history' });
  }
}

/**
 * GET /api/tracking/sessions
 * List tracking sessions
 */
export async function getTrackingSessions(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ detail: 'Authentication required.' });
      return;
    }

    let targetEmployeeId = req.query.employeeId as string;
    if (!targetEmployeeId) {
      const ownEmp = await Employee.findOne({ user: req.user._id });
      if (!ownEmp) {
        res.status(404).json({ detail: 'Employee record not found.' });
        return;
      }
      targetEmployeeId = ownEmp._id.toString();
    }

    const { allowed } = await canAccessEmployee(req.user, targetEmployeeId);
    if (!allowed) {
      res.status(403).json({ detail: 'You do not have permission to view tracking sessions.' });
      return;
    }

    const query: any = { employee: targetEmployeeId };

    if (req.query.date) {
      const startOfDay = new Date(req.query.date as string);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(req.query.date as string);
      endOfDay.setHours(23, 59, 59, 999);
      query.startedAt = { $gte: startOfDay, $lte: endOfDay };
    }

    if (req.query.status) {
      query.status = req.query.status;
    }

    const sessions = await TrackingSession.find(query)
      .sort({ startedAt: -1 })
      .limit(100)
      .lean();

    res.status(200).json({ sessions });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch tracking sessions' });
  }
}

/**
 * GET /api/tracking/export
 * Export location history as CSV
 */
export async function exportLocationHistoryCSV(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ detail: 'Authentication required.' });
      return;
    }

    const targetEmployeeId = (req.query.employeeId as string) || (await Employee.findOne({ user: req.user._id }))?._id?.toString();
    if (!targetEmployeeId) {
      res.status(400).json({ detail: 'Employee ID is required.' });
      return;
    }

    const { allowed, employee } = await canAccessEmployee(req.user, targetEmployeeId);
    if (!allowed || !employee) {
      res.status(403).json({ detail: 'You do not have permission to export this location history.' });
      return;
    }

    const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const startOfDay = new Date(dateStr);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateStr);
    endOfDay.setHours(23, 59, 59, 999);

    const points = await LocationHistory.find({
      employee: targetEmployeeId,
      timestamp: { $gte: startOfDay, $lte: endOfDay },
    })
      .sort({ timestamp: 1 })
      .lean();

    let csv = 'Timestamp (UTC),Timestamp (IST),Latitude,Longitude,Accuracy (m),Speed (m/s),Heading (deg),Employee Code,Employee Name\n';

    for (const pt of points) {
      const utcTime = new Date(pt.timestamp).toISOString();
      const istTime = new Date(pt.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      csv += `"${utcTime}","${istTime}",${pt.latitude},${pt.longitude},${pt.accuracy || 0},${pt.speed || 0},${pt.heading || 0},"${employee.employeeCode}","${employee.name}"\n`;
    }

    const filename = `location_history_${employee.employeeCode}_${dateStr}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to export location history' });
  }
}
