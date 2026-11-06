import mongoose from 'mongoose';
import { Employee } from '../models/Employee.js';
import { LeaveLedger } from '../models/LeaveLedger.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { CompanyHoliday } from '../models/CompanyHoliday.js';
import { PayrollSetting } from '../models/PayrollSetting.js';
import {
  getAttendanceCycleForMonth,
  getAttendanceCycleForDate,
  AttendanceCycleInfo,
  getISTDateString,
  getCompanyStartOfDay,
} from '../utils/tzUtils.js';

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
 * Calculates net working leave days between two dates in Asia/Kolkata timezone.
 * Strictly excludes:
 * 1. Sundays (standard weekly offs).
 * 2. Official Company Holidays (CompanyHoliday where isActive !== false).
 */
export async function calculateWorkingLeaveDays(
  startDateInput: Date | string,
  endDateInput: Date | string,
  isHalfDay: boolean = false
): Promise<{
  workingDays: number;
  totalCalendarDays: number;
  sundaysCount: number;
  holidaysCount: number;
  excludedDates: string[];
}> {
  if (isHalfDay) {
    return {
      workingDays: 0.5,
      totalCalendarDays: 1,
      sundaysCount: 0,
      holidaysCount: 0,
      excludedDates: [],
    };
  }

  const sDate = typeof startDateInput === 'string' ? getCompanyStartOfDay(startDateInput) : new Date(startDateInput);
  const eDate = typeof endDateInput === 'string' ? getCompanyStartOfDay(endDateInput) : new Date(endDateInput);

  if (isNaN(sDate.getTime()) || isNaN(eDate.getTime()) || sDate > eDate) {
    return {
      workingDays: 0,
      totalCalendarDays: 0,
      sundaysCount: 0,
      holidaysCount: 0,
      excludedDates: [],
    };
  }

  const startStr = getISTDateString(sDate);
  const endStr = getISTDateString(eDate);

  // Fetch active company holidays in date range
  const holidays = await CompanyHoliday.find({
    isActive: { $ne: false },
    $or: [
      { date: { $gte: sDate, $lte: new Date(eDate.getTime() + 24 * 3600 * 1000) } },
      { dateStr: { $gte: startStr, $lte: endStr } },
    ],
  });

  const holidayDateMap = new Map<string, string>();
  holidays.forEach((h) => {
    const dKey = h.dateStr || (h.date ? getISTDateString(h.date) : null);
    if (dKey) holidayDateMap.set(dKey, h.name || 'Holiday');
  });

  let workingDays = 0;
  let totalCalendarDays = 0;
  let sundaysCount = 0;
  let holidaysCount = 0;
  const excludedDates: string[] = [];

  let cur = new Date(sDate.getTime());
  const endTime = eDate.getTime();

  while (cur.getTime() <= endTime) {
    totalCalendarDays++;
    const dStr = getISTDateString(cur);
    const [yr, mo, da] = dStr.split('-').map(Number);
    const dayOfWeek = new Date(Date.UTC(yr, mo - 1, da, 12, 0, 0)).getUTCDay(); // 0 is Sunday in IST calendar

    const isSunday = dayOfWeek === 0;
    const isHoliday = holidayDateMap.has(dStr);

    if (isSunday) {
      sundaysCount++;
      excludedDates.push(`${dStr} (Sunday)`);
    } else if (isHoliday) {
      holidaysCount++;
      excludedDates.push(`${dStr} (${holidayDateMap.get(dStr)})`);
    } else {
      workingDays++;
    }

    cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
  }

  return {
    workingDays,
    totalCalendarDays,
    sundaysCount,
    holidaysCount,
    excludedDates,
  };
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

  if (emp.employmentStatus !== 'Permanent') {
    return {
      employeeId: employeeId.toString(),
      employmentStatus: emp.employmentStatus,
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

  // Ensure all past and current monthly leave accruals (1 Sick + 1 Casual) are credited
  await syncEmployeeMonthlyAccruals(employeeId, currentYear, currentMonth);

  let transactions = await LeaveLedger.find({ employee: employeeId }).sort({ transactionDate: 1 });

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
          const workingInfo = await calculateWorkingLeaveDays(effectiveStart, effectiveEnd, false);
          availedThisMonth += workingInfo.workingDays;
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
 * Automatically synchronizes monthly leave accruals (1 Sick + 1 Casual) for a permanent employee
 * up to targetYear and targetMonth (defaults to the active attendance cycle).
 * Fully idempotent: only credits missing months and never double-credits.
 */
export async function syncEmployeeMonthlyAccruals(
  employeeId: mongoose.Types.ObjectId,
  targetYear?: number,
  targetMonth?: number
): Promise<{ addedCount: number; monthsAccrued: string[] }> {
  const emp = await Employee.findById(employeeId);
  if (!emp || emp.employmentStatus !== 'Permanent' || emp.status !== 'Active') {
    return { addedCount: 0, monthsAccrued: [] };
  }

  const cycle = (targetYear && targetMonth)
    ? getAttendanceCycleForMonth(targetYear, targetMonth)
    : getAttendanceCycleForDate(new Date());

  const endYear = cycle.year;
  const endMonth = cycle.month;

  const existingTransactions = await LeaveLedger.find({ employee: employeeId });
  const creditedMonths = new Set(
    existingTransactions
      .filter((t) => (t.transactionType === 'OpeningBalance' || t.transactionType === 'MonthlyAccrual') && t.earnedYear && t.earnedMonth)
      .map((t) => `${t.earnedYear}-${t.earnedMonth}`)
  );

  // Determine baseline start month and year
  let startYear = 2026;
  let startMonth = 8;

  const op = existingTransactions.find((t) => t.transactionType === 'OpeningBalance' && t.earnedYear && t.earnedMonth);
  if (op && op.earnedYear && op.earnedMonth) {
    startYear = op.earnedYear;
    startMonth = op.earnedMonth;
  } else {
    // If no OpeningBalance exists, check joining date
    const joinDate = emp.joiningDate ? new Date(emp.joiningDate) : ((emp as any).createdAt ? new Date((emp as any).createdAt) : new Date());
    const jY = joinDate.getFullYear();
    const jM = joinDate.getMonth() + 1;
    if (jY > 2026 || (jY === 2026 && jM >= 8)) {
      startYear = jY;
      startMonth = jM;
    } else {
      startYear = 2026;
      startMonth = 8;
    }

    // Seed OpeningBalance for baseline month if not credited
    const baselineKey = `${startYear}-${startMonth}`;
    if (!creditedMonths.has(baselineKey)) {
      await Promise.all([
        new LeaveLedger({
          employee: employeeId,
          leaveType: 'Sick',
          transactionType: 'OpeningBalance',
          quantity: 1,
          balanceAfter: 1,
          earnedMonth: startMonth,
          earnedYear: startYear,
          notes: `Initial monthly sick leave balance (${startMonth}/${startYear})`,
        }).save(),
        new LeaveLedger({
          employee: employeeId,
          leaveType: 'Casual',
          transactionType: 'OpeningBalance',
          quantity: 1,
          balanceAfter: 1,
          earnedMonth: startMonth,
          earnedYear: startYear,
          notes: `Initial monthly casual leave balance (${startMonth}/${startYear})`,
        }).save(),
      ]);
      creditedMonths.add(baselineKey);
    }
  }

  // Iterate month by month from (startYear, startMonth + 1) up to (endYear, endMonth)
  let curY = startYear;
  let curM = startMonth + 1;
  if (curM > 12) {
    curM = 1;
    curY += 1;
  }

  const monthsAccrued: string[] = [];
  let addedCount = 0;

  while (curY < endYear || (curY === endYear && curM <= endMonth)) {
    const key = `${curY}-${curM}`;
    if (!creditedMonths.has(key)) {
      await Promise.all([
        new LeaveLedger({
          employee: employeeId,
          leaveType: 'Sick',
          transactionType: 'MonthlyAccrual',
          quantity: 1,
          balanceAfter: 1,
          earnedMonth: curM,
          earnedYear: curY,
          notes: `Monthly accrual for ${curM}/${curY}`,
        }).save(),
        new LeaveLedger({
          employee: employeeId,
          leaveType: 'Casual',
          transactionType: 'MonthlyAccrual',
          quantity: 1,
          balanceAfter: 1,
          earnedMonth: curM,
          earnedYear: curY,
          notes: `Monthly accrual for ${curM}/${curY}`,
        }).save(),
      ]);

      creditedMonths.add(key);
      monthsAccrued.push(key);
      addedCount += 2;
    }

    curM++;
    if (curM > 12) {
      curM = 1;
      curY++;
    }
  }

  return { addedCount, monthsAccrued };
}

/**
 * Syncs monthly leave accruals for all active permanent employees.
 */
export async function syncAllPermanentEmployeesAccruals(
  targetYear?: number,
  targetMonth?: number
): Promise<Array<{ employeeId: string; name: string; addedTransactions: number; monthsAccrued: string[] }>> {
  const cycle = (targetYear && targetMonth)
    ? getAttendanceCycleForMonth(targetYear, targetMonth)
    : getAttendanceCycleForDate(new Date());

  const employees = await Employee.find({
    employmentStatus: 'Permanent',
    status: 'Active',
  });

  const results = [];
  for (const emp of employees) {
    const res = await syncEmployeeMonthlyAccruals(emp._id as mongoose.Types.ObjectId, cycle.year, cycle.month);
    results.push({
      employeeId: emp._id.toString(),
      name: emp.name || (emp as any).first_name || 'Staff',
      addedTransactions: res.addedCount,
      monthsAccrued: res.monthsAccrued,
    });
  }
  return results;
}

/**
 * Starts a background scheduler to automatically check and run monthly leave accruals.
 * Runs immediately on server startup, and checks every 6 hours thereafter.
 */
export function startMonthlyLeaveAccrualScheduler(intervalMs: number = 6 * 60 * 60 * 1000): NodeJS.Timeout {
  console.log('[Leave Accrual Scheduler] 🚀 Automated monthly leave accrual engine initialized.');
  // Initial run in background (non-blocking)
  syncAllPermanentEmployeesAccruals().then((res) => {
    const totalAdded = res.reduce((acc, r) => acc + r.addedTransactions, 0);
    if (totalAdded > 0) {
      console.log(`[Leave Accrual Scheduler] ✅ Synced ${totalAdded} missing leave accruals for permanent staff.`);
    }
  }).catch((err) => {
    console.error('[Leave Accrual Scheduler] Error running startup accruals:', err);
  });

  return setInterval(() => {
    syncAllPermanentEmployeesAccruals().catch((err) => {
      console.error('[Leave Accrual Scheduler] Error running recurring accruals:', err);
    });
  }, intervalMs);
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
  if (!emp || emp.employmentStatus !== 'Permanent' || emp.status !== 'Active') {
    return { accrued: false, sick: 0, casual: 0 };
  }

  // Check if accrual already ran for this employee and month/year
  const existing = await LeaveLedger.findOne({
    employee: employeeId,
    transactionType: { $in: ['OpeningBalance', 'MonthlyAccrual'] },
    earnedMonth: month,
    earnedYear: year,
  });

  if (existing) {
    return { accrued: false, sick: 0, casual: 0 };
  }

  await Promise.all([
    new LeaveLedger({
      employee: employeeId,
      leaveType: 'Sick',
      transactionType: 'MonthlyAccrual',
      quantity: 1,
      balanceAfter: 1,
      earnedMonth: month,
      earnedYear: year,
      notes: `Monthly accrual for ${month}/${year}`,
    }).save(),
    new LeaveLedger({
      employee: employeeId,
      leaveType: 'Casual',
      transactionType: 'MonthlyAccrual',
      quantity: 1,
      balanceAfter: 1,
      earnedMonth: month,
      earnedYear: year,
      notes: `Monthly accrual for ${month}/${year}`,
    }).save(),
  ]);

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
