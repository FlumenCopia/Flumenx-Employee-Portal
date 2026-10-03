import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { AttendanceRecord, IAttendanceRecord } from '../models/AttendanceRecord.js';
import { AttendancePolicy, IAttendancePolicy } from '../models/AttendancePolicy.js';
import { AttendanceCorrection } from '../models/AttendanceCorrection.js';
import { Employee } from '../models/Employee.js';
import { AuditLog } from '../models/AuditLog.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { CompanyHoliday } from '../models/CompanyHoliday.js';
import { getEmployeeForUser } from '../utils/employeeResolver.js';
import { calculateAttendanceRecordState, calculateHaversineDistanceMeters } from '../services/attendanceEngine.js';
import { timeStringToMinutes, getAttendanceCycleForMonth, getISTDateString, AttendanceCycleInfo } from '../utils/tzUtils.js';
import { getRoleDataScope } from '../services/scopeResolver.js';

export async function getAttendancePolicy(): Promise<IAttendancePolicy> {
  let policy = await AttendancePolicy.findOne();
  if (!policy) {
    policy = new AttendancePolicy({});
    await policy.save();
  } else if (!policy.earlyCheckoutHalfDayCutoff || policy.earlyCheckoutHalfDayCutoff === '18:00') {
    policy.earlyCheckoutHalfDayCutoff = '16:30';
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
export function getISTDateRange(dateInput?: Date | string) {
  let dateStr = '';
  if (typeof dateInput === 'string' && dateInput.includes('-')) {
    dateStr = dateInput.trim().split('T')[0];
  } else {
    const d = dateInput instanceof Date ? dateInput : new Date();
    dateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  }
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
    is_auto_checkout: Boolean(r.isAutoCheckout),
    auto_checkout_reason: r.autoCheckoutReason || '',
  };
}

/**
 * Automatically close attendance records where an employee checked in on a previous day
 * (or after midnight) but forgot to check out.
 */
export async function processMidnightForcedCheckout(): Promise<number> {
  const { startOfDay } = getISTDateRange(new Date());
  const policy = await getAttendancePolicy();

  const pastUncheckedRecords = await AttendanceRecord.find({
    attendanceDate: { $lt: startOfDay },
    checkInTime: { $ne: null, $exists: true },
    $or: [{ checkOutTime: null }, { checkOutTime: '' }, { checkOutTime: { $exists: false } }],
  });

  let count = 0;
  for (const record of pastUncheckedRecords) {
    record.checkOutTime = policy.officeEndTime || '18:30';
    record.isAutoCheckout = true;
    record.autoCheckoutReason = 'Auto-checkout at 12:00 AM (Employee forgot to check out)';
    calculateAttendanceRecordState(record, policy);
    await record.save();
    count++;
  }
  return count;
}

export async function getAttendanceRecords(req: Request, res: Response): Promise<void> {
  const { employee_id, date, month, year, status, my_attendance } = req.query;

  const filter: any = {};
  const attScope = await getRoleDataScope(req.user, 'ATTENDANCE');
  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser || (req.user as any)?.dynamicRole?.isSuperadminWildcard;
  const isManagement = isSuper || attScope === 'ALL';
  const isTeamLead = attScope === 'TEAM' || attScope === 'DEPARTMENT';

  if (!isSuper && !isManagement) {
    const ownEmp = await getEmployeeForUser(req.user);
    if (!ownEmp) {
      res.json({ count: 0, next: null, previous: null, results: [] });
      return;
    }

    if (attScope === 'DEPARTMENT' && ownEmp.department) {
      const deptRegex = new RegExp(`^${ownEmp.department.trim()}$`, 'i');
      const deptEmployees = await Employee.find({ department: deptRegex }).select('_id');
      const deptEmpIds = [ownEmp._id, ...deptEmployees.map((e) => e._id)];

      if (my_attendance === 'true') {
        filter.employee = ownEmp._id;
      } else if (employee_id && mongoose.Types.ObjectId.isValid(employee_id as string)) {
        if (deptEmpIds.some((id) => id.toString() === String(employee_id))) {
          filter.employee = employee_id;
        } else {
          res.json({ count: 0, next: null, previous: null, results: [] });
          return;
        }
      } else {
        filter.employee = { $in: deptEmpIds };
      }
    } else if (attScope === 'TEAM') {
      const deptRegex = ownEmp.department ? new RegExp(`^${ownEmp.department.trim()}$`, 'i') : null;
      const teamEmployees = await Employee.find({
        $or: [
          { teamLead: ownEmp._id },
          ...(deptRegex ? [{ department: deptRegex }] : []),
        ],
      }).select('_id');
      const teamEmpIds = [ownEmp._id, ...teamEmployees.map((e) => e._id)];

      if (my_attendance === 'true') {
        filter.employee = ownEmp._id;
      } else if (employee_id && mongoose.Types.ObjectId.isValid(employee_id as string)) {
        if (teamEmpIds.some((id) => id.toString() === String(employee_id))) {
          filter.employee = employee_id;
        } else {
          res.json({ count: 0, next: null, previous: null, results: [] });
          return;
        }
      } else {
        filter.employee = { $in: teamEmpIds };
      }
    } else {
      // Standard employee strictly sees only own attendance
      filter.employee = ownEmp._id;
    }
  } else {
    if (my_attendance === 'true' && req.user) {
      const emp = await getEmployeeForUser(req.user);
      if (emp) filter.employee = emp._id;
    } else if (employee_id) {
      filter.employee = employee_id;
    }
  }

  if (date) {
    const { startOfDay, endOfDay } = getISTDateRange(date as string);
    filter.attendanceDate = { $gte: startOfDay, $lte: endOfDay };
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

  const policy = await getAttendancePolicy();
  const startMins = timeStringToMinutes(policy.officeStartTime || '09:30');
  const graceEndMins = startMins + (policy.gracePeriodMinutes ?? 5);

  for (const r of records) {
    let changed = false;
    if (r.checkInTime && r.checkInStatus === 'On Time') {
      const mins = timeStringToMinutes(r.checkInTime);
      if (mins > graceEndMins && !r.notes?.toLowerCase().includes('waiv')) {
        calculateAttendanceRecordState(r, policy);
        changed = true;
      }
    }
    // Also re-evaluate any record marked Half Day if checkout time was after 16:30 or completed full day hours
    if (r.checkInTime && r.checkOutTime && r.attendanceStatus === 'Half Day') {
      const prevStatus = r.attendanceStatus;
      calculateAttendanceRecordState(r, policy);
      if (r.attendanceStatus !== prevStatus) {
        changed = true;
      }
    }
    if (changed) {
      await r.save().catch(() => {});
    }
  }

  const formatted = records.map((r) => formatSingleRecord(r, r.employee));

  res.json({
    count: formatted.length,
    next: null,
    previous: null,
    results: formatted,
  });
}

export async function getAttendanceSummary(req: Request, res: Response): Promise<void> {
  const { date, month, year, my_attendance, employee_id } = req.query;

  const filter: any = {};
  let isSingleEmployee = false;
  const attScope = await getRoleDataScope(req.user, 'ATTENDANCE');
  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser || (req.user as any)?.dynamicRole?.isSuperadminWildcard;
  const ownEmp = req.user ? await getEmployeeForUser(req.user) : null;

  if (!isSuper && attScope !== 'ALL') {
    if (attScope === 'OWN' || my_attendance === 'true') {
      if (ownEmp) {
        filter.employee = ownEmp._id;
        isSingleEmployee = true;
      }
    } else if (attScope === 'DEPARTMENT' && ownEmp?.department) {
      const deptRegex = new RegExp(`^${ownEmp.department.trim()}$`, 'i');
      const deptEmployees = await Employee.find({ department: deptRegex }).select('_id');
      const deptEmpIds = [ownEmp._id, ...deptEmployees.map((e) => e._id)];
      filter.employee = { $in: deptEmpIds };
    } else if (attScope === 'TEAM' && ownEmp) {
      const deptRegex = ownEmp.department ? new RegExp(`^${ownEmp.department.trim()}$`, 'i') : null;
      const teamEmployees = await Employee.find({
        $or: [
          { teamLead: ownEmp._id },
          ...(deptRegex ? [{ department: deptRegex }] : []),
        ],
      }).select('_id');
      const teamEmpIds = [ownEmp._id, ...teamEmployees.map((e) => e._id)];
      filter.employee = { $in: teamEmpIds };
    }
  } else if (my_attendance === 'true' && ownEmp) {
    filter.employee = ownEmp._id;
    isSingleEmployee = true;
  } else if (employee_id && mongoose.Types.ObjectId.isValid(employee_id as string)) {
    filter.employee = employee_id;
    isSingleEmployee = true;
  }

  if (date) {
    const { startOfDay, endOfDay } = getISTDateRange(date as string);
    filter.attendanceDate = { $gte: startOfDay, $lte: endOfDay };
  } else if (month && typeof month === 'string' && month.includes('-')) {
    const [y, m] = month.split('-').map((v) => parseInt(v, 10));
    const lastDay = new Date(y, m, 0).getDate();
    filter.attendanceDate = {
      $gte: new Date(`${y}-${String(m).padStart(2, '0')}-01T00:00:00.000+05:30`),
      $lte: new Date(`${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59.999+05:30`),
    };
  } else if (month && year) {
    const m = parseInt(month as string, 10);
    const y = parseInt(year as string, 10);
    const lastDay = new Date(y, m, 0).getDate();
    filter.attendanceDate = {
      $gte: new Date(`${y}-${String(m).padStart(2, '0')}-01T00:00:00.000+05:30`),
      $lte: new Date(`${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59.999+05:30`),
    };
  } else {
    const { startOfDay, endOfDay } = getISTDateRange();
    filter.attendanceDate = { $gte: startOfDay, $lte: endOfDay };
  }

  const records = await AttendanceRecord.find(filter);
  const totalEmployees = await Employee.countDocuments({ status: 'Active' });

  const present = records.filter((r) => r.attendanceStatus && r.attendanceStatus.startsWith('Present')).length;
  const late = records.filter((r) => r.isLate).length;
  const earlyExits = records.filter((r) => r.isEarlyExit).length;
  const absent = records.filter((r) => r.attendanceStatus === 'Absent').length;
  const halfDays = records.filter((r) => r.attendanceStatus === 'Half Day').length;
  const leave = records.filter((r) => r.attendanceStatus === 'Leave').length;

  let denominator = 1;
  if (isSingleEmployee) {
    denominator = records.length || 1;
  } else {
    denominator = date ? (totalEmployees || 1) : (records.length || 1);
  }

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
  const { month, year, my_attendance, employee_id } = req.query;

  const filter: any = {};
  let isSingleEmployee = false;
  const attScope = await getRoleDataScope(req.user, 'ATTENDANCE');
  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser || (req.user as any)?.dynamicRole?.isSuperadminWildcard;
  const ownEmp = req.user ? await getEmployeeForUser(req.user) : null;

  if (!isSuper && attScope !== 'ALL') {
    if (attScope === 'OWN' || my_attendance === 'true') {
      if (ownEmp) {
        filter.employee = ownEmp._id;
        isSingleEmployee = true;
      }
    } else if (attScope === 'DEPARTMENT' && ownEmp?.department) {
      const deptRegex = new RegExp(`^${ownEmp.department.trim()}$`, 'i');
      const deptEmployees = await Employee.find({ department: deptRegex }).select('_id');
      const deptEmpIds = [ownEmp._id, ...deptEmployees.map((e) => e._id)];
      filter.employee = { $in: deptEmpIds };
    } else if (attScope === 'TEAM' && ownEmp) {
      const deptRegex = ownEmp.department ? new RegExp(`^${ownEmp.department.trim()}$`, 'i') : null;
      const teamEmployees = await Employee.find({
        $or: [
          { teamLead: ownEmp._id },
          ...(deptRegex ? [{ department: deptRegex }] : []),
        ],
      }).select('_id');
      const teamEmpIds = [ownEmp._id, ...teamEmployees.map((e) => e._id)];
      filter.employee = { $in: teamEmpIds };
    }
  } else if (my_attendance === 'true' && ownEmp) {
    filter.employee = ownEmp._id;
    isSingleEmployee = true;
  } else if (employee_id && mongoose.Types.ObjectId.isValid(employee_id as string)) {
    filter.employee = employee_id;
    isSingleEmployee = true;
  }

  let y: number;
  let m: number;

  if (month && typeof month === 'string' && month.includes('-')) {
    const parts = month.split('-').map(Number);
    y = parts[0];
    m = parts[1];
  } else if (month && year) {
    y = parseInt(year as string, 10);
    m = parseInt(month as string, 10);
  } else {
    const now = new Date();
    const istDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
    const [currY, currM] = istDate.split('-').map(Number);
    y = currY;
    m = currM;
  }

  const lastDay = new Date(y, m, 0).getDate();
  const startOfMonth = new Date(`${y}-${String(m).padStart(2, '0')}-01T00:00:00.000+05:30`);
  const endOfMonth = new Date(`${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59.999+05:30`);

  filter.attendanceDate = { $gte: startOfMonth, $lte: endOfMonth };

  const records = await AttendanceRecord.find(filter);
  const totalEmployees = await Employee.countDocuments({ status: 'Active' });

  const present = records.filter((r) => r.attendanceStatus && r.attendanceStatus.startsWith('Present')).length;
  const late = records.filter((r) => r.isLate).length;
  const earlyExits = records.filter((r) => r.isEarlyExit).length;
  const absent = records.filter((r) => r.attendanceStatus === 'Absent').length;
  const halfDays = records.filter((r) => r.attendanceStatus === 'Half Day').length;
  const leave = records.filter((r) => r.attendanceStatus === 'Leave').length;

  let denominator = 1;
  if (isSingleEmployee) {
    denominator = records.length || 1;
  } else {
    denominator = records.length || 1;
  }

  const pct = Math.round(((present + halfDays * 0.5) / denominator) * 100 * 10) / 10;
  const monthStr = `${y}-${String(m).padStart(2, '0')}`;

  const summary = {
    present,
    late,
    early_exits: earlyExits,
    absent,
    half_days: halfDays,
    leave,
    attendance_percentage: pct,
    total_employees: totalEmployees,
  };

  const days: Array<{ day: number } & typeof summary> = [];
  for (let d = 1; d <= lastDay; d++) {
    const dayRecords = records.filter((r) => {
      if (!r.attendanceDate) return false;
      const dateVal = r.attendanceDate instanceof Date ? r.attendanceDate : new Date(r.attendanceDate);
      const istDayStr = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric' }).format(dateVal);
      return parseInt(istDayStr, 10) === d;
    });

    const dPresent = dayRecords.filter((r) => r.attendanceStatus && r.attendanceStatus.startsWith('Present')).length;
    const dLate = dayRecords.filter((r) => r.isLate).length;
    const dEarlyExits = dayRecords.filter((r) => r.isEarlyExit).length;
    const dAbsent = dayRecords.filter((r) => r.attendanceStatus === 'Absent').length;
    const dHalfDays = dayRecords.filter((r) => r.attendanceStatus === 'Half Day').length;
    const dLeave = dayRecords.filter((r) => r.attendanceStatus === 'Leave').length;
    const dDenom = isSingleEmployee ? (dayRecords.length || 1) : (totalEmployees || dayRecords.length || 1);
    const dPct = dayRecords.length ? Math.round(((dPresent + dHalfDays * 0.5) / dDenom) * 100 * 10) / 10 : 0;

    days.push({
      day: d,
      present: dPresent,
      late: dLate,
      early_exits: dEarlyExits,
      absent: dAbsent,
      half_days: dHalfDays,
      leave: dLeave,
      attendance_percentage: dPct,
      total_employees: totalEmployees,
    });
  }

  res.json({
    month: monthStr,
    summary,
    days,
    present_count: present,
    late_count: late,
    absent_count: absent,
    leave_count: leave,
    total_records: records.length,
  });
}

/**
 * Builds comprehensive attendance matrix data for either:
 * - Salary Calculation Cycle: 26th of previous month to 25th of selected month
 * - Calendar Month Cycle: 1st of month to last day of month
 * Computes exact daily codes ('P', 'A', 'W', 'L', 'HD', 'H') and salary calculation summaries.
 */
export async function buildAttendanceMatrixData(options: {
  year: number;
  month: number;
  cycleType?: 'salary' | 'calendar';
  department?: string;
  employeeId?: string;
  allowedEmployeeIds?: (string | mongoose.Types.ObjectId)[];
}) {
  const { year, month, cycleType = 'salary', department, employeeId, allowedEmployeeIds } = options;

  let cycleInfo: AttendanceCycleInfo;
  if (cycleType === 'calendar') {
    const lastDay = new Date(year, month, 0).getDate();
    const mStr = String(month).padStart(2, '0');
    const startStr = `${year}-${mStr}-01`;
    const endStr = `${year}-${mStr}-${String(lastDay).padStart(2, '0')}`;
    const cycleStart = new Date(`${startStr}T00:00:00.000+05:30`);
    const cycleEnd = new Date(`${endStr}T23:59:59.999+05:30`);
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const shortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    cycleInfo = {
      year,
      month,
      cycleName: `${monthNames[month - 1]} ${year} (1st - ${lastDay}th)`,
      readablePeriod: `01 ${shortNames[month - 1]} ${year} → ${lastDay} ${shortNames[month - 1]} ${year}`,
      startStr,
      endStr,
      cycleStart,
      cycleEnd,
      totalCalendarDays: lastDay,
    };
  } else {
    cycleInfo = getAttendanceCycleForMonth(year, month);
  }

  // Generate all consecutive day slots in the cycle
  const dayDates: Array<{
    dateStr: string;
    dayNumber: number;
    dayName: string;
    isSunday: boolean;
  }> = [];

  let cur = new Date(cycleInfo.cycleStart.getTime());
  while (cur.getTime() <= cycleInfo.cycleEnd.getTime()) {
    const dStr = getISTDateString(cur);
    const dayNum = parseInt(dStr.split('-')[2], 10);
    const weekdayName = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
    }).format(cur);
    const isSunday = weekdayName === 'Sun';

    dayDates.push({
      dateStr: dStr,
      dayNumber: dayNum,
      dayName: weekdayName,
      isSunday,
    });

    cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
  }

  // Filter employees
  const empFilter: any = {};
  if (department && department !== 'All' && department !== 'all') {
    empFilter.department = department;
  }
  if (allowedEmployeeIds && allowedEmployeeIds.length > 0) {
    if (employeeId) {
      if (allowedEmployeeIds.some((id) => id.toString() === String(employeeId))) {
        empFilter._id = employeeId;
      } else {
        empFilter._id = new mongoose.Types.ObjectId();
      }
    } else {
      empFilter._id = { $in: allowedEmployeeIds };
    }
  } else if (employeeId) {
    empFilter._id = employeeId;
  }

  const attendanceEmployeeFilter = empFilter._id ? { employee: empFilter._id } : employeeId ? { employee: employeeId } : {};

  const [employees, records, leaves, holidays] = await Promise.all([
    Employee.find(empFilter).sort({ employeeCode: 1, name: 1 }),
    AttendanceRecord.find({
      attendanceDate: { $gte: cycleInfo.cycleStart, $lte: cycleInfo.cycleEnd },
      ...attendanceEmployeeFilter,
    }),
    LeaveRequest.find({
      status: 'Approved',
      startDate: { $lte: cycleInfo.cycleEnd },
      endDate: { $gte: cycleInfo.cycleStart },
      ...attendanceEmployeeFilter,
    }),
    CompanyHoliday.find({
      isActive: { $ne: false },
      $or: [
        { date: { $gte: cycleInfo.cycleStart, $lte: cycleInfo.cycleEnd } },
        { dateStr: { $gte: cycleInfo.startStr, $lte: cycleInfo.endStr } },
      ],
    }),
  ]);

  const holidayMap = new Map<string, { name: string; holiday: any }>();
  holidays.forEach((h) => {
    const val = { name: h.name, holiday: h };
    if (h.dateStr) holidayMap.set(h.dateStr, val);
    if (h.date) holidayMap.set(getISTDateString(h.date), val);
  });

  const recordMap = new Map<string, any>();
  records.forEach((r) => {
    const dStr = getISTDateString(r.attendanceDate);
    const eId = r.employee ? r.employee.toString() : '';
    if (eId) recordMap.set(`${eId}_${dStr}`, r);
  });

  const leavesByEmp = new Map<string, any[]>();
  leaves.forEach((l) => {
    const eId = l.employee ? l.employee.toString() : '';
    if (eId) {
      if (!leavesByEmp.has(eId)) leavesByEmp.set(eId, []);
      leavesByEmp.get(eId)!.push(l);
    }
  });

  // Process employee metrics
  const employeeList = employees.map((emp) => {
    const empIdStr = emp._id.toString();
    const isProbation = emp.employmentStatus === 'Probation';
    const joiningDateStr = emp.joiningDate ? getISTDateString(emp.joiningDate) : null;
    const exitDateStr = emp.exitDate ? getISTDateString(emp.exitDate) : null;
    const empLeaves = leavesByEmp.get(empIdStr) || [];

    let workingDays = 0;
    let weekOffs = 0;
    let companyHolidays = 0;
    let presentDays = 0;
    let halfDays = 0;
    let paidLeaveDays = 0;
    let unpaidLeaveDays = 0;
    let absentDays = 0;
    let lateArrivalsCount = 0;

    const dailyStatuses: Record<string, {
      code: 'P' | 'A' | 'W' | 'L' | 'UL' | 'HD' | 'H' | '-';
      label: string;
      checkIn?: string;
      checkOut?: string;
      workingHours?: number;
      isLate?: boolean;
    }> = {};

    for (const day of dayDates) {
      const dStr = day.dateStr;
      const holObj = holidayMap.get(dStr);
      const isHoliday = !!holObj;
      const holidayName = holObj?.name || 'Holiday';

      const isBeforeJoining = joiningDateStr && dStr < joiningDateStr;
      const isAfterExit = exitDateStr && dStr > exitDateStr;

      if (isBeforeJoining || isAfterExit) {
        dailyStatuses[dStr] = { code: '-', label: 'Inactive / Not Joined' };
        absentDays += 1;
        continue;
      }

      if (day.isSunday) {
        weekOffs += 1;
        // Week Off takes precedence
        dailyStatuses[dStr] = { code: 'W', label: 'Week Off' };
      } else if (isHoliday) {
        companyHolidays += 1;
        // Company Holiday is a FULLY PAID holiday for all employees
        dailyStatuses[dStr] = { code: 'H', label: `${holidayName} (Paid Holiday)` };
      } else {
        workingDays += 1;
        const rec = recordMap.get(`${empIdStr}_${dStr}`);

        // Check if employee physically checked in or worked
        if (rec && (rec.checkInTime || rec.attendanceStatus === 'Present' || rec.attendanceStatus === 'Half Day')) {
          if (rec.isLate) lateArrivalsCount += 1;
          if (rec.attendanceStatus === 'Half Day') {
            halfDays += 1;
            dailyStatuses[dStr] = {
              code: 'HD',
              label: 'Half Day',
              checkIn: rec.checkInTime,
              checkOut: rec.checkOutTime,
              workingHours: rec.workingHours,
              isLate: rec.isLate,
            };
          } else {
            presentDays += 1;
            dailyStatuses[dStr] = {
              code: 'P',
              label: 'Present',
              checkIn: rec.checkInTime,
              checkOut: rec.checkOutTime,
              workingHours: rec.workingHours,
              isLate: rec.isLate,
            };
          }
        } else {
          const leaveMatch = empLeaves.find((l) => {
            const lStart = getISTDateString(l.startDate);
            const lEnd = getISTDateString(l.endDate);
            return dStr >= lStart && dStr <= lEnd;
          });

          if (leaveMatch) {
            const isUnpaid = isProbation || leaveMatch.leaveType === 'Unpaid';
            if (isUnpaid) {
              unpaidLeaveDays += 1;
              dailyStatuses[dStr] = { code: 'UL', label: `Unpaid Leave (${leaveMatch.leaveType})` };
            } else {
              paidLeaveDays += 1;
              dailyStatuses[dStr] = { code: 'L', label: `Paid Leave (${leaveMatch.leaveType})` };
            }
          } else if (rec && rec.attendanceStatus === 'Leave') {
            if (isProbation) {
              unpaidLeaveDays += 1;
              dailyStatuses[dStr] = { code: 'UL', label: 'Unpaid Leave (Probation)' };
            } else {
              paidLeaveDays += 1;
              dailyStatuses[dStr] = { code: 'L', label: 'Paid Leave' };
            }
          } else {
            absentDays += 1;
            dailyStatuses[dStr] = { code: 'A', label: 'Absent' };
          }
        }
      }
    }

    const totalCalendarDays = dayDates.length;
    const lateHalfDayDeductions = Math.floor(lateArrivalsCount / 3) * 0.5;
    const salaryDays = Math.max(1, totalCalendarDays - weekOffs);

    let effectivePresentDays = 0;
    if (presentDays > 0 || halfDays > 0 || paidLeaveDays > 0) {
      effectivePresentDays =
        presentDays + companyHolidays + paidLeaveDays + halfDays * 0.5 - lateHalfDayDeductions;
    }

    const payableDays = Math.max(0, Math.min(salaryDays, Math.round(effectivePresentDays * 100) / 100));
    const unpaidDays = Math.max(0, Math.round((salaryDays - payableDays) * 100) / 100);

    return {
      id: emp._id.toString(),
      employeeCode: emp.employeeCode || 'N/A',
      name: emp.name || 'Unknown',
      department: emp.department || 'General',
      designation: emp.designation || 'Staff',
      employmentStatus: emp.employmentStatus || 'Permanent',
      dailyStatuses,
      summary: {
        totalCalendarDays,
        workingDays,
        weekOffs,
        holidays: companyHolidays,
        presentDays,
        halfDays,
        paidLeaveDays,
        unpaidLeaveDays,
        absentDays,
        lateArrivals: lateArrivalsCount,
        lateHalfDayDeductions,
        salaryDays,
        effectivePresentDays,
        payableDays,
        unpaidDays,
      },
    };
  });

  // Calculate day totals across all employees
  const daysWithTotals = dayDates.map((day) => {
    let present = 0;
    let absent = 0;
    let halfDay = 0;
    let leave = 0;
    let weekOff = 0;
    let holiday = 0;

    employeeList.forEach((emp) => {
      const code = emp.dailyStatuses[day.dateStr]?.code;
      if (code === 'P') present++;
      else if (code === 'A') absent++;
      else if (code === 'HD') halfDay++;
      else if (code === 'L' || code === 'UL') leave++;
      else if (code === 'W') weekOff++;
      else if (code === 'H') holiday++;
    });

    return {
      dateStr: day.dateStr,
      dayNumber: day.dayNumber,
      dayName: day.dayName,
      isSunday: day.isSunday,
      isHoliday: !!holidayMap.get(day.dateStr),
      holidayName: holidayMap.get(day.dateStr)?.name || undefined,
      totals: {
        present,
        absent,
        halfDay,
        leave,
        weekOff,
        holiday,
        totalEmployees: employeeList.length,
      },
    };
  });

  const totalEmployees = employeeList.length;
  const totalPresentAll = employeeList.reduce((acc, e) => acc + e.summary.presentDays, 0);
  const totalAbsentAll = employeeList.reduce((acc, e) => acc + e.summary.absentDays, 0);
  const totalLeaveAll = employeeList.reduce((acc, e) => acc + e.summary.paidLeaveDays + e.summary.unpaidLeaveDays, 0);
  const avgPayable =
    totalEmployees > 0
      ? Math.round((employeeList.reduce((acc, e) => acc + e.summary.payableDays, 0) / totalEmployees) * 100) / 100
      : 0;

  return {
    cycle: {
      year: cycleInfo.year,
      month: cycleInfo.month,
      cycleType: (cycleType || 'salary') as 'salary' | 'calendar',
      cycleName: cycleInfo.cycleName,
      readablePeriod: cycleInfo.readablePeriod || '',
      startStr: cycleInfo.startStr,
      endStr: cycleInfo.endStr,
      totalCalendarDays: cycleInfo.totalCalendarDays,
    },
    days: daysWithTotals,
    employees: employeeList,
    overallSummary: {
      totalEmployees,
      totalCalendarDays: cycleInfo.totalCalendarDays,
      avgPayableDays: avgPayable,
      totalPresent: totalPresentAll,
      totalAbsent: totalAbsentAll,
      totalLeaves: totalLeaveAll,
    },
  };
}

