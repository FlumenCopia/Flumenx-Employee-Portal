import { Request, Response } from 'express';
import { AttendanceRecord, IAttendanceRecord } from '../models/AttendanceRecord.js';
import { AttendancePolicy, IAttendancePolicy } from '../models/AttendancePolicy.js';
import { AttendanceCorrection } from '../models/AttendanceCorrection.js';
import { Employee } from '../models/Employee.js';
import { calculateAttendanceRecordState, calculateHaversineDistanceMeters } from '../services/attendanceEngine.js';

export async function getAttendancePolicy(): Promise<IAttendancePolicy> {
  let policy = await AttendancePolicy.findOne();
  if (!policy) {
    policy = new AttendancePolicy({});
    await policy.save();
  }
  return policy;
}

// --- Policy Endpoints ---
export async function getAttendancePolicyHandler(req: Request, res: Response): Promise<void> {
  const policy = await getAttendancePolicy();
  res.json(policy);
}

export async function updateAttendancePolicyHandler(req: Request, res: Response): Promise<void> {
  let policy = await getAttendancePolicy();
  Object.assign(policy, req.body);
  await policy.save();
  res.json(policy);
}

/**
 * Return current time formatted as HH:mm in IST (Asia/Kolkata)
 */
export function getISTTimeString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === 'hour')?.value || '00';
  const minute = parts.find((p) => p.type === 'minute')?.value || '00';
  return `${hour}:${minute}`;
}

/**
 * Return start and end of day in IST (Asia/Kolkata)
 */
export function getISTDateRange(date: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateStr = formatter.format(date); // YYYY-MM-DD in IST
  const startOfDay = new Date(`${dateStr}T00:00:00.000+05:30`);
  const endOfDay = new Date(`${dateStr}T23:59:59.999+05:30`);
  return { startOfDay, endOfDay, dateStr };
}

export function formatSingleRecord(r: IAttendanceRecord, emp?: any) {
  const employeeObj = emp || r.employee;
  let dateStr = '';
  if (r.attendanceDate instanceof Date) {
    dateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(r.attendanceDate);
  } else {
    dateStr = String(r.attendanceDate).split('T')[0];
  }

  return {
    id: r._id,
    employee: employeeObj ? (employeeObj._id || employeeObj) : null,
    employee_name: employeeObj && typeof employeeObj === 'object' && 'name' in employeeObj ? employeeObj.name : 'Unknown',
    employee_code: employeeObj && typeof employeeObj === 'object' && 'employeeCode' in employeeObj ? employeeObj.employeeCode : 'N/A',
    department: employeeObj && typeof employeeObj === 'object' && 'department' in employeeObj ? employeeObj.department : 'General',
    attendance_date: dateStr,
    check_in_time: r.checkInTime || null,
    check_out_time: r.checkOutTime || null,
    check_in_status: r.checkInStatus || '',
    attendance_status: r.attendanceStatus || '',
    is_late: r.isLate || false,
    late_minutes: r.lateMinutes || 0,
    is_early_exit: r.isEarlyExit || false,
    early_exit_minutes: r.earlyExitMinutes || 0,
    working_hours: r.workingHours || '0',
    source: r.source || 'QR',
    location_verified: r.locationVerified || false,
    photo: r.photo || null,
    latitude: r.latitude || null,
    longitude: r.longitude || null,
    notes: r.notes || '',
  };
}

// --- Attendance Records Endpoints ---
export async function getAttendanceRecords(req: Request, res: Response): Promise<void> {
  const { employee_id, date, month, year, status, my_attendance } = req.query;

  const filter: any = {};
  if (my_attendance === 'true' && req.user) {
    const emp = await Employee.findOne({ user: req.user._id });
    if (emp) filter.employee = emp._id;
  } else if (employee_id) {
    filter.employee = employee_id;
  }

  if (date) {
    const targetDate = new Date(date as string);
    const startDate = new Date(targetDate.setHours(0, 0, 0, 0));
    const endDate = new Date(targetDate.setHours(23, 59, 59, 999));
    filter.attendanceDate = { $gte: startDate, $lte: endDate };
  } else if (month && typeof month === 'string' && month.includes('-')) {
    const [y, m] = month.split('-').map((v) => parseInt(v, 10));
    filter.attendanceDate = {
      $gte: new Date(y, m - 1, 1),
      $lte: new Date(y, m, 0, 23, 59, 59),
    };
  } else if (month && year) {
    const m = parseInt(month as string, 10);
    const y = parseInt(year as string, 10);
    filter.attendanceDate = {
      $gte: new Date(y, m - 1, 1),
      $lte: new Date(y, m, 0, 23, 59, 59),
    };
  }
  if (status) filter.attendanceStatus = status;

  const records = await AttendanceRecord.find(filter)
    .populate('employee')
    .sort({ attendanceDate: -1 });

  const formatted = records.map((r) => formatSingleRecord(r, r.employee));

  res.json({
    count: formatted.length,
    next: null,
    previous: null,
    results: formatted,
  });
}

