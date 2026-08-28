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

const PORT = 8087;
const BASE_URL = `http://127.0.0.1:${PORT}/api`;

export interface MatrixTestResult {
  id: string;
  category: string;
  name: string;
  expectedStatus: number | number[];
  actualStatus: number;
  result: 'PASS' | 'FAIL';
  details: string;
}

const matrixResults: MatrixTestResult[] = [];

function recordTest(t: MatrixTestResult) {
  matrixResults.push(t);
  console.log(`[ENTERPRISE-MATRIX ${t.id.padEnd(16)}] ${t.name.padEnd(50)} | HTTP ${t.actualStatus} [${t.result}]`);
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

async function runEnterpriseMatrixSuite() {
  console.log('================================================================================');
  console.log('=== COMPLETE ENTERPRISE SALARY, PAYROLL, ATTENDANCE & TIMEZONE TEST MATRIX ===');
  console.log('================================================================================');

  await connectDB();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(PORT, () => resolve()));
  console.log(`[Matrix Test Server] Running on http://127.0.0.1:${PORT}`);

  const tokens: Record<string, string> = {};
  const users: Record<string, any> = {};
  const employees: Record<string, any> = {};

  try {
    // 1. Clear test fixtures
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

    const roles = ['SUPER_ADMIN', 'ACCOUNTANT', 'HR', 'EMPLOYEE_PERM', 'EMPLOYEE_PROB'];

    for (let i = 0; i < roles.length; i++) {
      const r = roles[i];
      const actualRole = r.startsWith('EMPLOYEE') ? 'EMPLOYEE' : r;
      const isProbation = r === 'EMPLOYEE_PROB';
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
        employeeCode: `FX-ENT-${i + 1}`,
        name: `${r} Employee`,
        email,
        phone: `+91 987654321${i}`,
        joiningDate: new Date('2025-01-01'),
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
    // MATRIX 1: TIMEZONE FOUNDATION (ASIA/KOLKATA)
    // -------------------------------------------------------------------------
    const utcDate = new Date('2026-08-15T00:00:00.000Z');
    const istDate = getISTDateString(utcDate);
    const istTime = getISTTimeString(utcDate);
    const istParts = getISTParts(utcDate);
    const tzPass = istDate === '2026-08-15' && istTime === '05:30' && istParts.hours === 5 && istParts.minutes === 30;

    recordTest({
      id: 'MAT-TZ-01',
      category: 'Timezone Foundation',
      name: 'Deterministic Asia/Kolkata Interpretation',
      expectedStatus: 200,
      actualStatus: tzPass ? 200 : 500,
      result: tzPass ? 'PASS' : 'FAIL',
      details: `UTC Midnight mapped to ${istDate} ${istTime} IST`,
    });

    // -------------------------------------------------------------------------
    // MATRIX 2: ATTENDANCE CYCLE (25TH TO 24TH BOUNDARY)
    // -------------------------------------------------------------------------
    const cycAug = getAttendanceCycleForMonth(2026, 8);
    const cyc24 = getAttendanceCycleForDate('2026-08-24T18:00:00.000+05:30');
    const cyc25 = getAttendanceCycleForDate('2026-08-25T09:00:00.000+05:30');
    const cyclePass =
      cycAug.startStr === '2026-07-25' &&
      cycAug.endStr === '2026-08-24' &&
      cyc24.month === 8 &&
      cyc25.month === 9;

    recordTest({
      id: 'MAT-CYCLE-01',
      category: 'Attendance Cycle',
      name: '25th-to-24th Boundary Cycle Selection',
      expectedStatus: 200,
      actualStatus: cyclePass ? 200 : 500,
      result: cyclePass ? 'PASS' : 'FAIL',
      details: `Aug: ${cycAug.startStr} -> ${cycAug.endStr} | 24 Aug -> M8, 25 Aug -> M9`,
    });

    // -------------------------------------------------------------------------
    // MATRIX 3: COMPANY HOLIDAYS & PAYROLL EXCLUSION (HOLIDAY != ABSENT)
    // -------------------------------------------------------------------------
    const hol1 = await req('POST', '/holidays/', tokens['HR'], {
      name: 'Independence Day',
      date: '2026-08-15',
      holiday_type: 'Public',
      is_paid: true,
    });
    const hol2 = await req('POST', '/holidays/', tokens['HR'], {
      name: 'Onam',
      date: '2026-08-20',
      holiday_type: 'Company',
      is_paid: true,
    });
    recordTest({
      id: 'MAT-HOLIDAY-01',
      category: 'Holiday Calendar',
      name: 'Create Public & Company Holidays via API',
      expectedStatus: 201,
      actualStatus: hol1.status === 201 && hol2.status === 201 ? 201 : 500,
      result: hol1.status === 201 && hol2.status === 201 ? 'PASS' : 'FAIL',
      details: 'Created Independence Day & Onam holidays',
    });

    // -------------------------------------------------------------------------
    // MATRIX 4: PROBATION VS PERMANENT LEAVE ENTITLEMENT & ACCRUAL
    // -------------------------------------------------------------------------
    // 4.1 Probation employee has 0 paid leave balance
    const probBalance = await getEmployeeLeaveBalance(employees['EMPLOYEE_PROB']._id);
    const probPass = probBalance.totalPaidLeaveBalance === 0;
    recordTest({
      id: 'MAT-PROB-01',
      category: 'Probation Policy',
      name: 'Probation Employee Zero Paid Leave Entitlement',
      expectedStatus: 200,
      actualStatus: probPass ? 200 : 500,
      result: probPass ? 'PASS' : 'FAIL',
      details: `Probation total paid balance: ${probBalance.totalPaidLeaveBalance}`,
    });

    // 4.2 Permanent employee monthly accrual (+1 Sick, +1 Casual)
    const accRes = await accrueMonthlyLeave(employees['EMPLOYEE_PERM']._id, 8, 2026);
    const permBalance = await getEmployeeLeaveBalance(employees['EMPLOYEE_PERM']._id);
    const permAccPass = accRes.accrued === true && permBalance.sickLeaveBalance === 1 && permBalance.casualLeaveBalance === 1;
    recordTest({
      id: 'MAT-PERM-01',
      category: 'Permanent Entitlement',
      name: 'Permanent Employee Monthly Leave Accrual (+1 S, +1 C)',
      expectedStatus: 200,
      actualStatus: permAccPass ? 200 : 500,
      result: permAccPass ? 'PASS' : 'FAIL',
      details: `Accrued: Sick ${permBalance.sickLeaveBalance}, Casual ${permBalance.casualLeaveBalance}`,
    });

    // -------------------------------------------------------------------------
    // MATRIX 5: 3-MONTH UNUSED LEAVE CONVERSION TO SALARY
    // -------------------------------------------------------------------------
    // Seed an accrual from 4 months ago (May 2026) for Permanent employee
    await new LeaveLedger({
      employee: employees['EMPLOYEE_PERM']._id,
      leaveType: 'Casual',
      transactionType: 'MonthlyAccrual',
      quantity: 2,
      balanceAfter: permBalance.totalPaidLeaveBalance + 2,
      earnedMonth: 4,
      earnedYear: 2026,
      notes: 'Historical unused leave for conversion test',
    }).save();

    const convRes = await convertThreeMonthUnusedLeaveToSalary(
      employees['EMPLOYEE_PERM']._id,
      8,
      2026,
      1000 // ₹1000/day
    );
    const convPass = convRes.convertedDays > 0 && convRes.convertedAmount === convRes.convertedDays * 1000;
    recordTest({
      id: 'MAT-LEAVE-CONV-01',
      category: 'Leave Conversion',
      name: '3-Month Unused Leave to Salary Earning Conversion',
      expectedStatus: 200,
      actualStatus: convPass ? 200 : 500,
      result: convPass ? 'PASS' : 'FAIL',
      details: `Converted ${convRes.convertedDays} days to ₹${convRes.convertedAmount} earning`,
    });

    // -------------------------------------------------------------------------
    // MATRIX 6: ATTENDANCE RULES (09:35 AM LATE & 12:00 PM NOON CUTOFF)
    // -------------------------------------------------------------------------
    const rOnTime: any = { checkInTime: '09:30', attendanceStatus: 'Present' };
    calculateAttendanceRecordState(rOnTime, policy);
    const rGrace: any = { checkInTime: '09:34', attendanceStatus: 'Present' };
    calculateAttendanceRecordState(rGrace, policy);
    const rLate: any = { checkInTime: '09:36', attendanceStatus: 'Present' };
    calculateAttendanceRecordState(rLate, policy);
    const rNoon: any = { checkInTime: '12:05', attendanceStatus: 'Present' };
    calculateAttendanceRecordState(rNoon, policy);

    const attRulesPass =
      rOnTime.isLate === false &&
      rGrace.isLate === false &&
      rLate.isLate === true &&
      rNoon.attendanceStatus === 'Half Day';

    recordTest({
      id: 'MAT-ATT-RULES-01',
      category: 'Attendance Rules',
      name: '9:35 AM Late Arrival & 12:00 PM Noon Half-Day Rules',
      expectedStatus: 200,
      actualStatus: attRulesPass ? 200 : 500,
      result: attRulesPass ? 'PASS' : 'FAIL',
      details: `09:30 (On Time), 09:34 (Grace), 09:36 (Late), 12:05 (HalfDay: ${rNoon.attendanceStatus})`,
    });

    // -------------------------------------------------------------------------
    // MATRIX 7: SALARY STRUCTURES & PF/ESI STATUTORY LIMITS
    // -------------------------------------------------------------------------
    const s1 = await req('POST', '/salary-structures/', tokens['ACCOUNTANT'], {
      employee: employees['EMPLOYEE_PERM']._id.toString(),
      grossSalary: 60000,
      basicSalary: 30000,
      hra: 15000,
      conveyance: 5000,
      specialAllowance: 10000,
      pfEnabled: true,
      pfEmployeePercent: 12,
      pfEmployerPercent: 12,
      pfWageCeiling: 15000, // Capped at ₹15,000 -> PF = ₹1,800
      esiEnabled: false,
      professionalTax: 200,
      tds: 1000,
    });
    recordTest({
      id: 'MAT-STRUCT-01',
      category: 'Salary Structure',
      name: 'Configure Employee Salary Structure & PF Cap',
      expectedStatus: 200,
      actualStatus: s1.status,
      result: s1.status === 200 ? 'PASS' : 'FAIL',
      details: `Configured Gross ₹${s1.body?.grossSalary}, Basic ₹${s1.body?.basicSalary}`,
    });

    // -------------------------------------------------------------------------
    // MATRIX 8: THREE-LATE ARRIVALS HALF-DAY DEDUCTION
    // -------------------------------------------------------------------------
    await AttendanceRecord.create({
      employee: employees['EMPLOYEE_PERM']._id,
      attendanceDate: new Date('2026-07-28T09:40:00.000+05:30'),
      checkInTime: '09:40',
      isLate: true,
      attendanceStatus: 'Present',
    });
    await AttendanceRecord.create({
      employee: employees['EMPLOYEE_PERM']._id,
      attendanceDate: new Date('2026-07-29T09:45:00.000+05:30'),
      checkInTime: '09:45',
      isLate: true,
      attendanceStatus: 'Present',
    });
    await AttendanceRecord.create({
      employee: employees['EMPLOYEE_PERM']._id,
      attendanceDate: new Date('2026-07-30T09:50:00.000+05:30'),
      checkInTime: '09:50',
      isLate: true,
      attendanceStatus: 'Present',
    });

    const pPreview = await req('POST', '/payroll/preview/', tokens['ACCOUNTANT'], {
      employee_id: employees['EMPLOYEE_PERM']._id.toString(),
      month: 8,
      year: 2026,
    });

    const threeLateDeduction = pPreview.body?.attendanceCycle?.lateHalfDayDeductions === 0.5;
    const pfIsCapped = pPreview.body?.pfEmployee === 1800; // 12% of 15,000

    recordTest({
      id: 'MAT-PAYROLL-01',
      category: 'Payroll Engine',
      name: '3 Late Arrivals Half-Day Deduction & Capped PF',
      expectedStatus: 200,
      actualStatus: pPreview.status === 200 && threeLateDeduction && pfIsCapped ? 200 : 500,
      result: pPreview.status === 200 && threeLateDeduction && pfIsCapped ? 'PASS' : 'FAIL',
      details: `Late Deduction: ${pPreview.body?.attendanceCycle?.lateHalfDayDeductions} days, PF: ₹${pPreview.body?.pfEmployee}`,
    });

    // -------------------------------------------------------------------------
    // MATRIX 9: PAYROLL CYCLE PROCESSING & IMMUTABILITY
    // -------------------------------------------------------------------------
    const pProcess = await req('POST', '/payroll/process-cycle/', tokens['ACCOUNTANT'], {
      month: 8,
      year: 2026,
    });
    const payrollId = pProcess.body?.results?.[0]?._id;

    // Approve payroll
    const pApprove = await req('POST', `/payroll/${payrollId}/approve/`, tokens['ACCOUNTANT']);
    const approvedPass = pApprove.status === 200 && pApprove.body?.status === 'Approved';

    // Verify immutability: bulk rerun does not overwrite approved record
    await req('POST', '/payroll/process-cycle/', tokens['ACCOUNTANT'], {
      month: 8,
      year: 2026,
    });
    const verifiedRecord = await PayrollRecord.findById(payrollId);
    const immutabilityPass = verifiedRecord?.status === 'Approved';

    recordTest({
      id: 'MAT-IMMUTABLE-01',
      category: 'Payroll Immutability',
      name: 'Approved Payroll Record Immutability Verification',
      expectedStatus: 200,
      actualStatus: approvedPass && immutabilityPass ? 200 : 500,
      result: approvedPass && immutabilityPass ? 'PASS' : 'FAIL',
      details: 'Approved payroll status retained and protected against bulk overwrites',
    });

    // -------------------------------------------------------------------------
    // MATRIX 10: PAYROLL REPORTS ENDPOINTS
    // -------------------------------------------------------------------------
    const repSummary = await req('GET', '/payroll/reports/summary/?month=8&year=2026', tokens['ACCOUNTANT']);
    const repStatutory = await req('GET', '/payroll/reports/statutory/?month=8&year=2026', tokens['ACCOUNTANT']);
    const repImpact = await req('GET', '/payroll/reports/attendance-impact/?month=8&year=2026', tokens['ACCOUNTANT']);
    const repConv = await req('GET', '/payroll/reports/leave-conversion/?year=2026', tokens['ACCOUNTANT']);

    const reportsPass =
      repSummary.status === 200 &&
      repStatutory.status === 200 &&
      repImpact.status === 200 &&
      repConv.status === 200;

    recordTest({
      id: 'MAT-REPORTS-01',
      category: 'Payroll Reports',
      name: 'Enterprise Summary, Statutory & Leave Reports API',
      expectedStatus: 200,
      actualStatus: reportsPass ? 200 : 500,
      result: reportsPass ? 'PASS' : 'FAIL',
      details: `Summary: ${repSummary.status}, Statutory: ${repStatutory.status}, Impact: ${repImpact.status}, Conversion: ${repConv.status}`,
    });

    // -------------------------------------------------------------------------
    // MATRIX 11: SECURITY, RBAC & IDOR PREVENTIONS
    // -------------------------------------------------------------------------
    // Employee cannot view other employee's payroll
    const idorRes = await req('GET', `/payroll/${payrollId}/`, tokens['EMPLOYEE_PROB']);
    recordTest({
      id: 'MAT-SEC-IDOR-01',
      category: 'Security & IDOR',
      name: 'Cross-Employee Payroll IDOR Block (HTTP 403)',
      expectedStatus: 403,
      actualStatus: idorRes.status,
      result: idorRes.status === 403 ? 'PASS' : 'FAIL',
      details: 'Unauthorized employee blocked with HTTP 403 Forbidden',
    });

    // Regular employee cannot approve payroll
    const approveSec = await req('POST', `/payroll/${payrollId}/approve/`, tokens['EMPLOYEE_PERM']);
    recordTest({
      id: 'MAT-SEC-RBAC-01',
      category: 'Security & RBAC',
      name: 'Non-Management Payroll Approval Block (HTTP 403)',
      expectedStatus: 403,
      actualStatus: approveSec.status,
      result: approveSec.status === 403 ? 'PASS' : 'FAIL',
      details: 'Non-management user blocked with HTTP 403 Forbidden',
    });

    console.log('================================================================================');
    console.log(`=== ALL ${matrixResults.length} ENTERPRISE MATRIX SUITE TESTS COMPLETED ===`);
    console.log('================================================================================');

  } catch (err) {
    console.error('[Enterprise Matrix Error]', err);
  } finally {
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  }
}

runEnterpriseMatrixSuite();
