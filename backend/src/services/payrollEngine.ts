import mongoose from 'mongoose';
import { AttendanceRecord } from '../models/AttendanceRecord.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { CompanyHoliday } from '../models/CompanyHoliday.js';
import { Employee } from '../models/Employee.js';
import { IEmployeeSalaryStructure } from '../models/EmployeeSalaryStructure.js';
import { IAttendanceCycleSnapshot, ISalarySnapshot } from '../models/PayrollRecord.js';
import { AttendanceCycleInfo, getISTDateString, getCompanyStartOfDay, getCompanyEndOfDay } from '../utils/tzUtils.js';
import { convertThreeMonthUnusedLeaveToSalary } from './leaveEngine.js';
import { evaluateFormula } from '../utils/formulaEvaluator.js';

export interface CalculatedPayrollResult {
  attendanceCycle: IAttendanceCycleSnapshot;
  salarySnapshot: ISalarySnapshot;
  grossSalary: number;
  totalEarnings: number;
  attendanceDeduction: number;
  pfEmployee: number;
  pfEmployer: number;
  esiEmployee: number;
  esiEmployer: number;
  professionalTax: number;
  tds: number;
  totalDeductions: number;
  netSalary: number;
  employerCost: number;
  leaveConversionAmount?: number;
  leaveConversionDays?: number;
}

/**
 * Summarizes attendance facts for an employee across a specific attendance cycle in Asia/Kolkata.
 * Cycle: 26th of previous month to 25th of current month.
 * Accounts for joining date and exit date proration, probation leave rules, and 3-late half-day deductions.
 */
export async function calculateAttendanceForCycle(
  employeeId: mongoose.Types.ObjectId,
  cycle: AttendanceCycleInfo
): Promise<IAttendanceCycleSnapshot> {
  const emp = await Employee.findById(employeeId);
  const isProbation = emp?.employmentStatus === 'Probation';
  const joiningDateStr = emp?.joiningDate ? getISTDateString(emp.joiningDate) : null;
  const exitDateStr = emp?.exitDate ? getISTDateString(emp.exitDate) : null;

  // Fetch all attendance records in cycle range
  const records = await AttendanceRecord.find({
    employee: employeeId,
    attendanceDate: { $gte: cycle.cycleStart, $lte: cycle.cycleEnd },
  });

  // Fetch approved leaves in cycle range
  const leaves = await LeaveRequest.find({
    employee: employeeId,
    status: 'Approved',
    startDate: { $lte: cycle.cycleEnd },
    endDate: { $gte: cycle.cycleStart },
  });

  // Fetch company holidays in cycle range
  const holidays = await CompanyHoliday.find({
    isActive: true,
    date: { $gte: cycle.cycleStart, $lte: cycle.cycleEnd },
  });

  const holidayDateMap = new Set(holidays.map((h) => h.dateStr));
  const recordMap = new Map<string, any>();
  records.forEach((r) => {
    const dStr = getISTDateString(r.attendanceDate);
    recordMap.set(dStr, r);
  });

  let workingDays = 0;
  let weekOffs = 0;
  let companyHolidays = 0;
  let presentDays = 0;
  let halfDays = 0;
  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  let absentDays = 0;
  let lateArrivalsCount = 0;

  // Iterate day-by-day from cycleStart to cycleEnd in IST
  let cur = new Date(cycle.cycleStart.getTime());
  const end = cycle.cycleEnd.getTime();

  while (cur.getTime() <= end) {
    const dStr = getISTDateString(cur);
    const dayOfWeek = cur.getDay(); // 0 is Sunday

    const isSunday = dayOfWeek === 0;
    const isHoliday = holidayDateMap.has(dStr);

    // Proration check: If day is before joining date or after exit date, mark as unpaid absent
    const isBeforeJoining = joiningDateStr && dStr < joiningDateStr;
    const isAfterExit = exitDateStr && dStr > exitDateStr;

    if (isBeforeJoining || isAfterExit) {
      absentDays += 1;
      cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
      continue;
    }

    if (isSunday) {
      weekOffs += 1;
    } else if (isHoliday) {
      companyHolidays += 1;
    } else {
      workingDays += 1;
    }

    const rec = recordMap.get(dStr);

    if (rec && rec.checkInTime) {
      // Check late arrival (> 9:35 AM IST)
      if (rec.isLate) {
        lateArrivalsCount += 1;
      }

      if (rec.attendanceStatus === 'Half Day') {
        halfDays += 1;
      } else {
        presentDays += 1;
      }
    } else {
      // No check-in recorded for this day
      if (!isSunday && !isHoliday) {
        // Check if there is an approved leave covering this day
        const leaveMatch = leaves.find((l) => {
          const lStart = getISTDateString(l.startDate);
          const lEnd = getISTDateString(l.endDate);
          return dStr >= lStart && dStr <= lEnd;
        });

        if (leaveMatch) {
          // Probation employees have 0 paid leave -> always unpaid
          if (isProbation || leaveMatch.leaveType === 'Unpaid') {
            unpaidLeaveDays += 1;
          } else {
            paidLeaveDays += 1;
          }
        } else {
          absentDays += 1;
        }
      }
    }

    // Advance 1 calendar day
    cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
  }

  // Calculate 3-late arrivals half-day deduction rule
  // Every 3 late arrivals = 0.5 day deduction
  const lateHalfDayDeductions = Math.floor(lateArrivalsCount / 3) * 0.5;

  // Total payable days = present + holidays (paid) + weekOffs (paid) + paidLeaves + (halfDays * 0.5) - lateHalfDayDeductions
  const effectivePresentDays =
    presentDays + companyHolidays + weekOffs + paidLeaveDays + halfDays * 0.5 - lateHalfDayDeductions;

  const payableDays = Math.max(0, Math.min(cycle.totalCalendarDays, Math.round(effectivePresentDays * 100) / 100));
  const unpaidDays = Math.max(0, Math.round((cycle.totalCalendarDays - payableDays) * 100) / 100);

  return {
    cycleName: cycle.cycleName,
    startStr: cycle.startStr,
    endStr: cycle.endStr,
    cycleStart: cycle.cycleStart,
    cycleEnd: cycle.cycleEnd,
    totalCalendarDays: cycle.totalCalendarDays,
    workingDays,
    weekOffs,
    companyHolidays,
    presentDays,
    halfDays,
    paidLeaveDays,
    unpaidLeaveDays,
    absentDays,
    lateArrivalsCount,
    lateHalfDayDeductions,
    payableDays,
    unpaidDays,
  };
}