export async function getAttendanceSummary(req: Request, res: Response): Promise<void> {
  const { date, month, my_attendance } = req.query;

  const filter: any = {};
  if (my_attendance === 'true' && req.user) {
    const emp = await Employee.findOne({ user: req.user._id });
    if (emp) filter.employee = emp._id;
  }

  if (date) {
    const targetDate = new Date(date as string);
    const startDate = new Date(targetDate.setHours(0, 0, 0, 0));
    const endDate = new Date(targetDate.setHours(23, 59, 59, 999));
    filter.attendanceDate = { $gte: startDate, $lte: endDate };
  } else {
    const today = new Date();
    const startDate = new Date(today.setHours(0, 0, 0, 0));
    const endDate = new Date(today.setHours(23, 59, 59, 999));
    filter.attendanceDate = { $gte: startDate, $lte: endDate };
  }

  const records = await AttendanceRecord.find(filter);
  const totalEmployees = await Employee.countDocuments({ status: 'Active' });

  const present = records.filter((r) => r.attendanceStatus.startsWith('Present')).length;
  const late = records.filter((r) => r.isLate).length;
  const earlyExits = records.filter((r) => r.isEarlyExit).length;
  const absent = records.filter((r) => r.attendanceStatus === 'Absent').length;
  const halfDays = records.filter((r) => r.attendanceStatus === 'Half Day').length;
  const leave = records.filter((r) => r.attendanceStatus === 'Leave').length;

  const denominator = totalEmployees || records.length || 1;
  const pct = Math.round(((present + halfDays * 0.5) / denominator) * 100 * 10) / 10;

  res.json({
    present,
    present_today: present,
    late,
    late_arrivals: late,
    early_exits: earlyExits,
    absent,
    absent_today: absent,
    half_days: halfDays,
    leave,
    attendance_percentage: pct,
    total_employees: totalEmployees,
  });
}

export async function getMonthlyStatistics(req: Request, res: Response): Promise<void> {
  const { month, my_attendance } = req.query;

  const filter: any = {};
  if (my_attendance === 'true' && req.user) {
    const emp = await Employee.findOne({ user: req.user._id });
    if (emp) filter.employee = emp._id;
  }

  const records = await AttendanceRecord.find(filter);
  const present = records.filter((r) => r.attendanceStatus.startsWith('Present')).length;
  const late = records.filter((r) => r.isLate).length;
  const absent = records.filter((r) => r.attendanceStatus === 'Absent').length;
  const leave = records.filter((r) => r.attendanceStatus === 'Leave').length;

  res.json({
    present_count: present,
    late_count: late,
    absent_count: absent,
    leave_count: leave,
    total_records: records.length,
  });
}

export async function exportAttendanceCSV(req: Request, res: Response): Promise<void> {
  const records = await AttendanceRecord.find().populate('employee').sort({ attendanceDate: -1 });

  const rows = [
    ['Employee Code', 'Employee Name', 'Department', 'Date', 'Check-In', 'Check-Out', 'Working Hours', 'Status'],
  ];

  records.forEach((r) => {
    const emp = r.employee as any;
    rows.push([
      emp ? emp.employeeCode : 'N/A',
      emp ? emp.name : 'Unknown',
      emp ? emp.department : 'General',
      r.attendanceDate.toISOString().split('T')[0],
      r.checkInTime || '',
      r.checkOutTime || '',
      r.workingHours.toString(),
      r.attendanceStatus,
    ]);
  });

  const csvString = rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=Attendance_Export.csv');
  res.send(csvString);
}

