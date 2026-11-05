import mongoose from 'mongoose';
import { Employee } from '../models/Employee.js';
import { LeaveLedger } from '../models/LeaveLedger.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { PayrollSetting } from '../models/PayrollSetting.js';
import { getAttendanceCycleForMonth, getAttendanceCycleForDate, AttendanceCycleInfo } from '../utils/tzUtils.js';

export interface EmployeeLeaveBalanceSummary {
  employeeId: string;
  employmentStatus: string;
  sickLeaveBalance: number;
  casualLeaveBalance: number;
  totalPaidLeaveBalance: number;
  monthlyPaidQuota: number;
  availedThisMonth: number;
  carriedForwardBalance: number;
  convertedToSalary: number;
  cyclePeriod?: string;
  cycleMonth?: number;
  cycleYear?: number;
}

/**
 * Returns current active leave balance for an employee.
 * Follows Flumenx Company Policy: Salary and Leave cycle is evaluated from the 26th of (Month - 1) to the 25th of Month in IST.
 * Probation employees have strictly 0 paid leave balance.
 */
export async function getEmployeeLeaveBalance(
  employeeId: mongoose.Types.ObjectId,
  year?: number,
  month?: number
): Promise<EmployeeLeaveBalanceSummary> {
  const emp = await Employee.findById(employeeId);
  if (!emp) {
    return {
      employeeId: employeeId.toString(),
      employmentStatus: 'Unknown',
      sickLeaveBalance: 0,
      casualLeaveBalance: 0,
      totalPaidLeaveBalance: 0,
      monthlyPaidQuota: 0,
      availedThisMonth: 0,
      carriedForwardBalance: 0,
      convertedToSalary: 0,
    };
  }

  // Company Policy: Salary and Leave cycle strictly follows the 26th of (Month - 1) to 25th of Month
  const cycle: AttendanceCycleInfo = (year && month)
    ? getAttendanceCycleForMonth(year, month)
    : getAttendanceCycleForDate(new Date());

  const { cycleStart, cycleEnd } = cycle;
  const currentMonth = cycle.month;
  const currentYear = cycle.year;

  if (emp.employmentStatus === 'Probation') {
    return {
      employeeId: employeeId.toString(),
      employmentStatus: 'Probation',
      sickLeaveBalance: 0,
      casualLeaveBalance: 0,
      totalPaidLeaveBalance: 0,
      monthlyPaidQuota: 0,
      availedThisMonth: 0,
      carriedForwardBalance: 0,
      convertedToSalary: 0,
      cyclePeriod: cycle.readablePeriod,
      cycleMonth: currentMonth,
      cycleYear: currentYear,
    };
  }

  let transactions = await LeaveLedger.find({ employee: employeeId }).sort({ transactionDate: 1 });

  // If permanent employee has no ledger records, auto-seed 1 Sick + 1 Casual opening balance
  if (emp.employmentStatus === 'Permanent' && transactions.length === 0) {
    const joinYear = emp.joiningDate ? new Date(emp.joiningDate).getFullYear() : currentYear;
    const joinMonth = emp.joiningDate ? new Date(emp.joiningDate).getMonth() + 1 : currentMonth;

    const opSick = new LeaveLedger({
      employee: employeeId,
      leaveType: 'Sick',
      transactionType: 'OpeningBalance',
      quantity: 1,
      balanceAfter: 1,
      earnedMonth: joinMonth,
      earnedYear: joinYear,
      notes: 'Initial monthly sick leave balance (Auto-initialized)',
    });
    const opCasual = new LeaveLedger({
      employee: employeeId,
      leaveType: 'Casual',
      transactionType: 'OpeningBalance',
      quantity: 1,
      balanceAfter: 1,
      earnedMonth: joinMonth,
      earnedYear: joinYear,
      notes: 'Initial monthly casual leave balance (Auto-initialized)',
    });
    await Promise.all([opSick.save(), opCasual.save()]);
    transactions = [opSick, opCasual];
  }

  let sick = 0;
  let casual = 0;
  let convertedToSalary = 0;

  transactions.forEach((tx) => {
    if (tx.leaveType === 'Sick') sick += tx.quantity;
    if (tx.leaveType === 'Casual') casual += tx.quantity;

    if (tx.transactionType === 'ConversionToSalary') {
      convertedToSalary += Math.abs(tx.quantity);
    }
  });

  // Calculate actual approved paid leaves taken in the current salary/attendance cycle (26th to 25th)
  const approvedLeaves = await LeaveRequest.find({
    employee: employeeId,
    status: 'Approved',
    leaveType: { $ne: 'Unpaid' },
    startDate: { $lte: cycleEnd },
    endDate: { $gte: cycleStart },
  });

  let availedThisMonth = 0;
  for (const l of approvedLeaves) {
    if (l.isHalfDay) {
      availedThisMonth += 0.5;
    } else {
      const lStart = new Date(l.startDate);
      const lEnd = new Date(l.endDate || l.startDate);
      const effectiveStart = lStart < cycleStart ? cycleStart : lStart;
      const effectiveEnd = lEnd > cycleEnd ? cycleEnd : lEnd;
      if (effectiveStart <= effectiveEnd) {
        if (lStart >= cycleStart && lEnd <= cycleEnd && typeof l.daysCount === 'number' && l.daysCount > 0) {
          availedThisMonth += l.daysCount;
        } else {
          const days = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 3600 * 24)) + 1;
          availedThisMonth += Math.max(0, days);
        }
      }
    }
  }

  const totalPaid = Math.max(0, Math.round((sick + casual) * 10) / 10);
  const carriedForward = Math.max(0, Math.round((totalPaid - Math.max(0, 2 - availedThisMonth)) * 10) / 10);

  return {
    employeeId: employeeId.toString(),
    employmentStatus: emp.employmentStatus,
    sickLeaveBalance: Math.max(0, Math.round(sick * 10) / 10),
    casualLeaveBalance: Math.max(0, Math.round(casual * 10) / 10),
    totalPaidLeaveBalance: totalPaid,
    monthlyPaidQuota: 2,
    availedThisMonth: Math.round(availedThisMonth * 10) / 10,
    carriedForwardBalance: carriedForward,
    convertedToSalary: Math.round(convertedToSalary * 10) / 10,
    cyclePeriod: cycle.readablePeriod,
    cycleMonth: currentMonth,
    cycleYear: currentYear,
  };
}

