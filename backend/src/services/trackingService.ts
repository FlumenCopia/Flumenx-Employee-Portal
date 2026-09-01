import mongoose from 'mongoose';
import * as turf from '@turf/turf';
import { Employee, IEmployee } from '../models/Employee.js';
import { TrackingSession, ITrackingSession, ITrackingLocationPoint } from '../models/TrackingSession.js';
import { LocationHistory, ILocationHistory } from '../models/LocationHistory.js';

export interface LocationInput {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  timestamp?: string | number | Date;
  batteryLevel?: number;
}

export interface DailySummaryResult {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  avatar: string;
  date: string;
  trackingStarted: Date | null;
  trackingEnded: Date | null;
  trackingDurationSeconds: number;
  totalDistanceKm: number;
  totalPoints: number;
  firstKnownLocation: ITrackingLocationPoint | null;
  lastKnownLocation: ITrackingLocationPoint | null;
  movementTimeSeconds: number;
  stationaryTimeSeconds: number;
  longestStationaryPeriod: {
    startedAt: Date | null;
    endedAt: Date | null;
    durationSeconds: number;
    latitude: number | null;
    longitude: number | null;
  } | null;
}

export class TrackingService {
  /**
   * Validate coordinate bounds
   */
  public static isValidCoordinate(latitude: number, longitude: number): boolean {
    return (
      typeof latitude === 'number' &&
      !isNaN(latitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      typeof longitude === 'number' &&
      !isNaN(longitude) &&
      longitude >= -180 &&
      longitude <= 180
    );
  }

  /**
   * Calculate distance between two GPS coordinates using Turf.js in kilometers
   */
  public static calculateDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    try {
      const from = turf.point([lon1, lat1]);
      const to = turf.point([lon2, lat2]);
      const dist = turf.distance(from, to, { units: 'kilometers' });
      return isNaN(dist) ? 0 : Number(dist.toFixed(4));
    } catch {
      return 0;
    }
  }