/**
 * Returns JSON matrix report with daily codes and salary calculation summary
 */
export async function getAttendanceMatrixReport(req: Request, res: Response): Promise<void> {
  try {
    const monthParam = typeof req.query.month === 'string' ? req.query.month : '';
    const cycleType = req.query.cycleType === 'calendar' ? 'calendar' : 'salary';
    const department = typeof req.query.department === 'string' ? req.query.department : undefined;
    const employeeId = typeof req.query.employeeId === 'string' ? req.query.employeeId : undefined;

    let y: number;
    let m: number;
    if (monthParam && monthParam.includes('-')) {
      const parts = monthParam.split('-').map(Number);
      y = parts[0];
      m = parts[1];
    } else {
      const [cy, cm] = getISTDateString(new Date()).split('-').map(Number);
      y = cy;
      m = cm;
    }

    const attScope = await getRoleDataScope(req.user, 'ATTENDANCE');
    const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser || (req.user as any)?.dynamicRole?.isSuperadminWildcard;
    let allowedEmployeeIds: (string | mongoose.Types.ObjectId)[] | undefined = undefined;

    if (!isSuper && attScope !== 'ALL') {
      const ownEmp = await getEmployeeForUser(req.user);
      if (!ownEmp) {
        res.json({ success: true, cycle: {}, employees: [] });
        return;
      }
      if (attScope === 'OWN') {
        allowedEmployeeIds = [ownEmp._id];
      } else if (attScope === 'DEPARTMENT' && ownEmp.department) {
        const deptRegex = new RegExp(`^${ownEmp.department.trim()}$`, 'i');
        const deptEmployees = await Employee.find({ department: deptRegex }).select('_id');
        allowedEmployeeIds = [ownEmp._id, ...deptEmployees.map((e) => e._id)];
      } else if (attScope === 'TEAM') {
        const deptRegex = ownEmp.department ? new RegExp(`^${ownEmp.department.trim()}$`, 'i') : null;
        const teamEmployees = await Employee.find({
          $or: [
            { teamLead: ownEmp._id },
            ...(deptRegex ? [{ department: deptRegex }] : []),
          ],
        }).select('_id');
        allowedEmployeeIds = [ownEmp._id, ...teamEmployees.map((e) => e._id)];
      }
    }

    const data = await buildAttendanceMatrixData({
      year: y,
      month: m,
      cycleType,
      department,
      employeeId,
      allowedEmployeeIds,
    });

    res.json({ success: true, ...data });
  } catch (error: any) {
    res.status(500).json({ detail: error?.message || 'Failed to generate attendance matrix report.' });
  }
}