/**
 * Accrues 1 Sick and 1 Casual leave monthly for Permanent employees.
 */
export async function accrueMonthlyLeave(
  employeeId: mongoose.Types.ObjectId,
  month: number,
  year: number
): Promise<{ accrued: boolean; sick: number; casual: number }> {
  const emp = await Employee.findById(employeeId);
  if (!emp || emp.employmentStatus !== 'Permanent') {
    return { accrued: false, sick: 0, casual: 0 };
  }

  // Check if accrual already ran for this employee and month/year
  const existing = await LeaveLedger.findOne({
    employee: employeeId,
    transactionType: 'MonthlyAccrual',
    earnedMonth: month,
    earnedYear: year,
  });

  if (existing) {
    return { accrued: false, sick: 0, casual: 0 };
  }

  const currentBal = await getEmployeeLeaveBalance(employeeId);

  // Accrue 1 Sick Leave
  await new LeaveLedger({
    employee: employeeId,
    leaveType: 'Sick',
    transactionType: 'MonthlyAccrual',
    quantity: 1,
    balanceAfter: currentBal.sickLeaveBalance + 1,
    earnedMonth: month,
    earnedYear: year,
    notes: `Monthly accrual for ${month}/${year}`,
  }).save();

  // Accrue 1 Casual Leave
  await new LeaveLedger({
    employee: employeeId,
    leaveType: 'Casual',
    transactionType: 'MonthlyAccrual',
    quantity: 1,
    balanceAfter: currentBal.casualLeaveBalance + 1,
    earnedMonth: month,
    earnedYear: year,
    notes: `Monthly accrual for ${month}/${year}`,
  }).save();

  return { accrued: true, sick: 1, casual: 1 };
}