export async function checkInAttendance(req: Request, res: Response): Promise<void> {
  const { latitude, longitude, qr_reference, source, notes } = req.body;

  if (!req.user) {
    res.status(401).json({ detail: 'Authentication required.' });
    return;
  }

  const employee = await Employee.findOne({ user: req.user._id });
  if (!employee) {
    res.status(400).json({ detail: 'No employee profile linked to user.' });
    return;
  }

  const { startOfDay, endOfDay } = getISTDateRange(new Date());

  let record = await AttendanceRecord.findOne({
    employee: employee._id,
    attendanceDate: { $gte: startOfDay, $lte: endOfDay },
  });

  const policy = await getAttendancePolicy();
  const nowStr = getISTTimeString(new Date());

  let locationVerified = false;
  let distanceMeters: number | null = null;

  if (latitude !== undefined && longitude !== undefined) {
    distanceMeters = calculateHaversineDistanceMeters(
      parseFloat(latitude),
      parseFloat(longitude),
      policy.officeLatitude,
      policy.officeLongitude
    );
    locationVerified = distanceMeters <= policy.allowedRadiusMeters;
  }

  if (!record) {
    record = new AttendanceRecord({
      employee: employee._id,
      attendanceDate: new Date(),
      checkInTime: nowStr,
      source: source || (locationVerified ? 'QR + Location' : 'QR'),
      qrReference: qr_reference || policy.activeQrReference,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      checkInDistanceMeters: distanceMeters,
      locationVerified,
      photo: req.file ? `/media/attendance_photos/${req.file.filename}` : '',
      notes: notes || '',
    });
  } else {
    record.checkInTime = nowStr;
    if (latitude !== undefined) record.latitude = parseFloat(latitude);
    if (longitude !== undefined) record.longitude = parseFloat(longitude);
    record.checkInDistanceMeters = distanceMeters;
    record.locationVerified = locationVerified;
  }

  calculateAttendanceRecordState(record, policy);
  await record.save();
  res.json(formatSingleRecord(record, employee));
}

export async function checkOutAttendance(req: Request, res: Response): Promise<void> {
  const { latitude, longitude } = req.body;

  if (!req.user) {
    res.status(401).json({ detail: 'Authentication required.' });
    return;
  }

  const employee = await Employee.findOne({ user: req.user._id });
  if (!employee) {
    res.status(400).json({ detail: 'No employee profile linked to user.' });
    return;
  }

  const { startOfDay, endOfDay } = getISTDateRange(new Date());

  const record = await AttendanceRecord.findOne({
    employee: employee._id,
    attendanceDate: { $gte: startOfDay, $lte: endOfDay },
  });

  if (!record) {
    res.status(400).json({ detail: 'No check-in record found for today.' });
    return;
  }

  const policy = await getAttendancePolicy();
  const nowStr = getISTTimeString(new Date());

  record.checkOutTime = nowStr;
  if (latitude !== undefined && longitude !== undefined) {
    record.checkOutLatitude = parseFloat(latitude);
    record.checkOutLongitude = parseFloat(longitude);
    record.checkOutDistanceMeters = calculateHaversineDistanceMeters(
      parseFloat(latitude),
      parseFloat(longitude),
      policy.officeLatitude,
      policy.officeLongitude
    );
  }

  calculateAttendanceRecordState(record, policy);
  await record.save();
  res.json(formatSingleRecord(record, employee));
}

// --- Attendance Corrections ---
export async function getAttendanceCorrections(req: Request, res: Response): Promise<void> {
  const corrections = await AttendanceCorrection.find()
    .populate('employee attendanceRecord reviewedBy')
    .sort({ createdAt: -1 });
  res.json(corrections);
}

export async function createAttendanceCorrection(req: Request, res: Response): Promise<void> {
  const { attendance_record_id, requested_check_in, requested_check_out, reason } = req.body;

  const record = await AttendanceRecord.findById(attendance_record_id);
  if (!record) {
    res.status(404).json({ detail: 'Attendance record not found.' });
    return;
  }

  const correction = new AttendanceCorrection({
    employee: record.employee,
    attendanceRecord: record._id,
    requestedCheckIn: requested_check_in || null,
    requestedCheckOut: requested_check_out || null,
    reason: reason.trim(),
    status: 'Pending',
  });

  await correction.save();
  res.status(201).json(correction);
}

export async function updateAttendanceCorrection(req: Request, res: Response): Promise<void> {
  const correction = await AttendanceCorrection.findById(req.params.id);
  if (!correction) {
    res.status(404).json({ detail: 'Attendance correction request not found.' });
    return;
  }

  const { status, admin_note } = req.body;
  if (status) correction.status = status;
  if (admin_note !== undefined) correction.adminNote = admin_note;
  correction.reviewedBy = req.user ? (req.user._id as any) : null;
  correction.reviewedAt = new Date();

  if (status === 'Approved') {
    const record = await AttendanceRecord.findById(correction.attendanceRecord);
    if (record) {
      if (correction.requestedCheckIn) record.checkInTime = correction.requestedCheckIn;
      if (correction.requestedCheckOut) record.checkOutTime = correction.requestedCheckOut;
      const policy = await getAttendancePolicy();
      calculateAttendanceRecordState(record, policy);
      await record.save();
    }
  }

  await correction.save();
  res.json(correction);
}
