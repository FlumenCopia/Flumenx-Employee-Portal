import mongoose from 'mongoose';
import { Employee } from '../models/Employee.js';
import { LeaveLedger } from '../models/LeaveLedger.js';

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
}

/**
 * Returns current active leave balance for an employee.
 * Probation employees have strictly 0 paid leave balance.
 */
export async function getEmployeeLeaveBalance(
  employeeId: mongoose.Types.ObjectId
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
    };
  }

  const transactions = await LeaveLedger.find({ employee: employeeId }).sort({ transactionDate: 1 });

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  let sick = 0;
  let casual = 0;
  let availedThisMonth = 0;
  let convertedToSalary = 0;

  transactions.forEach((tx) => {
    if (tx.leaveType === 'Sick') sick += tx.quantity;
    if (tx.leaveType === 'Casual') casual += tx.quantity;

    if (tx.transactionType === 'ConversionToSalary') {
      convertedToSalary += Math.abs(tx.quantity);
    }

    if (tx.transactionType === 'Availed') {
      const txDate = new Date(tx.transactionDate);
      if (txDate.getMonth() + 1 === currentMonth && txDate.getFullYear() === currentYear) {
        availedThisMonth += Math.abs(tx.quantity);
      }
    }
  });

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
 * Quarter months: Month 3 (March), Month 4, Month 6 (June), Month 9 (September), Month 12 (December).
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

  // Quarterly Encashment: Encashed at every quarter month (Months 3, 4, 6, 9, 12)
  const isQuarterEncashmentMonth = [3, 4, 6, 9, 12].includes(currentMonth);
  if (!isQuarterEncashmentMonth) {
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