/**
 * Checks for eligible unused carry-forward leaves and encashes them in quarterly months.
 * Quarter months: Month 3 (March), Month 6 (June), Month 9 (September), Month 12 (December).
 */
export async function convertThreeMonthUnusedLeaveToSalary(
  employeeId: mongoose.Types.ObjectId,
  currentMonth: number,
  currentYear: number,
  dailyRate: number
): Promise<{ convertedDays: number; convertedAmount: number }> {
  const emp = await Employee.findById(employeeId);
  if (!emp || emp.employmentStatus !== 'Permanent') {
    return { convertedDays: 0, convertedAmount: 0 };
  }

  // Configurable Encashment Cycle: Default to quarter months [3, 6, 9, 12] or calculate from last encashment month & gap
  let isEligibleEncashmentMonth = [3, 6, 9, 12].includes(currentMonth);
  try {
    const setting = await PayrollSetting.findOne({ isDefault: true }) || await PayrollSetting.findOne().sort({ updatedAt: -1 });
    if (setting) {
      if (setting.enableQuarterlyEncashment === false) {
        return { convertedDays: 0, convertedAmount: 0 };
      }
      const interval = setting.leaveEncashmentIntervalMonths || 3;
      const lastM = setting.lastEncashmentMonth || 9;
      const lastY = setting.lastEncashmentYear || 2026;

      const totalMonthsDiff = (currentYear - lastY) * 12 + (currentMonth - lastM);
      if (totalMonthsDiff === 0) {
        // Last encashed month itself (e.g. Month 9 September 2026)
        isEligibleEncashmentMonth = true;
      } else if (totalMonthsDiff > 0 && totalMonthsDiff % interval === 0) {
        // Exact interval elapsed (e.g. 3 months gap -> Month 12 December, Month 3 March)
        isEligibleEncashmentMonth = true;
      } else if (totalMonthsDiff < 0) {
        isEligibleEncashmentMonth = [3, 6, 9, 12].includes(currentMonth);
      } else {
        isEligibleEncashmentMonth = false;
      }
    }
  } catch (err) {
    console.error('[convertThreeMonthUnusedLeaveToSalary] Error reading PayrollSetting, using quarterly fallback:', err);
  }

  if (!isEligibleEncashmentMonth) {
    return { convertedDays: 0, convertedAmount: 0 };
  }

  // Check if already converted for this cycle (idempotency on reprocess)
  const existingConversion = await LeaveLedger.findOne({
    employee: employeeId,
    transactionType: 'ConversionToSalary',
    earnedMonth: currentMonth,
    earnedYear: currentYear,
  });

  if (existingConversion) {
    return {
      convertedDays: Math.abs(existingConversion.quantity),
      convertedAmount: existingConversion.conversionAmount || 0,
    };
  }

  const currentBal = await getEmployeeLeaveBalance(employeeId);
  const encashableDays = Math.min(currentBal.totalPaidLeaveBalance, Math.max(0, currentBal.carriedForwardBalance));

  if (encashableDays <= 0) {
    return { convertedDays: 0, convertedAmount: 0 };
  }

  const convertedDays = encashableDays;
  const convertedAmount = Math.round(convertedDays * dailyRate * 100) / 100;

  // Record conversion in ledger
  await new LeaveLedger({
    employee: employeeId,
    leaveType: 'Casual',
    transactionType: 'ConversionToSalary',
    quantity: -convertedDays,
    balanceAfter: Math.max(0, currentBal.totalPaidLeaveBalance - convertedDays),
    earnedMonth: currentMonth,
    earnedYear: currentYear,
    conversionAmount: convertedAmount,
    notes: `Quarterly leave encashment: ${convertedDays} carried forward day(s) encashed to salary @ ₹${dailyRate}/day (Quarter Month ${currentMonth}/${currentYear})`,
  }).save();

  return { convertedDays, convertedAmount };
}
