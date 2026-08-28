import { IAttendancePolicy } from '../models/AttendancePolicy.js';
import { IAttendanceRecord } from '../models/AttendanceRecord.js';
import { timeStringToMinutes } from '../utils/tzUtils.js';

export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function calculateAttendanceRecordState(
  record: IAttendanceRecord,
  policy: IAttendancePolicy
): void {
  if (['Absent', 'Leave'].includes(record.attendanceStatus) && !record.checkInTime) {
    record.checkInStatus = '';
    record.isLate = false;
    record.isEarlyExit = false;
    record.lateMinutes = 0;
    record.earlyExitMinutes = 0;
    record.workingHours = 0;
    return;
  }

  const start = timeStringToMinutes(policy.officeStartTime || '09:30');
  const graceEnd = start + (policy.gracePeriodMinutes ?? 5); // 09:35 AM IST
  const end = timeStringToMinutes(policy.officeEndTime || '18:30');
  const earlyCutoff = timeStringToMinutes(policy.earlyCheckoutHalfDayCutoff || '18:00');
  const noonCutoff = timeStringToMinutes('12:00'); // 12:00 PM IST noon cutoff

  let isNoonArrival = false;

  if (record.checkInTime) {
    const checkIn = timeStringToMinutes(record.checkInTime);
    record.isLate = checkIn > graceEnd;
    record.lateMinutes = record.isLate ? Math.max(0, checkIn - start) : 0;
    isNoonArrival = checkIn >= noonCutoff;

    if (checkIn <= start) {
      record.checkInStatus = 'On Time';
    } else if (checkIn <= graceEnd) {
      record.checkInStatus = 'Grace Period';
    } else {
      record.checkInStatus = 'Late';
    }
  }

  let isEarlyCheckoutHalfDay = false;
  if (record.checkOutTime) {
    const checkOut = timeStringToMinutes(record.checkOutTime);
    record.isEarlyExit = checkOut < end;
    record.earlyExitMinutes = Math.max(0, end - checkOut);
    isEarlyCheckoutHalfDay = checkOut < earlyCutoff;

    if (record.checkInTime) {
      let worked = checkOut - timeStringToMinutes(record.checkInTime);
      if (worked < 0) worked += 24 * 60;
      record.workingHours = Math.round((worked / 60) * 100) / 100;
    }
  }

  if (record.checkInTime) {
    if (isNoonArrival) {
      record.attendanceStatus = 'Half Day';
    } else if (record.checkOutTime && record.workingHours < (policy.halfDayHours || 4)) {
      record.attendanceStatus = 'Half Day';
    } else if (isEarlyCheckoutHalfDay) {
      record.attendanceStatus = 'Half Day';
    } else if (record.isEarlyExit && record.isLate) {
      record.attendanceStatus = 'Present (Late + Early Exit)';
    } else if (record.isEarlyExit) {
      record.attendanceStatus = 'Present (Early Exit)';
    } else {
      record.attendanceStatus = 'Present';
    }
  }
}