  /**
   * Verify if movement is physically realistic (reject outlier teleportation GPS jumps)
   */
  public static isValidMovement(
    prev: { latitude: number; longitude: number; timestamp: Date; accuracy?: number },
    curr: { latitude: number; longitude: number; timestamp: Date; accuracy?: number },
    maxSpeedKmh = 180,
    maxAccuracyMeters = 150
  ): boolean {
    if ((curr.accuracy && curr.accuracy > maxAccuracyMeters) || (prev.accuracy && prev.accuracy > maxAccuracyMeters)) {
      // Unreliable GPS fix
      return false;
    }

    const distKm = this.calculateDistanceKm(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    const elapsedSec = Math.max(1, (new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 1000);
    const speedKmh = (distKm / elapsedSec) * 3600;

    // Reject impossible speed jumps
    if (speedKmh > maxSpeedKmh) {
      return false;
    }

    return true;
  }

  /**
   * Start a tracking session (GO ONLINE)
   */
  public static async startSession(
    employeeId: string | mongoose.Types.ObjectId,
    userId?: string | mongoose.Types.ObjectId,
    initialLocation?: LocationInput,
    deviceInfo?: string
  ): Promise<{ session: ITrackingSession; employee: IEmployee }> {
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      throw new Error('Employee not found');
    }

    // Close any previous ACTIVE sessions as INTERRUPTED
    const previousActiveSessions = await TrackingSession.find({
      employee: employee._id,
      status: 'ACTIVE',
    });

    for (const oldSession of previousActiveSessions) {
      oldSession.status = 'INTERRUPTED';
      oldSession.endedAt = new Date();
      oldSession.interruptedReason = 'New session started';
      await oldSession.save();
    }

    const now = new Date();
    let startLoc: ITrackingLocationPoint | null = null;

    if (
      initialLocation &&
      this.isValidCoordinate(initialLocation.latitude, initialLocation.longitude)
    ) {
      startLoc = {
        latitude: initialLocation.latitude,
        longitude: initialLocation.longitude,
        accuracy: initialLocation.accuracy || 0,
        timestamp: now,
      };
    }

    const newSession = await TrackingSession.create({
      employee: employee._id,
      user: userId || employee.user || null,
      startedAt: now,
      startLocation: startLoc,
      endLocation: startLoc,
      totalDistance: 0,
      totalDuration: 0,
      status: 'ACTIVE',
      deviceInfo: deviceInfo || '',
    });

    employee.trackingStatus = 'ONLINE';
    employee.activeTrackingSession = newSession._id as any;
    employee.trackingStartedAt = now;
    employee.lastLocationAt = startLoc ? now : null;
    if (startLoc) {
      employee.currentLocation = {
        latitude: startLoc.latitude,
        longitude: startLoc.longitude,
        accuracy: startLoc.accuracy || 0,
        speed: initialLocation?.speed || 0,
        heading: initialLocation?.heading || 0,
        timestamp: now,
        batteryLevel: initialLocation?.batteryLevel,
      };

      // Record first location point in history
      await LocationHistory.create({
        employee: employee._id,
        user: userId || employee.user || null,
        session: newSession._id,
        latitude: startLoc.latitude,
        longitude: startLoc.longitude,
        accuracy: startLoc.accuracy || 0,
        speed: initialLocation?.speed || 0,
        heading: initialLocation?.heading || 0,
        timestamp: now,
        batteryLevel: initialLocation?.batteryLevel,
        isMoving: false,
      });
    }
    await employee.save();

    return { session: newSession, employee };
  }

  /**
   * Stop a tracking session (GO OFFLINE)
   */
  public static async stopSession(
    employeeId: string | mongoose.Types.ObjectId,
    finalLocation?: LocationInput
  ): Promise<{ session: ITrackingSession | null; employee: IEmployee }> {
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      throw new Error('Employee not found');
    }

    const now = new Date();
    let session = await TrackingSession.findOne({
      employee: employee._id,
      status: 'ACTIVE',
    }).sort({ startedAt: -1 });

    if (session) {
      session.status = 'COMPLETED';
      session.endedAt = now;
      session.totalDuration = Math.max(0, Math.round((now.getTime() - session.startedAt.getTime()) / 1000));

      if (
        finalLocation &&
        this.isValidCoordinate(finalLocation.latitude, finalLocation.longitude)
      ) {
        session.endLocation = {
          latitude: finalLocation.latitude,
          longitude: finalLocation.longitude,
          accuracy: finalLocation.accuracy || 0,
          timestamp: now,
        };

        // If previous location exists, check distance addition
        if (employee.currentLocation) {
          const isRealistic = this.isValidMovement(
            {
              latitude: employee.currentLocation.latitude,
              longitude: employee.currentLocation.longitude,
              timestamp: employee.currentLocation.timestamp,
              accuracy: employee.currentLocation.accuracy,
            },
            {
              latitude: finalLocation.latitude,
              longitude: finalLocation.longitude,
              timestamp: now,
              accuracy: finalLocation.accuracy,
            }
          );
          if (isRealistic) {
            const addedKm = this.calculateDistanceKm(
              employee.currentLocation.latitude,
              employee.currentLocation.longitude,
              finalLocation.latitude,
              finalLocation.longitude
            );
            session.totalDistance = Number(((session.totalDistance || 0) + addedKm).toFixed(3));
          }
        }

        await LocationHistory.create({
          employee: employee._id,
          user: session.user || employee.user || null,
          session: session._id,
          latitude: finalLocation.latitude,
          longitude: finalLocation.longitude,
          accuracy: finalLocation.accuracy || 0,
          speed: finalLocation.speed || 0,
          heading: finalLocation.heading || 0,
          timestamp: now,
          batteryLevel: finalLocation.batteryLevel,
          isMoving: false,
        });
      }
      await session.save();
    }

    employee.trackingStatus = 'OFFLINE';
    employee.activeTrackingSession = null;
    if (finalLocation && this.isValidCoordinate(finalLocation.latitude, finalLocation.longitude)) {
      employee.lastLocationAt = now;
      employee.currentLocation = {
        latitude: finalLocation.latitude,
        longitude: finalLocation.longitude,
        accuracy: finalLocation.accuracy || 0,
        speed: 0,
        heading: finalLocation.heading || 0,
        timestamp: now,
        batteryLevel: finalLocation.batteryLevel,
      };
    }
    await employee.save();

    return { session, employee };
  }