function toCSVCell(val: any): string {
  const str = String(val === undefined || val === null ? '' : val);
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Exports Attendance in either:
 * 1. 'muster' (Default): Full Salary Calculation Muster Roll with daily codes + payable days calculation
 * 2. 'daily': Daily Attendance Register matching user reference format (Days in rows, Employees in columns)
 * 3. 'flat': Legacy flat log of check-in / check-out records
 */
export async function exportAttendanceCSV(req: Request, res: Response): Promise<void> {
  try {
    const monthParam = typeof req.query.month === 'string' ? req.query.month : '';
    const cycleType = req.query.cycleType === 'calendar' ? 'calendar' : 'salary';
    const layout = typeof req.query.layout === 'string' ? req.query.layout : 'muster';
    const department = typeof req.query.department === 'string' ? req.query.department : undefined;
    const employeeId = typeof req.query.employeeId === 'string' ? req.query.employeeId : undefined;

    let y: number;
    let m: number;
    if (monthParam && monthParam.includes('-')) {
      const parts = monthParam.split('-').map(Number);
      y = parts[0];
      m = parts[1];
    } else {
      const [cy, cm] = getISTDateString(new Date()).split('-').map(Number);
      y = cy;
      m = cm;
    }

    const attScope = await getRoleDataScope(req.user, 'ATTENDANCE');
    const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser || (req.user as any)?.dynamicRole?.isSuperadminWildcard;
    let allowedEmployeeIds: (string | mongoose.Types.ObjectId)[] | undefined = undefined;

    if (!isSuper && attScope !== 'ALL') {
      const ownEmp = await getEmployeeForUser(req.user);
      if (!ownEmp) {
        res.status(403).json({ detail: 'No employee record linked to account.' });
        return;
      }
      if (attScope === 'OWN') {
        allowedEmployeeIds = [ownEmp._id];
      } else if (attScope === 'DEPARTMENT' && ownEmp.department) {
        const deptRegex = new RegExp(`^${ownEmp.department.trim()}$`, 'i');
        const deptEmployees = await Employee.find({ department: deptRegex }).select('_id');
        allowedEmployeeIds = [ownEmp._id, ...deptEmployees.map((e) => e._id)];
      } else if (attScope === 'TEAM') {
        const deptRegex = ownEmp.department ? new RegExp(`^${ownEmp.department.trim()}$`, 'i') : null;
        const teamEmployees = await Employee.find({
          $or: [
            { teamLead: ownEmp._id },
            ...(deptRegex ? [{ department: deptRegex }] : []),
          ],
        }).select('_id');
        allowedEmployeeIds = [ownEmp._id, ...teamEmployees.map((e) => e._id)];
      }
    }

    // Legacy flat log export
    if (layout === 'flat') {
      const filter: any = {};
      if (monthParam && monthParam.includes('-')) {
        const lastDay = new Date(y, m, 0).getDate();
        const startOfMonth = new Date(`${y}-${String(m).padStart(2, '0')}-01T00:00:00.000+05:30`);
        const endOfMonth = new Date(`${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59.999+05:30`);
        filter.attendanceDate = { $gte: startOfMonth, $lte: endOfMonth };
      }
      if (department && department !== 'All') {
        const emps = await Employee.find({ department }).select('_id');
        filter.employee = { $in: emps.map((e) => e._id) };
      }
      if (allowedEmployeeIds && allowedEmployeeIds.length > 0) {
        if (filter.employee && filter.employee.$in) {
          const allowedStrs = new Set(allowedEmployeeIds.map((id) => id.toString()));
          filter.employee.$in = filter.employee.$in.filter((id: any) => allowedStrs.has(id.toString()));
        } else {
          filter.employee = { $in: allowedEmployeeIds };
        }
      }
      const records = await AttendanceRecord.find(filter).populate('employee').sort({ attendanceDate: -1 });

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

      const csvString = rows.map((row) => row.map(toCSVCell).join(',')).join('\r\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=Attendance_Log_${y}_${String(m).padStart(2, '0')}.csv`);
      res.send(csvString);
      return;
    }

    const matrix = await buildAttendanceMatrixData({
      year: y,
      month: m,
      cycleType,
      department,
      employeeId,
      allowedEmployeeIds,
    });

    if (layout === 'daily') {
      // DAILY ATTENDANCE REGISTER (Matches the visual format of daily register)
      const headerRow = [
        'Day',
        'Date',
        'Day Name',
        ...matrix.employees.map((e) => `${e.name} (${e.employeeCode})`),
        'Present Count',
        'Absent Count',
        'Leave Count',
        'Week Off / Holiday',
      ];

      const dataRows = matrix.days.map((day) => {
        const empStatuses = matrix.employees.map((e) => e.dailyStatuses[day.dateStr]?.code || '-');
        return [
          String(day.dayNumber),
          day.dateStr,
          day.dayName,
          ...empStatuses,
          String(day.totals.present),
          String(day.totals.absent),
          String(day.totals.leave),
          String(day.totals.weekOff + day.totals.holiday),
        ];
      });

      const totalsRow = [
        'TOTALS',
        '-',
        '-',
        ...matrix.employees.map((e) => `${e.summary.presentDays}P / ${e.summary.absentDays}A`),
        String(matrix.days.reduce((s, d) => s + d.totals.present, 0)),
        String(matrix.days.reduce((s, d) => s + d.totals.absent, 0)),
        String(matrix.days.reduce((s, d) => s + d.totals.leave, 0)),
        String(matrix.days.reduce((s, d) => s + d.totals.weekOff + d.totals.holiday, 0)),
      ];

      const titleRows = [
        [`Flumenx Employee Portal - Daily Attendance Register`],
        [`Period: ${matrix.cycle.readablePeriod} (${matrix.cycle.cycleName}) | Department: ${department || 'All'}`],
        [`Legend: P=Present | A=Absent | W=Week Off | L=Leave | HD=Half Day | H=Holiday`],
        [],
      ];

      const allRows = [...titleRows, headerRow, ...dataRows, totalsRow];
      const csvString = allRows.map((row) => row.map(toCSVCell).join(',')).join('\r\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=Daily_Attendance_${matrix.cycle.startStr}_to_${matrix.cycle.endStr}.csv`
      );
      res.send(csvString);
      return;
    }

    // DEFAULT: SALARY ATTENDANCE MUSTER ROLL (For Salary Calculation based on 26th-25th or calendar days)
    const dayHeaders = matrix.days.map((d) => `Day ${d.dayNumber} (${d.dayName})`);
    const headerRow = [
      'Employee Code',
      'Employee Name',
      'Department',
      'Designation',
      'Status',
      ...dayHeaders,
      'Total Days',
      'Present (P)',
      'Half Day (HD)',
      'Paid Holiday (H)',
      'Paid Leave (L)',
      'Unpaid Leave (UL)',
      'Absent (A)',
      'Week Off (W)',
      'Late Arrivals',
      'Late Half-Day Deductions',
      'Salary Days (Total - Sundays)',
      'Payable Days (Salary Calculation)',
      'Unpaid Days (Deductions)',
    ];

    const dataRows = matrix.employees.map((emp) => {
      const dayCols = matrix.days.map((d) => emp.dailyStatuses[d.dateStr]?.code || '-');
      return [
        emp.employeeCode,
        emp.name,
        emp.department,
        emp.designation,
        emp.employmentStatus,
        ...dayCols,
        String(emp.summary.totalCalendarDays),
        String(emp.summary.presentDays),
        String(emp.summary.halfDays),
        String(emp.summary.holidays),
        String(emp.summary.paidLeaveDays),
        String(emp.summary.unpaidLeaveDays),
        String(emp.summary.absentDays),
        String(emp.summary.weekOffs),
        String(emp.summary.lateArrivals),
        String(emp.summary.lateHalfDayDeductions),
        String(emp.summary.salaryDays),
        String(emp.summary.payableDays),
        String(emp.summary.unpaidDays),
      ];
    });

    const titleRows = [
      [`Flumenx Employee Portal - Salary Attendance Muster Roll (${cycleType === 'salary' ? 'Salary Cycle 26th-25th' : 'Calendar Month'})`],
      [`Cycle Period: ${matrix.cycle.readablePeriod} | Total Employees: ${matrix.employees.length} | Department: ${department || 'All'}`],
      [`Policy Rules: Company Holidays are FULLY PAID holidays. Salary Days = Total Calendar Days - Sundays. Payable Days = Present + Paid Holidays + Paid Leave + 0.5*HalfDays - Late Deductions. Unpaid Leave and Absences are deducted.`],
      [],
    ];

    const allRows = [...titleRows, headerRow, ...dataRows];
    const csvString = allRows.map((row) => row.map(toCSVCell).join(',')).join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Salary_Muster_Roll_${matrix.cycle.startStr}_to_${matrix.cycle.endStr}.csv`
    );
    res.send(csvString);
  } catch (error: any) {
    res.status(500).json({ detail: error?.message || 'Failed to export attendance CSV.' });
  }
}

import { optimizeImageFile } from '../utils/imageOptimizer.js';

export async function checkInAttendance(req: Request, res: Response): Promise<void> {
  const { latitude, longitude, qr_reference, source, notes } = req.body;

  if (!req.user) {
    res.status(401).json({ detail: 'Authentication required.' });
    return;
  }

  if (req.file) {
    await optimizeImageFile(req.file.path, { maxWidth: 800, maxHeight: 800, quality: 80 });
  }

  const employee = await getEmployeeForUser(req.user);
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

  const employee = await getEmployeeForUser(req.user);
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
  const { status, my_corrections } = req.query;
  const query: any = {};

  if (status) {
    query.status = status;
  }

  const attScope = await getRoleDataScope(req.user, 'ATTENDANCE');
  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser || (req.user as any)?.dynamicRole?.isSuperadminWildcard;
  const ownEmp = await getEmployeeForUser(req.user);
  const empId = ownEmp?._id || (req.user as any)?.employee || (req.user as any)?.employeeId;

  if (my_corrections === 'true' && empId) {
    query.employee = empId;
  } else if (!isSuper && attScope !== 'ALL') {
    if (attScope === 'OWN') {
      if (empId) query.employee = empId;
      else { res.json([]); return; }
    } else if (attScope === 'DEPARTMENT' && ownEmp?.department) {
      const deptRegex = new RegExp(`^${ownEmp.department.trim()}$`, 'i');
      const deptEmployees = await Employee.find({ department: deptRegex }).select('_id');
      query.employee = { $in: [ownEmp._id, ...deptEmployees.map((e) => e._id)] };
    } else if (attScope === 'TEAM' && ownEmp) {
      const deptRegex = ownEmp.department ? new RegExp(`^${ownEmp.department.trim()}$`, 'i') : null;
      const teamEmployees = await Employee.find({
        $or: [
          { teamLead: ownEmp._id },
          ...(deptRegex ? [{ department: deptRegex }] : []),
        ],
      }).select('_id');
      query.employee = { $in: [ownEmp._id, ...teamEmployees.map((e) => e._id)] };
    }
  }

  const corrections = await AttendanceCorrection.find(query)
    .populate('employee attendanceRecord reviewedBy')
    .sort({ createdAt: -1 });
  res.json(corrections);
}

export async function createAttendanceCorrection(req: Request, res: Response): Promise<void> {
  const recordId = req.body.attendance_record_id || req.body.attendance_record || req.body.attendanceRecord;
  const requested_check_in = req.body.requested_check_in || req.body.requestedCheckIn;
  const requested_check_out = req.body.requested_check_out || req.body.requestedCheckOut;
  const reason = req.body.reason || req.body.note || "Correction requested";

  let record = null;
  if (recordId) {
    record = await AttendanceRecord.findById(recordId);
  }

  const empId = (req.user as any)?.employee || (req.user as any)?.employeeId;
  if (!record && empId) {
    const todayStr = new Date().toISOString().slice(0, 10);
    record = await AttendanceRecord.findOne({ employee: empId, attendanceDate: todayStr });
  }

  if (!record) {
    res.status(404).json({ detail: 'Attendance record not found for correction request.' });
    return;
  }

  const correction = new AttendanceCorrection({
    employee: record.employee,
    attendanceRecord: record._id,
    requestedCheckIn: requested_check_in || null,
    requestedCheckOut: requested_check_out || null,
    reason: String(reason).trim(),
    status: 'Pending',
  });

  await correction.save();
  const populated = await AttendanceCorrection.findById(correction._id).populate('employee attendanceRecord');
  res.status(201).json(populated || correction);
}

export async function updateAttendanceCorrection(req: Request, res: Response): Promise<void> {
  const correction = await AttendanceCorrection.findById(req.params.id);
  if (!correction) {
    res.status(404).json({ detail: 'Attendance correction request not found.' });
    return;
  }

  const attScope = await getRoleDataScope(req.user, 'ATTENDANCE');
  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser || (req.user as any)?.dynamicRole?.isSuperadminWildcard;

  if (!isSuper && attScope === 'OWN') {
    res.status(403).json({ detail: 'Permission denied. You cannot review or approve attendance corrections.' });
    return;
  }

  const { status, admin_note, waive_late } = req.body;
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

      // Only if management explicitly requests to waive late penalties:
      if (waive_late) {
        record.isLate = false;
        record.lateMinutes = 0;
        record.checkInStatus = 'On Time';
        if (record.attendanceStatus === 'Half Day' || record.attendanceStatus === 'Present (Late)') {
          record.attendanceStatus = 'Present';
        }
      }

      const noteSuffix = `Correction Approved (${correction.reason || 'Admin Adjusted'})`;
      record.notes = record.notes ? `${record.notes} | ${noteSuffix}` : noteSuffix;

      await record.save();
    }
  }

  await correction.save();
  const populated = await AttendanceCorrection.findById(correction._id).populate('employee attendanceRecord reviewedBy');
  res.json(populated || correction);
}

export async function triggerForcedCheckoutHandler(req: Request, res: Response): Promise<void> {
  const processedCount = await processMidnightForcedCheckout();
  res.json({ message: `Successfully processed auto-checkout for ${processedCount} records.`, count: processedCount });
}

export async function superAdminCheckoutHandler(req: Request, res: Response): Promise<void> {
  const { attendance_id, employee_id, check_out_time, date, notes, attendance_status } = req.body;

  let record: any = null;
  if (attendance_id) {
    record = await AttendanceRecord.findById(attendance_id).populate('employee');
  } else if (employee_id && date) {
    const { startOfDay, endOfDay } = getISTDateRange(new Date(date));
    record = await AttendanceRecord.findOne({
      employee: employee_id,
      attendanceDate: { $gte: startOfDay, $lte: endOfDay },
    }).populate('employee');
  }

  if (!record) {
    res.status(404).json({ detail: 'Attendance record not found for manual exit.' });
    return;
  }

  const policy = await getAttendancePolicy();
  record.checkOutTime = check_out_time || policy.officeEndTime || '18:30';
  record.isAutoCheckout = false;
  record.autoCheckoutReason = '';

  const adminName = (req.user as any)?.username || (req.user as any)?.email || 'Super Admin';
  const checkoutReason = notes ? `${notes} (Manual Exit by ${adminName})` : `Manual Exit by ${adminName} at ${record.checkOutTime}`;
  record.notes = record.notes ? `${record.notes} | ${checkoutReason}` : checkoutReason;

  calculateAttendanceRecordState(record, policy);
  if (attendance_status) {
    record.attendanceStatus = attendance_status;
  }

  await record.save();

  try {
    await AuditLog.create({
      user: req.user?._id,
      action: 'ADMIN_CHECKOUT',
      module: 'ATTENDANCE',
      details: `Super Admin manually exited employee ${record.employee?.name || record.employee} at ${record.checkOutTime}. Reason: ${checkoutReason}`,
    });
  } catch (err) {}

  res.json({
    message: `Employee successfully exited at ${record.checkOutTime}.`,
    record: formatSingleRecord(record, record.employee),
  });
}

export async function adjustAttendanceTimeHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { check_in_time, check_out_time, notes, is_late, check_in_status, attendance_status, waive_late } = req.body;

  const record = await AttendanceRecord.findById(id).populate('employee');
  if (!record) {
    res.status(404).json({ detail: 'Attendance record not found.' });
    return;
  }

  if (check_in_time !== undefined) record.checkInTime = check_in_time || null;
  if (check_out_time !== undefined) record.checkOutTime = check_out_time || null;
  if (notes !== undefined) record.notes = notes;

  const policy = await getAttendancePolicy();
  calculateAttendanceRecordState(record, policy);

  // If waive_late or is_late is explicitly set by admin:
  if (waive_late || is_late === false) {
    record.isLate = false;
    record.lateMinutes = 0;
    record.checkInStatus = check_in_status || 'On Time';
    record.attendanceStatus = attendance_status || 'Present';
  } else {
    if (is_late !== undefined) record.isLate = Boolean(is_late);
    if (check_in_status) record.checkInStatus = check_in_status;
    if (attendance_status) record.attendanceStatus = attendance_status;
  }

  await record.save();

  res.json(formatSingleRecord(record, record.employee));
}

export async function createManualAttendanceRecord(req: Request, res: Response): Promise<void> {
  try {
    const {
      employee_id,
      attendance_date,
      check_in_time,
      check_out_time,
      attendance_status,
      check_in_status,
      notes,
      waive_late,
    } = req.body;

    if (!employee_id || !mongoose.Types.ObjectId.isValid(employee_id)) {
      res.status(400).json({ detail: 'Valid employee ID is required.' });
      return;
    }

    if (!attendance_date) {
      res.status(400).json({ detail: 'Attendance date is required (YYYY-MM-DD).' });
      return;
    }

    const employee = await Employee.findById(employee_id);
    if (!employee) {
      res.status(404).json({ detail: 'Employee not found.' });
      return;
    }

    const { startOfDay, endOfDay } = getISTDateRange(attendance_date);

    let record = await AttendanceRecord.findOne({
      employee: employee._id,
      attendanceDate: { $gte: startOfDay, $lte: endOfDay },
    });

    const policy = await getAttendancePolicy();

    if (!record) {
      record = new AttendanceRecord({
        employee: employee._id,
        attendanceDate: startOfDay,
        checkInTime: check_in_time || '09:30',
        checkOutTime: check_out_time || null,
        source: 'Admin',
        locationVerified: true,
        notes: notes ? `${notes} (Manual Entry by Admin)` : 'Manual Entry by Admin',
      });
    } else {
      if (check_in_time !== undefined) record.checkInTime = check_in_time;
      if (check_out_time !== undefined) record.checkOutTime = check_out_time || null;
      record.source = 'Admin';
      record.locationVerified = true;
      if (notes) record.notes = `${notes} (Admin Updated)`;
    }

    calculateAttendanceRecordState(record, policy);

    if (waive_late) {
      record.isLate = false;
      record.lateMinutes = 0;
      record.checkInStatus = check_in_status || 'On Time';
      if (attendance_status) {
        record.attendanceStatus = attendance_status;
      } else if (record.attendanceStatus === 'Half Day' || record.attendanceStatus === 'Present (Late)') {
        record.attendanceStatus = 'Present';
      }
    } else {
      if (check_in_status) record.checkInStatus = check_in_status;
      if (attendance_status) record.attendanceStatus = attendance_status;
    }

    await record.save();

    try {
      await AuditLog.create({
        actor: req.user?._id || null,
        action: 'ATTENDANCE_MANUAL_CREATED',
        entityType: 'AttendanceRecord',
        entityId: String(record._id),
        details: {
          employee: employee.name,
          date: attendance_date,
          checkIn: record.checkInTime,
          checkOut: record.checkOutTime,
          status: record.attendanceStatus,
        },
      });
    } catch (e) {
      // Non-blocking
    }

    res.status(201).json(formatSingleRecord(record, employee));
  } catch (error: any) {
    res.status(500).json({ detail: error.message || 'Failed to create manual attendance record.' });
  }
}

export async function deleteAttendanceRecord(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404).json({ detail: 'Attendance record not found.' });
      return;
    }

    const record = await AttendanceRecord.findById(id).populate('employee');
    if (!record) {
      res.status(404).json({ detail: 'Attendance record not found.' });
      return;
    }

    const empName = (record.employee as any)?.name || 'Employee';
    const attDate = record.attendanceDate ? record.attendanceDate.toISOString().split('T')[0] : '';

    await AttendanceRecord.findByIdAndDelete(id);

    // Clean up any linked attendance corrections for this record
    await AttendanceCorrection.deleteMany({ attendanceRecord: id });

    try {
      await AuditLog.create({
        actor: req.user?._id || null,
        action: 'ATTENDANCE_RECORD_DELETED',
        entityType: 'AttendanceRecord',
        entityId: String(id),
        details: { employee: empName, date: attDate, reason: 'Deleted by Admin' },
      });
    } catch (e) {
      // Non-blocking
    }

    res.json({ message: 'Attendance record successfully deleted.', id });
  } catch (error: any) {
    res.status(500).json({ detail: error.message || 'Failed to delete attendance record.' });
  }
}

export async function deleteAttendanceCorrection(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404).json({ detail: 'Attendance correction request not found.' });
      return;
    }

    const correction = await AttendanceCorrection.findById(id);
    if (!correction) {
      res.status(404).json({ detail: 'Attendance correction request not found.' });
      return;
    }

    await AttendanceCorrection.findByIdAndDelete(id);

    try {
      await AuditLog.create({
        actor: req.user?._id || null,
        action: 'ATTENDANCE_CORRECTION_DELETED',
        entityType: 'AttendanceCorrection',
        entityId: String(id),
        details: { id },
      });
    } catch (e) {
      // Non-blocking
    }

    res.json({ message: 'Attendance correction request deleted.', id });
  } catch (error: any) {
    res.status(500).json({ detail: error.message || 'Failed to delete correction request.' });
  }
}

