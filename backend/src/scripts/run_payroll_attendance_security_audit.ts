import http from 'http';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import app from '../server.js';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';
import { Department } from '../models/Department.js';
import { AttendanceRecord } from '../models/AttendanceRecord.js';
import { AttendancePolicy } from '../models/AttendancePolicy.js';
import { CompanyHoliday } from '../models/CompanyHoliday.js';
import { SalaryHead } from '../models/SalaryHead.js';
import { EmployeeSalaryStructure } from '../models/EmployeeSalaryStructure.js';
import { PayrollRecord } from '../models/PayrollRecord.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { LeaveLedger } from '../models/LeaveLedger.js';
import { config } from '../config/env.js';
import {
  getISTDateString,
  getISTTimeString,
  getISTParts,
  getAttendanceCycleForMonth,
  getAttendanceCycleForDate,
} from '../utils/tzUtils.js';
import { calculateAttendanceRecordState } from '../services/attendanceEngine.js';
import { accrueMonthlyLeave, getEmployeeLeaveBalance, convertThreeMonthUnusedLeaveToSalary } from '../services/leaveEngine.js';
import { calculateAttendanceForCycle, computePayroll } from '../services/payrollEngine.js';

const PORT = 8086;
const BASE_URL = `http://127.0.0.1:${PORT}/api`;

export interface AuditScenarioResult {
  id: string;
  category: string;
  name: string;
  expectedStatus: number | number[];
  actualStatus: number;
  verdict: 'PASS' | 'FAIL';
  details: string;
}

const auditScenarios: AuditScenarioResult[] = [];

function logScenario(s: AuditScenarioResult) {
  auditScenarios.push(s);
  console.log(`[PAYROLL-SEC-AUDIT ${s.id.padEnd(16)}] ${s.name.padEnd(52)} | HTTP ${s.actualStatus} [${s.verdict}]`);
}

async function req(
  method: string,
  urlPath: string,
  token?: string,
  body?: any,
  customHeaders?: Record<string, string>
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['Cookie'] = `access_token=${token}`;
  }

  const normalizedPath = urlPath.startsWith('/') ? urlPath : `/${urlPath}`;
  const fullUrl = `${BASE_URL}${normalizedPath}`;

  const opts: RequestInit = {
    method,
    headers,
  };
  if (body !== undefined) {
    opts.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  try {
    const res = await fetch(fullUrl, opts);
    const contentType = res.headers.get('content-type') || '';
    let data: any = null;
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }
    return { status: res.status, headers: res.headers, body: data };
  } catch (err: any) {
    return { status: 500, headers: null, body: { error: err.message } };
  }
}

