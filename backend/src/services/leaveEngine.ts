import mongoose from 'mongoose';
import { Employee } from '../models/Employee.js';
import { LeaveLedger } from '../models/LeaveLedger.js';

export interface EmployeeLeaveBalanceSummary {
  employeeId: string;
  employmentStatus: string;
  sickLeaveBalance: number;
  casualLeaveBalance: number;
  totalPaidLeaveBalance: number;
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
    };
  }

  if (emp.employmentStatus === 'Probation') {
    return {
      employeeId: employeeId.toString(),
      employmentStatus: 'Probation',
      sickLeaveBalance: 0,
      casualLeaveBalance: 0,
      totalPaidLeaveBalance: 0,
    };
  }

  const transactions = await LeaveLedger.find({ employee: employeeId }).sort({ transactionDate: 1 });

  let sick = 0;
  let casual = 0;

  transactions.forEach((tx) => {
    if (tx.leaveType === 'Sick') sick += tx.quantity;
    if (tx.leaveType === 'Casual') casual += tx.quantity;
  });

  return {
    employeeId: employeeId.toString(),
    employmentStatus: emp.employmentStatus,
    sickLeaveBalance: Math.max(0, Math.round(sick * 10) / 10),
    casualLeaveBalance: Math.max(0, Math.round(casual * 10) / 10),
    totalPaidLeaveBalance: Math.max(0, Math.round((sick + casual) * 10) / 10),
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
 * Checks for eligible unused leave older than 3 months and converts them to salary addition.
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

  // 3 months prior cutoff
  let cutoffMonth = currentMonth - 3;
  let cutoffYear = currentYear;
  if (cutoffMonth <= 0) {
    cutoffMonth += 12;
    cutoffYear -= 1;
  }

  // Find accruals at or before cutoff that haven't been converted
  const eligibleAccruals = await LeaveLedger.find({
    employee: employeeId,
    transactionType: 'MonthlyAccrual',
    $or: [
      { earnedYear: { $lt: cutoffYear } },
      { earnedYear: cutoffYear, earnedMonth: { $lte: cutoffMonth } },
    ],
  });

  const convertedRecords = await LeaveLedger.find({
    employee: employeeId,
    transactionType: 'ConversionToSalary',
  });

  const totalAccruedEligible = eligibleAccruals.reduce((sum, a) => sum + a.quantity, 0);
  const totalAlreadyConverted = convertedRecords.reduce((sum, c) => sum + Math.abs(c.quantity), 0);

  const currentBal = await getEmployeeLeaveBalance(employeeId);
  const maxAvailableToConvert = Math.min(
    currentBal.totalPaidLeaveBalance,
    Math.max(0, totalAccruedEligible - totalAlreadyConverted)
  );

  if (maxAvailableToConvert <= 0) {
    return { convertedDays: 0, convertedAmount: 0 };
  }

  const convertedDays = maxAvailableToConvert;
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
    notes: `Converted ${convertedDays} unused 3-month leave(s) to salary @ ₹${dailyRate}/day`,
  }).save();

  return { convertedDays, convertedAmount };
}