  /**
   * Process a live GPS location update (called via Socket.IO or HTTP fallback)
   */
  public static async recordLocationUpdate(
    employeeId: string | mongoose.Types.ObjectId,
    loc: LocationInput
  ): Promise<{ employee: IEmployee; persisted: boolean; totalDistanceKm: number }> {
    if (!this.isValidCoordinate(loc.latitude, loc.longitude)) {
      throw new Error('Invalid coordinate values');
    }

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      throw new Error('Employee not found');
    }

    const now = loc.timestamp ? new Date(loc.timestamp) : new Date();
    const speed = loc.speed && loc.speed > 0 ? loc.speed : 0;
    const accuracy = loc.accuracy || 0;
    const heading = loc.heading || 0;
    const isMoving = speed > 1.0; // speed > 1 m/s (approx 3.6 km/h)

    // Find active session
    let session = await TrackingSession.findOne({
      employee: employee._id,
      status: 'ACTIVE',
    }).sort({ startedAt: -1 });

    // If no active session exists but employee is sending location, create one automatically
    if (!session) {
      session = await TrackingSession.create({
        employee: employee._id,
        user: employee.user || null,
        startedAt: now,
        startLocation: {
          latitude: loc.latitude,
          longitude: loc.longitude,
          accuracy,
          timestamp: now,
        },
        status: 'ACTIVE',
      });
      employee.activeTrackingSession = session._id as any;
      employee.trackingStartedAt = now;
    }

    let shouldPersistToHistory = false;
    let distanceIncrementKm = 0;

    if (!employee.currentLocation) {
      // First location point in session
      shouldPersistToHistory = true;
    } else {
      const prev = {
        latitude: employee.currentLocation.latitude,
        longitude: employee.currentLocation.longitude,
        timestamp: employee.currentLocation.timestamp,
        accuracy: employee.currentLocation.accuracy,
      };
      const curr = {
        latitude: loc.latitude,
        longitude: loc.longitude,
        timestamp: now,
        accuracy,
      };

      const distMovedKm = this.calculateDistanceKm(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
      const distMovedMeters = distMovedKm * 1000;
      const elapsedSeconds = Math.max(1, (now.getTime() - new Date(prev.timestamp).getTime()) / 1000);

      // Validate jump
      const isRealistic = this.isValidMovement(prev, curr);

      if (isRealistic) {
        // Increment distance if moved > 5 meters
        if (distMovedMeters >= 5) {
          distanceIncrementKm = distMovedKm;
        }

        // Persist condition:
        // 1. Moved more than 15 meters OR
        // 2. Elapsed time > 45 seconds (heartbeat stationary point) OR
        // 3. Significant speed state change
        if (distMovedMeters >= 15 || elapsedSeconds >= 45) {
          shouldPersistToHistory = true;
        }
      }
    }

    // Update Session aggregates
    if (distanceIncrementKm > 0) {
      session.totalDistance = Number(((session.totalDistance || 0) + distanceIncrementKm).toFixed(3));
    }
    session.totalDuration = Math.max(0, Math.round((now.getTime() - session.startedAt.getTime()) / 1000));
    session.endLocation = {
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracy,
      timestamp: now,
    };
    await session.save();

    // Persist to LocationHistory if threshold met
    if (shouldPersistToHistory) {
      await LocationHistory.create({
        employee: employee._id,
        user: employee.user || null,
        session: session._id,
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracy,
        speed,
        heading,
        timestamp: now,
        batteryLevel: loc.batteryLevel,
        isMoving,
      });
    }

    // Update current employee live state
    employee.trackingStatus = 'ONLINE';
    employee.lastLocationAt = now;
    employee.currentLocation = {
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracy,
      speed,
      heading,
      timestamp: now,
      batteryLevel: loc.batteryLevel,
    };
    await employee.save();

    return {
      employee,
      persisted: shouldPersistToHistory,
      totalDistanceKm: session.totalDistance || 0,
    };
  }