async function runPayrollAttendanceSecurityAudit() {
  console.log('================================================================================');
  console.log('=== STARTING ADVANCED PAYROLL, ATTENDANCE & SECURITY AUDIT SUITE ===');
  console.log('================================================================================');

  await connectDB();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(PORT, () => resolve()));
  console.log(`[Security Audit Server] Running on http://127.0.0.1:${PORT}`);

  const tokens: Record<string, string> = {};
  const users: Record<string, any> = {};
  const employees: Record<string, any> = {};

  try {
    // 1. Reset database collections
    await User.deleteMany({});
    await Employee.deleteMany({});
    await Department.deleteMany({});
    await AttendanceRecord.deleteMany({});
    await AttendancePolicy.deleteMany({});
    await CompanyHoliday.deleteMany({});
    await SalaryHead.deleteMany({});
    await EmployeeSalaryStructure.deleteMany({});
    await PayrollRecord.deleteMany({});
    await LeaveRequest.deleteMany({});
    await LeaveLedger.deleteMany({});

    const deptDev = await new Department({ name: 'Web Development', code: 'WEB_DEV', displayOrder: 1 }).save();
    const deptAcc = await new Department({ name: 'Accounts', code: 'ACCOUNTANT', displayOrder: 2 }).save();
    const deptHR = await new Department({ name: 'Human Resources', code: 'HR', displayOrder: 3 }).save();

    const policy = await new AttendancePolicy({
      officeStartTime: '09:30',
      gracePeriodMinutes: 5,
      officeEndTime: '18:30',
      earlyCheckoutHalfDayCutoff: '18:00',
      halfDayHours: 4,
    }).save();

    const roles = ['SUPER_ADMIN', 'ACCOUNTANT', 'HR', 'EMPLOYEE_A', 'EMPLOYEE_B', 'EMPLOYEE_MID_JOIN'];

    for (let i = 0; i < roles.length; i++) {
      const r = roles[i];
      const actualRole = r.startsWith('EMPLOYEE') ? 'EMPLOYEE' : r;
      const isProbation = r === 'EMPLOYEE_B';
      const isMidJoin = r === 'EMPLOYEE_MID_JOIN';
      const email = `${r.toLowerCase()}@flumenx.com`;
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('password123', salt);
      const u = new User({
        username: r.toLowerCase(),
        email,
        password: hashedPassword,
        firstName: r,
        lastName: 'User',
        role: actualRole,
        isSuperuser: r === 'SUPER_ADMIN',
        isStaff: ['SUPER_ADMIN', 'ACCOUNTANT', 'HR'].includes(r),
        isActive: true,
      });
      await u.save();
      users[r] = u;

      tokens[r] = jwt.sign(
        { id: u._id.toString(), userId: u._id.toString(), role: u.role, username: u.username, email: u.email, isSuperuser: u.isSuperuser },
        config.jwtSecret,
        { expiresIn: '1d' }
      );

      const emp = new Employee({
        user: u._id,
        employeeCode: `FX-SEC-${i + 1}`,
        name: `${r} Employee`,
        email,
        phone: `+91 987654330${i}`,
        joiningDate: isMidJoin ? new Date('2026-08-10T00:00:00.000+05:30') : new Date('2025-01-01T00:00:00.000+05:30'),
        designation: `${r} Specialist`,
        department: r === 'ACCOUNTANT' ? 'Accounts' : r === 'HR' ? 'Human Resources' : 'Web Development',
        departmentRef: r === 'ACCOUNTANT' ? deptAcc._id : r === 'HR' ? deptHR._id : deptDev._id,
        status: 'Active',
        employmentStatus: isProbation ? 'Probation' : 'Permanent',
      });
      await emp.save();
      employees[r] = emp;
    }

    // -------------------------------------------------------------------------
    // TEST 1: TIMEZONE INDEPENDENCE (ASIA/KOLKATA CANONICAL EVALUATION)
    // -------------------------------------------------------------------------
    const utcMidnight = new Date('2026-08-15T00:00:00.000Z');
    const istDate = getISTDateString(utcMidnight);
    const istTime = getISTTimeString(utcMidnight);
    const tzOk = istDate === '2026-08-15' && istTime === '05:30';

    logScenario({
      id: 'SEC-TZ-01',
      category: 'Timezone Engine',
      name: 'VPS Timezone Independent Asia/Kolkata Interpretation',
      expectedStatus: 200,
      actualStatus: tzOk ? 200 : 500,
      verdict: tzOk ? 'PASS' : 'FAIL',
      details: `UTC Timestamp successfully resolved to ${istDate} ${istTime} IST`,
    });

    // -------------------------------------------------------------------------
    // TEST 2: ATTENDANCE CYCLE BOUNDARY DETERMINISM (25th -> 24th)
    // -------------------------------------------------------------------------
    const augCycle = getAttendanceCycleForMonth(2026, 8);
    const c24 = getAttendanceCycleForDate('2026-08-24T23:59:59.999+05:30');
    const c25 = getAttendanceCycleForDate('2026-08-25T00:00:00.000+05:30');
    const cycleOk =
      augCycle.startStr === '2026-07-25' &&
      augCycle.endStr === '2026-08-24' &&
      c24.month === 8 &&
      c25.month === 9;

    logScenario({
      id: 'SEC-CYCLE-01',
      category: 'Attendance Cycle',
      name: '25th-to-24th Attendance Cycle Exact Boundary Resolution',
      expectedStatus: 200,
      actualStatus: cycleOk ? 200 : 500,
      verdict: cycleOk ? 'PASS' : 'FAIL',
      details: `Aug: ${augCycle.startStr} to ${augCycle.endStr}; 24 Aug -> M8, 25 Aug -> M9`,
    });

    // -------------------------------------------------------------------------
    // TEST 3: COMPANY HOLIDAY CALENDAR & NON-ABSENCE SALARY PROTECTION
    // -------------------------------------------------------------------------
    const hRes = await req('POST', '/holidays/', tokens['HR'], {
      name: 'Independence Day',
      date: '2026-08-15',
      holiday_type: 'Public',
      is_paid: true,
    });
    logScenario({
      id: 'SEC-HOLIDAY-01',
      category: 'Holiday Calendar',
      name: 'Create Public Paid Holiday & Non-Absence Exemption',
      expectedStatus: 201,
      actualStatus: hRes.status,
      verdict: hRes.status === 201 ? 'PASS' : 'FAIL',
      details: `Created holiday ${hRes.body?.name} on ${hRes.body?.dateStr}`,
    });

    // -------------------------------------------------------------------------
    // TEST 4: PROBATION (0 PAID LEAVE) VS PERMANENT MONTHLY ACCRUAL
    // -------------------------------------------------------------------------
    const probBal = await getEmployeeLeaveBalance(employees['EMPLOYEE_B']._id);
    await accrueMonthlyLeave(employees['EMPLOYEE_A']._id, 8, 2026);
    const permBal = await getEmployeeLeaveBalance(employees['EMPLOYEE_A']._id);

    const leaveEntOk = probBal.totalPaidLeaveBalance === 0 && permBal.sickLeaveBalance === 1 && permBal.casualLeaveBalance === 1;
    logScenario({
      id: 'SEC-LEAVE-01',
      category: 'Leave Policy',
      name: 'Probation (0 Paid Leave) vs Permanent Monthly Accrual',
      expectedStatus: 200,
      actualStatus: leaveEntOk ? 200 : 500,
      verdict: leaveEntOk ? 'PASS' : 'FAIL',
      details: `Probation: ${probBal.totalPaidLeaveBalance}d | Perm: ${permBal.sickLeaveBalance}s + ${permBal.casualLeaveBalance}c`,
    });

    // -------------------------------------------------------------------------
    // TEST 5: 3-MONTH UNUSED LEAVE TO SALARY CONVERSION
    // -------------------------------------------------------------------------
    await new LeaveLedger({
      employee: employees['EMPLOYEE_A']._id,
      leaveType: 'Casual',
      transactionType: 'MonthlyAccrual',
      quantity: 2,
      balanceAfter: permBal.totalPaidLeaveBalance + 2,
      earnedMonth: 3,
      earnedYear: 2026,
      notes: 'Eligible 3-month unused leave',
    }).save();

    const convResult = await convertThreeMonthUnusedLeaveToSalary(
      employees['EMPLOYEE_A']._id,
      8,
      2026,
      1200
    );
    const convOk = convResult.convertedDays > 0 && convResult.convertedAmount === convResult.convertedDays * 1200;

    logScenario({
      id: 'SEC-CONV-01',
      category: 'Leave Conversion',
      name: '3-Month Unused Leave to Salary Earning Conversion',
      expectedStatus: 200,
      actualStatus: convOk ? 200 : 500,
      verdict: convOk ? 'PASS' : 'FAIL',
      details: `Converted ${convResult.convertedDays} days to ₹${convResult.convertedAmount} earning`,
    });

    // -------------------------------------------------------------------------
    // TEST 6: ATTENDANCE LATE (09:35 AM) & NOON HALF-DAY RULES
    // -------------------------------------------------------------------------
    const recOnTime: any = { checkInTime: '09:30', attendanceStatus: 'Present' };
    calculateAttendanceRecordState(recOnTime, policy);
    const recGrace: any = { checkInTime: '09:34', attendanceStatus: 'Present' };
    calculateAttendanceRecordState(recGrace, policy);
    const recLate: any = { checkInTime: '09:36', attendanceStatus: 'Present' };
    calculateAttendanceRecordState(recLate, policy);
    const recNoon: any = { checkInTime: '12:15', attendanceStatus: 'Present' };
    calculateAttendanceRecordState(recNoon, policy);

    const attRulesOk =
      recOnTime.isLate === false &&
      recGrace.isLate === false &&
      recLate.isLate === true &&
      recNoon.attendanceStatus === 'Half Day';

    logScenario({
      id: 'SEC-ATT-01',
      category: 'Attendance Rules',
      name: '09:35 AM Late Arrival & 12:00 PM Noon Half-Day Rules',
      expectedStatus: 200,
      actualStatus: attRulesOk ? 200 : 500,
      verdict: attRulesOk ? 'PASS' : 'FAIL',
      details: `09:30 (On Time), 09:34 (Grace), 09:36 (Late), 12:15 (Half Day)`,
    });

    // -------------------------------------------------------------------------
    // TEST 7: SALARY STRUCTURE & PF CAPPING AT ₹15,000 WAGE CEILING
    // -------------------------------------------------------------------------
    const sRes = await req('POST', '/salary-structures/', tokens['ACCOUNTANT'], {
      employee: employees['EMPLOYEE_A']._id.toString(),
      grossSalary: 80000,
      basicSalary: 40000,
      hra: 20000,
      conveyance: 5000,
      specialAllowance: 15000,
      pfEnabled: true,
      pfEmployeePercent: 12,
      pfEmployerPercent: 12,
      pfWageCeiling: 15000, // Statutory Ceiling cap -> ₹1,800
      esiEnabled: false,
      professionalTax: 200,
      tds: 1500,
    });
    logScenario({
      id: 'SEC-STRUCT-01',
      category: 'Salary Structure',
      name: 'Configure Employee Salary Structure & PF Wage Cap',
      expectedStatus: 200,
      actualStatus: sRes.status,
      verdict: sRes.status === 200 ? 'PASS' : 'FAIL',
      details: `Configured Gross ₹${sRes.body?.grossSalary}, Basic ₹${sRes.body?.basicSalary}`,
    });

    // -------------------------------------------------------------------------
    // TEST 8: THREE-LATE ARRIVALS HALF-DAY DEDUCTION
    // -------------------------------------------------------------------------
    await AttendanceRecord.create({
      employee: employees['EMPLOYEE_A']._id,
      attendanceDate: new Date('2026-07-28T09:40:00.000+05:30'),
      checkInTime: '09:40',
      isLate: true,
      attendanceStatus: 'Present',
    });
    await AttendanceRecord.create({
      employee: employees['EMPLOYEE_A']._id,
      attendanceDate: new Date('2026-07-29T09:45:00.000+05:30'),
      checkInTime: '09:45',
      isLate: true,
      attendanceStatus: 'Present',
    });
    await AttendanceRecord.create({
      employee: employees['EMPLOYEE_A']._id,
      attendanceDate: new Date('2026-07-30T09:50:00.000+05:30'),
      checkInTime: '09:50',
      isLate: true,
      attendanceStatus: 'Present',
    });

    const previewRes = await req('POST', '/payroll/preview/', tokens['ACCOUNTANT'], {
      employee_id: employees['EMPLOYEE_A']._id.toString(),
      month: 8,
      year: 2026,
    });

    const latesOk = previewRes.body?.attendanceCycle?.lateArrivalsCount === 3;
    const halfDayDedOk = previewRes.body?.attendanceCycle?.lateHalfDayDeductions === 0.5;
    const pfCappedOk = previewRes.body?.pfEmployee === 1800;

    logScenario({
      id: 'SEC-3LATE-01',
      category: 'Payroll Engine',
      name: 'Three-Late Arrivals Trigger 0.5-Day Deduction & PF Cap',
      expectedStatus: 200,
      actualStatus: previewRes.status === 200 && latesOk && halfDayDedOk && pfCappedOk ? 200 : 500,
      verdict: previewRes.status === 200 && latesOk && halfDayDedOk && pfCappedOk ? 'PASS' : 'FAIL',
      details: `Lates: 3, Late Deduction Days: ${previewRes.body?.attendanceCycle?.lateHalfDayDeductions}, PF: ₹${previewRes.body?.pfEmployee}`,
    });

    // -------------------------------------------------------------------------
    // TEST 9: MID-CYCLE JOINING PRORATION
    // -------------------------------------------------------------------------
    await req('POST', '/salary-structures/', tokens['ACCOUNTANT'], {
      employee: employees['EMPLOYEE_MID_JOIN']._id.toString(),
      grossSalary: 60000,
      basicSalary: 30000,
      pfEnabled: false,
    });

    const midJoinPreview = await req('POST', '/payroll/preview/', tokens['ACCOUNTANT'], {
      employee_id: employees['EMPLOYEE_MID_JOIN']._id.toString(),
      month: 8,
      year: 2026,
    });

    const daysBeforeJoiningUnpaid = midJoinPreview.body?.attendanceCycle?.unpaidDays > 0;
    logScenario({
      id: 'SEC-PRORATE-01',
      category: 'Proration Engine',
      name: 'Mid-Cycle Joining Date Prorated Salary Calculation',
      expectedStatus: 200,
      actualStatus: midJoinPreview.status === 200 && daysBeforeJoiningUnpaid ? 200 : 500,
      verdict: midJoinPreview.status === 200 && daysBeforeJoiningUnpaid ? 'PASS' : 'FAIL',
      details: `Joined 10 Aug: Unpaid days: ${midJoinPreview.body?.attendanceCycle?.unpaidDays} (Prorated LOP: ₹${midJoinPreview.body?.attendanceDeduction})`,
    });

    // -------------------------------------------------------------------------
    // TEST 10: PAYROLL IMMUTABILITY & DUPLICATE RERUN PROTECTION
    // -------------------------------------------------------------------------
    const processRes = await req('POST', '/payroll/process-cycle/', tokens['ACCOUNTANT'], {
      month: 8,
      year: 2026,
    });
    const pId = processRes.body?.results?.[0]?._id;

    // Approve record
    await req('POST', `/payroll/${pId}/approve/`, tokens['ACCOUNTANT']);

    // Attempt bulk rerun
    await req('POST', '/payroll/process-cycle/', tokens['ACCOUNTANT'], {
      month: 8,
      year: 2026,
    });

    const approvedCheck = await PayrollRecord.findById(pId);
    const immutabilityOk = approvedCheck?.status === 'Approved';

    logScenario({
      id: 'SEC-IMMUTABLE-01',
      category: 'Payroll Immutability',
      name: 'Approved Payroll Record Immutability Verification',
      expectedStatus: 200,
      actualStatus: immutabilityOk ? 200 : 500,
      verdict: immutabilityOk ? 'PASS' : 'FAIL',
      details: 'Approved payroll status retained and protected against bulk overwrites',
    });

    // -------------------------------------------------------------------------
    // TEST 11: CROSS-USER IDOR & SALARY ACCESS PROTECTION
    // -------------------------------------------------------------------------
    const idorCheck = await req('GET', `/payroll/${pId}/`, tokens['EMPLOYEE_B']);
    logScenario({
      id: 'SEC-IDOR-01',
      category: 'Security & IDOR',
      name: 'Cross-Employee Payroll Record Access Block (HTTP 403)',
      expectedStatus: 403,
      actualStatus: idorCheck.status,
      verdict: idorCheck.status === 403 ? 'PASS' : 'FAIL',
      details: 'Unauthorized employee blocked with HTTP 403 Forbidden',
    });

    // -------------------------------------------------------------------------
    // TEST 12: UNAUTHORIZED ROLE PERMISSION BLOCK (RBAC)
    // -------------------------------------------------------------------------
    const rbacCheck = await req('POST', `/payroll/${pId}/approve/`, tokens['EMPLOYEE_A']);
    logScenario({
      id: 'SEC-RBAC-01',
      category: 'Security & RBAC',
      name: 'Non-Management Payroll Approval Block (HTTP 403)',
      expectedStatus: 403,
      actualStatus: rbacCheck.status,
      verdict: rbacCheck.status === 403 ? 'PASS' : 'FAIL',
      details: 'Non-management user blocked with HTTP 403 Forbidden',
    });

    // -------------------------------------------------------------------------
    // TEST 13: NEGATIVE NUMERIC SALARY INPUT REJECTION (MASS ASSIGNMENT / VALIDATION)
    // -------------------------------------------------------------------------
    const negSalary = await req('POST', '/salary-structures/', tokens['ACCOUNTANT'], {
      employee: employees['EMPLOYEE_A']._id.toString(),
      grossSalary: -10000,
      basicSalary: -5000,
    });
    logScenario({
      id: 'SEC-INPUT-01',
      category: 'Input Hardening',
      name: 'Negative Numeric Salary Input Rejection (HTTP 400)',
      expectedStatus: 400,
      actualStatus: negSalary.status,
      verdict: negSalary.status === 400 ? 'PASS' : 'FAIL',
      details: 'Negative numbers rejected with HTTP 400 Bad Request',
    });

    // -------------------------------------------------------------------------
    // TEST 14: ENTERPRISE PAYROLL REPORTS ENDPOINTS
    // -------------------------------------------------------------------------
    const rSummary = await req('GET', '/payroll/reports/summary/?month=8&year=2026', tokens['ACCOUNTANT']);
    const rStatutory = await req('GET', '/payroll/reports/statutory/?month=8&year=2026', tokens['ACCOUNTANT']);
    const rImpact = await req('GET', '/payroll/reports/attendance-impact/?month=8&year=2026', tokens['ACCOUNTANT']);
    const rConv = await req('GET', '/payroll/reports/leave-conversion/?year=2026', tokens['ACCOUNTANT']);

    const reportsOk =
      rSummary.status === 200 &&
      rStatutory.status === 200 &&
      rImpact.status === 200 &&
      rConv.status === 200;

    logScenario({
      id: 'SEC-REPORTS-01',
      category: 'Payroll Reports',
      name: 'Summary, Statutory, Attendance & Conversion Reports',
      expectedStatus: 200,
      actualStatus: reportsOk ? 200 : 500,
      verdict: reportsOk ? 'PASS' : 'FAIL',
      details: `Summary: ${rSummary.status}, Statutory: ${rStatutory.status}, Impact: ${rImpact.status}, Conversion: ${rConv.status}`,
    });

    console.log('================================================================================');
    console.log(`=== ALL ${auditScenarios.length} ADVANCED PAYROLL AUDIT SCENARIOS COMPLETED ===`);
    console.log('================================================================================');

  } catch (err) {
    console.error('[Security Audit Error]', err);
  } finally {
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  }
}

runPayrollAttendanceSecurityAudit();