/**
 * Computes deterministic payroll breakdown for an employee based on their salary structure, attendance, explicit statutory flags, and leave conversions.
 */
export async function computePayroll(
  structure: IEmployeeSalaryStructure,
  attendance: IAttendanceCycleSnapshot,
  month: number = 8,
  year: number = 2026
): Promise<CalculatedPayrollResult> {
  const grossSalary = structure.grossSalary || 0;
  const basicSalary = structure.basicSalary || 0;
  const totalDays = attendance.totalCalendarDays || 30;

  // Daily rate for unpaid days deduction
  const perDaySalary = totalDays > 0 ? grossSalary / totalDays : 0;
  const attendanceDeduction = Math.round(perDaySalary * attendance.unpaidDays * 100) / 100;

  // Check 3-month unused leave conversion
  const dailyRate = totalDays > 0 ? (basicSalary || grossSalary) / totalDays : 0;
  const conversion = await convertThreeMonthUnusedLeaveToSalary(
    structure.employee,
    month,
    year,
    Math.round(dailyRate * 100) / 100
  );

  // Context map for formula evaluation
  const formulaContext: Record<string, number> = {
    GROSS: grossSalary,
    BASIC: basicSalary,
    HRA: structure.hra || 0,
    CONVEYANCE: structure.conveyance || 0,
    SPECIAL: structure.specialAllowance || 0,
    OTHER: structure.otherAllowances || 0,
  };

  // 1. Statutory PF Calculation
  // Controlled explicitly by pfApplicable (or pfEnabled)
  const isPfApplicable = structure.pfApplicable !== undefined ? structure.pfApplicable : structure.pfEnabled;
  let pfEmployee = 0;
  let pfEmployer = 0;

  if (isPfApplicable) {
    let pfWageBase = basicSalary;
    // If voluntary PF above ceiling is false, cap at 15000
    if (!structure.voluntaryPfAboveCeiling && structure.pfWageCeiling && structure.pfWageCeiling > 0) {
      pfWageBase = Math.min(pfWageBase, structure.pfWageCeiling);
    }
    pfEmployee = Math.round(pfWageBase * ((structure.pfEmployeePercent || 12) / 100));
    pfEmployer = Math.round(pfWageBase * ((structure.pfEmployerPercent || 12) / 100));
  }

  // 2. Statutory ESI Calculation
  // Controlled explicitly by esiApplicable (or esiEnabled)
  const isEsiApplicable = structure.esiApplicable !== undefined ? structure.esiApplicable : structure.esiEnabled;
  let esiEmployee = 0;
  let esiEmployer = 0;

  if (isEsiApplicable) {
    // Only applies if grossSalary <= esiGrossCeiling (default 21000)
    const ceiling = structure.esiGrossCeiling || 21000;
    if (grossSalary <= ceiling) {
      esiEmployee = Math.ceil(grossSalary * ((structure.esiEmployeePercent || 0.75) / 100));
      esiEmployer = Math.ceil(grossSalary * ((structure.esiEmployerPercent || 3.25) / 100));
    }
  }

  // 3. Professional Tax (Kerala / India Slabs)
  const isPtApplicable = structure.professionalTaxApplicable !== undefined ? structure.professionalTaxApplicable : true;
  const professionalTax = isPtApplicable ? (structure.professionalTax || 200) : 0;

  // 4. Tax Deducted at Source (TDS)
  const isTdsApplicable = structure.tdsApplicable !== undefined ? structure.tdsApplicable : false;
  const tds = isTdsApplicable ? (structure.tds || 0) : 0;

  // 5. Earnings Breakdown
  const earnings: Array<{ code: string; name: string; amount: number }> = [
    { code: 'BASIC', name: 'Basic Salary', amount: basicSalary },
    { code: 'HRA', name: 'House Rent Allowance (HRA)', amount: structure.hra || 0 },
  ];
  if (structure.conveyance) earnings.push({ code: 'CONVEYANCE', name: 'Conveyance Allowance', amount: structure.conveyance });
  if (structure.specialAllowance) earnings.push({ code: 'SPECIAL_ALLOWANCE', name: 'Special Allowance', amount: structure.specialAllowance });
  if (structure.otherAllowances) earnings.push({ code: 'OTHER_ALLOWANCES', name: 'Other Allowances', amount: structure.otherAllowances });
  if (conversion.convertedAmount > 0) {
    earnings.push({
      code: 'LEAVE_CONV',
      name: `Leave Conversion (${conversion.convertedDays} days)`,
      amount: conversion.convertedAmount,
    });
  }

  // 6. Deductions Breakdown
  const deductions: Array<{ code: string; name: string; amount: number }> = [];
  if (attendanceDeduction > 0) {
    deductions.push({ code: 'ATTENDANCE_DED', name: 'Attendance / LOP Deduction', amount: attendanceDeduction });
  }
  if (pfEmployee > 0) {
    deductions.push({ code: 'PF_EMPLOYEE', name: 'Provident Fund (Employee 12%)', amount: pfEmployee });
  }
  if (esiEmployee > 0) {
    deductions.push({ code: 'ESI_EMPLOYEE', name: 'ESI (Employee 0.75%)', amount: esiEmployee });
  }
  if (professionalTax > 0) {
    deductions.push({ code: 'PROF_TAX', name: 'Professional Tax (Kerala)', amount: professionalTax });
  }
  if (tds > 0) {
    deductions.push({ code: 'TDS', name: 'Tax Deducted at Source (TDS)', amount: tds });
  }

  // 7. Employer Contributions
  const employerContributions: Array<{ code: string; name: string; amount: number }> = [];
  if (pfEmployer > 0) {
    employerContributions.push({ code: 'PF_EMPLOYER', name: 'Provident Fund (Employer 12%)', amount: pfEmployer });
  }
  if (esiEmployer > 0) {
    employerContributions.push({ code: 'ESI_EMPLOYER', name: 'ESI (Employer 3.25%)', amount: esiEmployer });
  }

  // 8. Custom Salary Heads (with Formula Evaluation if configured)
  if (structure.customHeads && Array.isArray(structure.customHeads)) {
    structure.customHeads.forEach((ch: any) => {
      let finalAmount = ch.amount || 0;
      if (ch.formula) {
        finalAmount = evaluateFormula(ch.formula, formulaContext);
      }
      if (ch.type === 'Earning') {
        earnings.push({ code: ch.headCode, name: ch.name, amount: finalAmount });
      } else if (ch.type === 'Deduction') {
        deductions.push({ code: ch.headCode, name: ch.name, amount: finalAmount });
      } else if (ch.type === 'EmployerContribution') {
        employerContributions.push({ code: ch.headCode, name: ch.name, amount: finalAmount });
      }
    });
  }

  const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
  const totalEarnings = grossSalary + (conversion.convertedAmount || 0);
  const netSalary = Math.max(0, Math.round((totalEarnings - totalDeductions) * 100) / 100);
  const employerCost = Math.round((totalEarnings + pfEmployer + esiEmployer) * 100) / 100;

  const salarySnapshot: ISalarySnapshot = {
    basicSalary,
    hra: structure.hra || 0,
    conveyance: structure.conveyance || 0,
    specialAllowance: structure.specialAllowance || 0,
    otherAllowances: structure.otherAllowances || 0,
    grossSalary,
    earnings,
    deductions,
    employerContributions,
  };

  return {
    attendanceCycle: attendance,
    salarySnapshot,
    grossSalary,
    totalEarnings,
    attendanceDeduction,
    pfEmployee,
    pfEmployer,
    esiEmployee,
    esiEmployer,
    professionalTax,
    tds,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
    netSalary,
    employerCost,
    leaveConversionAmount: conversion.convertedAmount,
    leaveConversionDays: conversion.convertedDays,
  };
}