  /**
   * Process a batch of buffered offline points
   */
  public static async recordBatchLocations(
    employeeId: string | mongoose.Types.ObjectId,
    points: LocationInput[]
  ): Promise<{ insertedCount: number; totalDistanceKm: number }> {
    if (!points || points.length === 0) return { insertedCount: 0, totalDistanceKm: 0 };

    const sorted = points
      .filter((p) => this.isValidCoordinate(p.latitude, p.longitude))
      .sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());

    let inserted = 0;
    let finalDistance = 0;

    for (const pt of sorted) {
      const res = await this.recordLocationUpdate(employeeId, pt);
      if (res.persisted) inserted++;
      finalDistance = res.totalDistanceKm;
    }

    return { insertedCount: inserted, totalDistanceKm: finalDistance };
  }

  /**
   * Get all live/online employees for Admin Live Map
   */
  public static async getLiveEmployees(filter: {
    teamLeadId?: string | mongoose.Types.ObjectId;
    department?: string;
    statusFilter?: string;
  } = {}): Promise<any[]> {
    const query: any = { status: 'Active' };

    if (filter.teamLeadId) {
      query.$or = [{ teamLead: filter.teamLeadId }, { _id: filter.teamLeadId }];
    }
    if (filter.department) {
      query.department = filter.department;
    }

    const employees = await Employee.find(query)
      .select('name employeeCode department designation avatar trackingStatus trackingStartedAt lastLocationAt currentLocation teamLead')
      .populate('activeTrackingSession', 'startedAt totalDistance totalDuration status')
      .lean();

    const now = Date.now();
    const staleThresholdMs = 2 * 60 * 1000; // 2 minutes

    return employees.map((emp: any) => {
      let isStale = false;
      let effectiveStatus = emp.trackingStatus || 'OFFLINE';

      if (effectiveStatus === 'ONLINE' && emp.lastLocationAt) {
        const lastUpdatedMs = new Date(emp.lastLocationAt).getTime();
        if (now - lastUpdatedMs > staleThresholdMs) {
          isStale = true;
          effectiveStatus = 'DISCONNECTED';
        }
      }

      return {
        id: emp._id,
        _id: emp._id,
        name: emp.name,
        employeeCode: emp.employeeCode,
        department: emp.department,
        designation: emp.designation,
        avatar: emp.avatar || '',
        trackingStatus: effectiveStatus,
        isStale,
        trackingStartedAt: emp.trackingStartedAt,
        lastLocationAt: emp.lastLocationAt,
        currentLocation: emp.currentLocation || null,
        activeSession: emp.activeTrackingSession || null,
      };
    });
  }

  /**
   * Compile Daily Route as GeoJSON with Turf.js calculated metrics and stationary stops
   */
  public static async getDailyRoute(
    employeeId: string | mongoose.Types.ObjectId,
    dateStr?: string
  ): Promise<{
    routeGeoJson: any;
    summary: {
      date: string;
      totalDistanceKm: number;
      totalDurationSeconds: number;
      pointCount: number;
      startedAt: Date | null;
      endedAt: Date | null;
    };
    points: any[];
    stops: any[];
  }> {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const rawPoints = await LocationHistory.find({
      employee: employeeId,
      timestamp: { $gte: startOfDay, $lte: endOfDay },
    })
      .sort({ timestamp: 1 })
      .lean();

    if (rawPoints.length === 0) {
      return {
        routeGeoJson: {
          type: 'FeatureCollection',
          features: [],
        },
        summary: {
          date: startOfDay.toISOString().split('T')[0],
          totalDistanceKm: 0,
          totalDurationSeconds: 0,
          pointCount: 0,
          startedAt: null,
          endedAt: null,
        },
        points: [],
        stops: [],
      };
    }

    // Filter valid GPS points & calculate realistic cumulative distance
    const validPoints: any[] = [];
    let cumulativeDistanceKm = 0;
    let prevValid: any = null;

    for (const pt of rawPoints) {
      if (!this.isValidCoordinate(pt.latitude, pt.longitude)) continue;

      if (!prevValid) {
        validPoints.push(pt);
        prevValid = pt;
      } else {
        const isRealistic = this.isValidMovement(
          {
            latitude: prevValid.latitude,
            longitude: prevValid.longitude,
            timestamp: prevValid.timestamp,
            accuracy: prevValid.accuracy,
          },
          {
            latitude: pt.latitude,
            longitude: pt.longitude,
            timestamp: pt.timestamp,
            accuracy: pt.accuracy,
          }
        );

        if (isRealistic) {
          const distKm = this.calculateDistanceKm(
            prevValid.latitude,
            prevValid.longitude,
            pt.latitude,
            pt.longitude
          );
          cumulativeDistanceKm += distKm;
          validPoints.push(pt);
          prevValid = pt;
        }
      }
    }

    // Detect stationary stops (where position stays within 25m for >= 5 minutes)
    const stops: any[] = [];
    let stopStart: any = null;
    let stopLast: any = null;

    for (let i = 0; i < validPoints.length; i++) {
      const pt = validPoints[i];
      if (!stopStart) {
        stopStart = pt;
        stopLast = pt;
        continue;
      }

      const distFromStartKm = this.calculateDistanceKm(
        stopStart.latitude,
        stopStart.longitude,
        pt.latitude,
        pt.longitude
      );

      if (distFromStartKm * 1000 <= 30) {
        stopLast = pt;
      } else {
        const stopDurationSec = (new Date(stopLast.timestamp).getTime() - new Date(stopStart.timestamp).getTime()) / 1000;
        if (stopDurationSec >= 300) { // >= 5 minutes
          stops.push({
            latitude: stopStart.latitude,
            longitude: stopStart.longitude,
            startedAt: stopStart.timestamp,
            endedAt: stopLast.timestamp,
            durationSeconds: stopDurationSec,
          });
        }
        stopStart = pt;
        stopLast = pt;
      }
    }

    // Check trailing stop
    if (stopStart && stopLast) {
      const trailingSec = (new Date(stopLast.timestamp).getTime() - new Date(stopStart.timestamp).getTime()) / 1000;
      if (trailingSec >= 300) {
        stops.push({
          latitude: stopStart.latitude,
          longitude: stopStart.longitude,
          startedAt: stopStart.timestamp,
          endedAt: stopLast.timestamp,
          durationSeconds: trailingSec,
        });
      }
    }

    const firstPt = validPoints[0];
    const lastPt = validPoints[validPoints.length - 1];
    const totalDurationSeconds =
      firstPt && lastPt
        ? Math.max(0, Math.round((new Date(lastPt.timestamp).getTime() - new Date(firstPt.timestamp).getTime()) / 1000))
        : 0;

    // Construct GeoJSON
    const features: any[] = [];

    if (validPoints.length >= 2) {
      const coordinates = validPoints.map((p) => [p.longitude, p.latitude]);
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates,
        },
        properties: {
          name: 'Daily Route',
          distanceKm: Number(cumulativeDistanceKm.toFixed(3)),
          pointCount: validPoints.length,
        },
      });
    }

    // Start point feature
    if (firstPt) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [firstPt.longitude, firstPt.latitude],
        },
        properties: {
          pointType: 'START',
          title: 'Start Location',
          timestamp: firstPt.timestamp,
        },
      });
    }

    // End point feature
    if (lastPt && (lastPt.latitude !== firstPt?.latitude || lastPt.longitude !== firstPt?.longitude)) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lastPt.longitude, lastPt.latitude],
        },
        properties: {
          pointType: 'END',
          title: 'Last Location',
          timestamp: lastPt.timestamp,
        },
      });
    }

    // Stationary stops features
    for (let i = 0; i < stops.length; i++) {
      const st = stops[i];
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [st.longitude, st.latitude],
        },
        properties: {
          pointType: 'STOP',
          title: `Stop #${i + 1}`,
          durationMinutes: Math.round(st.durationSeconds / 60),
          startedAt: st.startedAt,
          endedAt: st.endedAt,
        },
      });
    }

    const routeGeoJson = {
      type: 'FeatureCollection',
      features,
    };

    return {
      routeGeoJson,
      summary: {
        date: startOfDay.toISOString().split('T')[0],
        totalDistanceKm: Number(cumulativeDistanceKm.toFixed(2)),
        totalDurationSeconds,
        pointCount: validPoints.length,
        startedAt: firstPt ? firstPt.timestamp : null,
        endedAt: lastPt ? lastPt.timestamp : null,
      },
      points: validPoints,
      stops,
    };
  }

  /**
   * Calculate Daily Location Summary Analytics
   */
  public static async getDailyLocationSummary(
    employeeId: string | mongoose.Types.ObjectId,
    dateStr?: string
  ): Promise<DailySummaryResult> {
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      throw new Error('Employee not found');
    }

    const { summary, points, stops } = await this.getDailyRoute(employeeId, dateStr);

    let movementTimeSeconds = 0;
    let stationaryTimeSeconds = 0;

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const dt = Math.max(0, (new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 1000);
      const speed = curr.speed || 0;

      if (speed > 1.0 || curr.isMoving) {
        movementTimeSeconds += dt;
      } else {
        stationaryTimeSeconds += dt;
      }
    }

    // Determine longest stationary period
    let longestStop: any = null;
    for (const st of stops) {
      if (!longestStop || st.durationSeconds > longestStop.durationSeconds) {
        longestStop = st;
      }
    }

    const firstPt = points[0] || null;
    const lastPt = points[points.length - 1] || null;

    return {
      employeeId: employee._id.toString(),
      employeeName: employee.name,
      employeeCode: employee.employeeCode,
      department: employee.department,
      avatar: employee.avatar || '',
      date: summary.date,
      trackingStarted: summary.startedAt,
      trackingEnded: summary.endedAt,
      trackingDurationSeconds: summary.totalDurationSeconds,
      totalDistanceKm: summary.totalDistanceKm,
      totalPoints: summary.pointCount,
      firstKnownLocation: firstPt
        ? { latitude: firstPt.latitude, longitude: firstPt.longitude, accuracy: firstPt.accuracy, timestamp: firstPt.timestamp }
        : null,
      lastKnownLocation: lastPt
        ? { latitude: lastPt.latitude, longitude: lastPt.longitude, accuracy: lastPt.accuracy, timestamp: lastPt.timestamp }
        : null,
      movementTimeSeconds,
      stationaryTimeSeconds: Math.max(0, summary.totalDurationSeconds - movementTimeSeconds),
      longestStationaryPeriod: longestStop
        ? {
            startedAt: longestStop.startedAt,
            endedAt: longestStop.endedAt,
            durationSeconds: longestStop.durationSeconds,
            latitude: longestStop.latitude,
            longitude: longestStop.longitude,
          }
        : null,
    };
  }
}
