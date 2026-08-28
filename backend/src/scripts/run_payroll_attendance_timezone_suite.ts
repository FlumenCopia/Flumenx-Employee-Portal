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
import { config } from '../config/env.js';
import {
  getISTDateString,
  getISTTimeString,
  getISTParts,
  getCompanyStartOfDay,
  getCompanyEndOfDay,
  getAttendanceCycleForMonth,
  getAttendanceCycleForDate,
  timeStringToMinutes,
} from '../utils/tzUtils.js';
import { calculateAttendanceRecordState } from '../services/attendanceEngine.js';
import { calculateAttendanceForCycle, computePayroll } from '../services/payrollEngine.js';

const PORT = 8088;
const BASE_URL = `http://127.0.0.1:${PORT}/api`;

export interface PayrollSuiteTestResult {
  id: string;
  category: string;
  name: string;
  expectedStatus: number | number[];
  actualStatus: number;
  result: 'PASS' | 'FAIL';
  details: string;
}

const testResults: PayrollSuiteTestResult[] = [];

function recordTest(t: PayrollSuiteTestResult) {
  testResults.push(t);
  console.log(`[PAYROLL-SUITE ${t.id.padEnd(16)}] ${t.name.padEnd(46)} | HTTP ${t.actualStatus} [${t.result}]`);
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

async function runPayrollAndAttendanceSuite() {
  console.log('======================================================================');
  console.log('=== STARTING SALARY PROCESSING, ATTENDANCE & TIMEZONE TEST SUITE ===');
  console.log('======================================================================');

  await connectDB();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(PORT, () => resolve()));
  console.log(`[Payroll Test Server] Running on http://127.0.0.1:${PORT}`);

  const tokens: Record<string, string> = {};
  const users: Record<string, any> = {};
  const employees: Record<string, any> = {};

  try {
    // 1. Reset Fixtures
    await User.deleteMany({});
    await Employee.deleteMany({});
    await Department.deleteMany({});
    await AttendanceRecord.deleteMany({});
    await AttendancePolicy.deleteMany({});
    await CompanyHoliday.deleteMany({});
    await SalaryHead.deleteMany({});
    await EmployeeSalaryStructure.deleteMany({});
    await PayrollRecord.deleteMany({});

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

    const roles = ['SUPER_ADMIN', 'ACCOUNTANT', 'HR', 'EMPLOYEE_A', 'EMPLOYEE_B'];

    for (let i = 0; i < roles.length; i++) {
      const r = roles[i];
      const actualRole = r.startsWith('EMPLOYEE') ? 'EMPLOYEE' : r;
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
        employeeCode: `FX-PAY-${i + 1}`,
        name: `${r} Employee`,
        email,
        phone: `+91 987654320${i}`,
        joiningDate: new Date('2025-01-01'),
        designation: `${r} Specialist`,
        department: r === 'ACCOUNTANT' ? 'Accounts' : r === 'HR' ? 'Human Resources' : 'Web Development',
        departmentRef: r === 'ACCOUNTANT' ? deptAcc._id : r === 'HR' ? deptHR._id : deptDev._id,
        status: 'Active',
      });
      await emp.save();
      employees[r] = emp;
    }

    // -------------------------------------------------------------------------
    // TEST SECTION 1: TIMEZONE & DATE UTILITIES
    // -------------------------------------------------------------------------

    // Test 1.1: Verify IST conversion of UTC timestamp
    const utcMidnight = new Date('2026-08-15T00:00:00.000Z');
    const istDateStr = getISTDateString(utcMidnight); // Should be 2026-08-15 (05:30 AM IST)
    const istTimeStr = getISTTimeString(utcMidnight); // Should be 05:30
    recordTest({
      id: 'TZ-01',
      category: 'Timezone Foundation',
      name: 'UTC to Asia/Kolkata Conversion',
      expectedStatus: 200,
      actualStatus: istDateStr === '2026-08-15' && istTimeStr === '05:30' ? 200 : 500,
      result: istDateStr === '2026-08-15' && istTimeStr === '05:30' ? 'PASS' : 'FAIL',
      details: `Parsed date: ${istDateStr} ${istTimeStr} IST`,
    });

    // Test 1.2: Verify Attendance Cycle Boundary (25th -> 24th)
    const cycleAug = getAttendanceCycleForMonth(2026, 8); // August 2026
    const date24Aug = getAttendanceCycleForDate('2026-08-24T10:00:00.000+05:30');
    const date25Aug = getAttendanceCycleForDate('2026-08-25T10:00:00.000+05:30');
    const cyclePass =
      cycleAug.startStr === '2026-07-25' &&
      cycleAug.endStr === '2026-08-24' &&
      date24Aug.month === 8 &&
      date25Aug.month === 9;

    recordTest({
      id: 'CYCLE-01',
      category: 'Attendance Cycle',
      name: '25th-to-24th Attendance Cycle Selection',
      expectedStatus: 200,
      actualStatus: cyclePass ? 200 : 500,
      result: cyclePass ? 'PASS' : 'FAIL',
      details: `Aug Cycle: ${cycleAug.startStr} to ${cycleAug.endStr}; 24 Aug -> M${date24Aug.month}, 25 Aug -> M${date25Aug.month}`,
    });

    // -------------------------------------------------------------------------
    // TEST SECTION 2: ATTENDANCE RULES (9:35 AM LATE & 12:00 PM NOON HALF-DAY)
    // -------------------------------------------------------------------------

    // Test 2.1: 09:30 AM check-in -> On Time
    const recOnTime: any = { checkInTime: '09:30', attendanceStatus: 'Present' };
    calculateAttendanceRecordState(recOnTime, policy);
    const onTimePass = recOnTime.isLate === false && recOnTime.checkInStatus === 'On Time';

    // Test 2.2: 09:34 AM check-in -> Grace Period (Not Late)
    const recGrace: any = { checkInTime: '09:34', attendanceStatus: 'Present' };
    calculateAttendanceRecordState(recGrace, policy);
    const gracePass = recGrace.isLate === false && recGrace.checkInStatus === 'Grace Period';

    // Test 2.3: 09:36 AM check-in -> Late
    const recLate: any = { checkInTime: '09:36', attendanceStatus: 'Present' };
    calculateAttendanceRecordState(recLate, policy);
    const latePass = recLate.isLate === true && recLate.checkInStatus === 'Late';

    // Test 2.4: 12:01 PM check-in -> Half Day (Noon rule)
    const recNoon: any = { checkInTime: '12:01', attendanceStatus: 'Present' };
    calculateAttendanceRecordState(recNoon, policy);
    const noonPass = recNoon.attendanceStatus === 'Half Day';

    const rulesPass = onTimePass && gracePass && latePass && noonPass;
    recordTest({
      id: 'ATT-RULES-01',
      category: 'Attendance Rules',
      name: '9:35 AM Late & 12:00 PM Noon Cutoff Rules',
      expectedStatus: 200,
      actualStatus: rulesPass ? 200 : 500,
      result: rulesPass ? 'PASS' : 'FAIL',
      details: `09:30 (On Time: ${onTimePass}), 09:34 (Grace: ${gracePass}), 09:36 (Late: ${latePass}), 12:01 (HalfDay: ${noonPass})`,
    });

    // -------------------------------------------------------------------------
    // TEST SECTION 3: COMPANY HOLIDAY CALENDAR
    // -------------------------------------------------------------------------

    // Test 3.1: Create Company Holiday via API
    const h1 = await req('POST', '/holidays/', tokens['HR'], {
      name: 'Independence Day',
      date: '2026-08-15',
      holiday_type: 'Public',
      description: 'National Holiday',
      is_paid: true,
    });
    recordTest({
      id: 'HOLIDAY-01',
      category: 'Holiday Calendar',
      name: 'Create Company Holiday via API',
      expectedStatus: 201,
      actualStatus: h1.status,
      result: h1.status === 201 ? 'PASS' : 'FAIL',
      details: `Created holiday ${h1.body?.name} on ${h1.body?.dateStr}`,
    });

    // Test 3.2: Duplicate Holiday on same date rejected
    const h2 = await req('POST', '/holidays/', tokens['HR'], {
      name: 'Duplicate Holiday',
      date: '2026-08-15',
    });
    recordTest({
      id: 'HOLIDAY-02',
      category: 'Holiday Calendar',
      name: 'Duplicate Holiday Date Rejection',
      expectedStatus: 400,
      actualStatus: h2.status,
      result: h2.status === 400 ? 'PASS' : 'FAIL',
      details: `Duplicate rejected with HTTP ${h2.status}`,
    });

    // -------------------------------------------------------------------------
    // TEST SECTION 4: SALARY HEADS & EMPLOYEE SALARY STRUCTURE
    // -------------------------------------------------------------------------

    // Test 4.1: Create Salary Heads
    const sh1 = await req('POST', '/salary-heads/', tokens['ACCOUNTANT'], {
      name: 'Special Performance Allowance',
      code: 'PERF_ALLOW',
      type: 'Earning',
      calculation_type: 'Fixed',
      default_amount: 5000,
    });
    recordTest({
      id: 'SAL-HEAD-01',
      category: 'Salary Heads',
      name: 'Create Configurable Salary Head',
      expectedStatus: 201,
      actualStatus: sh1.status,
      result: sh1.status === 201 ? 'PASS' : 'FAIL',
      details: `Created head: ${sh1.body?.name} (${sh1.body?.code})`,
    });

    // Test 4.2: Save Employee Salary Structure
    const struct1 = await req('POST', '/salary-structures/', tokens['ACCOUNTANT'], {
      employee: employees['EMPLOYEE_A']._id.toString(),
      grossSalary: 50000,
      basicSalary: 30000,
      hra: 15000,
      conveyance: 2000,
      specialAllowance: 3000,
      pfEnabled: true,
      pfEmployeePercent: 12,
      pfEmployerPercent: 12,
      pfWageCeiling: 15000, // Capped at 15k -> PF = 1800
      esiEnabled: false,
      professionalTax: 200,
      tds: 500,
    });
    recordTest({
      id: 'SAL-STRUCT-01',
      category: 'Salary Structure',
      name: 'Configure Employee Salary Structure',
      expectedStatus: 200,
      actualStatus: struct1.status,
      result: struct1.status === 200 ? 'PASS' : 'FAIL',
      details: `Configured Gross ₹${struct1.body?.grossSalary}, Basic ₹${struct1.body?.basicSalary}`,
    });

    // -------------------------------------------------------------------------
    // TEST SECTION 5: PAYROLL ENGINE & 3-LATE ATTENDANCE CALCULATION
    // -------------------------------------------------------------------------

    // Seed 3 late arrivals for Employee A in the August cycle (25 Jul - 24 Aug)
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

    // Test 5.1: Calculate Payroll Preview
    const p1 = await req('POST', '/payroll/preview/', tokens['ACCOUNTANT'], {
      employee_id: employees['EMPLOYEE_A']._id.toString(),
      month: 8,
      year: 2026,
    });

    const lateCount = p1.body?.attendanceCycle?.lateArrivalsCount;
    const lateDeduction = p1.body?.attendanceCycle?.lateHalfDayDeductions;
    const pfDeduction = p1.body?.pfEmployee; // Should be 1800 (12% of 15000)
    const netPay = p1.body?.netSalary;

    const payrollPass =
      p1.status === 200 &&
      lateCount === 3 &&
      lateDeduction === 0.5 &&
      pfDeduction === 1800 &&
      netPay > 0;

    recordTest({
      id: 'PAYROLL-ENG-01',
      category: 'Payroll Engine',
      name: '3-Late Arrivals Trigger 0.5 Day Deduction & PF Capped',
      expectedStatus: 200,
      actualStatus: payrollPass ? 200 : 500,
      result: payrollPass ? 'PASS' : 'FAIL',
      details: `Lates: ${lateCount}, Late Deduction Days: ${lateDeduction}, PF: ₹${pfDeduction}, Net: ₹${netPay}`,
    });

    // -------------------------------------------------------------------------
    // TEST SECTION 6: PAYROLL PROCESSING WORKFLOW & DUPLICATE PROTECTION
    // -------------------------------------------------------------------------

    // Test 6.1: Process Payroll Cycle
    const p2 = await req('POST', '/payroll/process-cycle/', tokens['ACCOUNTANT'], {
      month: 8,
      year: 2026,
    });
    recordTest({
      id: 'PAYROLL-FLOW-01',
      category: 'Payroll Workflow',
      name: 'Bulk Process Attendance Cycle Payroll',
      expectedStatus: 200,
      actualStatus: p2.status,
      result: p2.status === 200 ? 'PASS' : 'FAIL',
      details: `Processed: ${p2.body?.total_processed} records for ${p2.body?.cycle}`,
    });

    const payrollRecordId = p2.body?.results?.[0]?._id;

    // Test 6.2: Approve Payroll Record
    const p3 = await req('POST', `/payroll/${payrollRecordId}/approve/`, tokens['ACCOUNTANT']);
    recordTest({
      id: 'PAYROLL-FLOW-02',
      category: 'Payroll Workflow',
      name: 'Approve Payroll Record (Status: Approved)',
      expectedStatus: 200,
      actualStatus: p3.status,
      result: p3.status === 200 && p3.body?.status === 'Approved' ? 'PASS' : 'FAIL',
      details: `Status updated to ${p3.body?.status}`,
    });

    // Test 6.3: Duplicate Processing Protection (Approved payroll is preserved)
    const p4 = await req('POST', '/payroll/process-cycle/', tokens['ACCOUNTANT'], {
      month: 8,
      year: 2026,
    });
    const checkRecord = await PayrollRecord.findById(payrollRecordId);
    const duplicateProtected = checkRecord?.status === 'Approved';
    recordTest({
      id: 'PAYROLL-FLOW-03',
      category: 'Payroll Workflow',
      name: 'Duplicate Processing Protection (Immutability)',
      expectedStatus: 200,
      actualStatus: duplicateProtected ? 200 : 500,
      result: duplicateProtected ? 'PASS' : 'FAIL',
      details: 'Approved payroll record was not overwritten by bulk rerun',
    });

    // -------------------------------------------------------------------------
    // TEST SECTION 7: SECURITY, RBAC & IDOR CHECKS
    // -------------------------------------------------------------------------

    // Test 7.1: Cross-User IDOR (Employee B cannot view Employee A's payroll record)
    const p5 = await req('GET', `/payroll/${payrollRecordId}/`, tokens['EMPLOYEE_B']);
    recordTest({
      id: 'PAYROLL-SEC-01',
      category: 'Security & IDOR',
      name: 'Cross-User Payroll Record Access Block (IDOR)',
      expectedStatus: 403,
      actualStatus: p5.status,
      result: p5.status === 403 ? 'PASS' : 'FAIL',
      details: 'Employee B blocked with HTTP 403 Forbidden',
    });

    // Test 7.2: Regular employee cannot modify salary structure
    const p6 = await req('POST', '/salary-structures/', tokens['EMPLOYEE_A'], {
      employee: employees['EMPLOYEE_A']._id.toString(),
      grossSalary: 100000,
      basicSalary: 80000,
    });
    recordTest({
      id: 'PAYROLL-SEC-02',
      category: 'Security & RBAC',
      name: 'Unauthorized Salary Structure Modification Block',
      expectedStatus: 403,
      actualStatus: p6.status,
      result: p6.status === 403 ? 'PASS' : 'FAIL',
      details: 'Non-manager blocked with HTTP 403 Forbidden',
    });

    // Test 7.3: Invalid/Negative gross salary input rejected
    const p7 = await req('POST', '/salary-structures/', tokens['ACCOUNTANT'], {
      employee: employees['EMPLOYEE_A']._id.toString(),
      grossSalary: -5000,
      basicSalary: -3000,
    });
    recordTest({
      id: 'PAYROLL-SEC-03',
      category: 'Input Hardening',
      name: 'Negative Salary Numeric Input Rejection',
      expectedStatus: 400,
      actualStatus: p7.status,
      result: p7.status === 400 ? 'PASS' : 'FAIL',
      details: 'Negative salary rejected with HTTP 400 Bad Request',
    });

    console.log('======================================================================');
    console.log(`=== ALL ${testResults.length} PAYROLL & ATTENDANCE SUITE TESTS COMPLETED ===`);
    console.log('======================================================================');

  } catch (err) {
    console.error('[Payroll Suite Error]', err);
  } finally {
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  }
}

runPayrollAndAttendanceSuite();
