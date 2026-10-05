import { roundFinalSalary, calculateSalaryRounding } from '../utils/salaryRounding.js';
import { computePayroll } from '../services/payrollEngine.js';
import { IEmployeeSalaryStructure } from '../models/EmployeeSalaryStructure.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

console.log('================================================================================');
console.log('=== VERIFYING SALARY ROUNDING UP ENGINE & EXCEL EXPORT INTEGRITY ===');
console.log('================================================================================\n');

let passCount = 0;
let failCount = 0;

function assert(description: string, condition: boolean, details?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${description}${details ? ` -> ${details}` : ''}`);
    passCount++;
  } else {
    console.error(`❌ [FAIL] ${description}${details ? ` -> ${details}` : ''}`);
    failCount++;
  }
}

// 1. User Specification Test Cases
console.log('--- 1. User Specification Rounding Cases ---');
const case1 = calculateSalaryRounding(14040);
assert(
  'User Example 1: 14040 converts to 14050',
  case1.roundedNetSalary === 14050 && case1.roundingAdjustment === 10,
  `Unrounded: ₹${case1.unroundedNetSalary}, Rounded: ₹${case1.roundedNetSalary}, Adj: +₹${case1.roundingAdjustment}`
);

const case2 = calculateSalaryRounding(16874);
assert(
  'User Example 2: 16874 converts to 16900',
  case2.roundedNetSalary === 16900 && case2.roundingAdjustment === 26,
  `Unrounded: ₹${case2.unroundedNetSalary}, Rounded: ₹${case2.roundedNetSalary}, Adj: +₹${case2.roundingAdjustment}`
);

const case3 = calculateSalaryRounding(12355);
assert(
  'User Example 3: 12355 converts to 12400 (no odd ending)',
  case3.roundedNetSalary === 12400 && case3.roundingAdjustment === 45,
  `Unrounded: ₹${case3.unroundedNetSalary}, Rounded: ₹${case3.roundedNetSalary}, Adj: +₹${case3.roundingAdjustment}`
);

const case4 = calculateSalaryRounding(14050);
assert(
  'Already ends in 50: 14050 stays 14050',
  case4.roundedNetSalary === 14050 && case4.roundingAdjustment === 0,
  `Unrounded: ₹${case4.unroundedNetSalary}, Rounded: ₹${case4.roundedNetSalary}, Adj: +₹${case4.roundingAdjustment}`
);

const case5 = calculateSalaryRounding(14000);
assert(
  'Already ends in 100s: 14000 stays 14000',
  case5.roundedNetSalary === 14000 && case5.roundingAdjustment === 0,
  `Unrounded: ₹${case5.unroundedNetSalary}, Rounded: ₹${case5.roundedNetSalary}, Adj: +₹${case5.roundingAdjustment}`
);

const case6 = calculateSalaryRounding(14001);
assert(
  '14001 rounds up to 14050',
  case6.roundedNetSalary === 14050 && case6.roundingAdjustment === 49,
  `Unrounded: ₹${case6.unroundedNetSalary}, Rounded: ₹${case6.roundedNetSalary}, Adj: +₹${case6.roundingAdjustment}`
);

const case7 = calculateSalaryRounding(14051);
assert(
  '14051 rounds up to 14100',
  case7.roundedNetSalary === 14100 && case7.roundingAdjustment === 49,
  `Unrounded: ₹${case7.unroundedNetSalary}, Rounded: ₹${case7.roundedNetSalary}, Adj: +₹${case7.roundingAdjustment}`
);

const case8 = calculateSalaryRounding(0);
assert(
  '0 salary stays 0 (no spurious round-up for unworked staff)',
  case8.roundedNetSalary === 0 && case8.roundingAdjustment === 0,
  `Unrounded: ₹${case8.unroundedNetSalary}, Rounded: ₹${case8.roundedNetSalary}, Adj: +₹${case8.roundingAdjustment}`
);

// 2. Comprehensive check: 1000 consecutive integers
console.log('\n--- 2. Invariant Check Across 1,000 Consecutive Amounts ---');
let allEndIn50Or100 = true;
let allGreaterOrEqual = true;
for (let val = 10000; val <= 11000; val++) {
  const rounded = roundFinalSalary(val);
  const lastTwo = rounded % 100;
  if (lastTwo !== 0 && lastTwo !== 50) {
    allEndIn50Or100 = false;
    break;
  }
  if (rounded < val) {
    allGreaterOrEqual = false;
    break;
  }
}
assert('Every amount strictly ends in 50 or 00 (no other endings exist)', allEndIn50Or100);
assert('Every rounded amount is >= unrounded amount (pure round-up)', allGreaterOrEqual);

// 3. Payroll Engine computePayroll Test
console.log('\n--- 3. Payroll Engine Integration Test ---');
async function testEngine() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/flumenx';
  await mongoose.connect(mongoUri);
  const dummyEmpId = new mongoose.Types.ObjectId();
  const mockStructure: Partial<IEmployeeSalaryStructure> = {
    employee: dummyEmpId,
    grossSalary: 15000,
    basicSalary: 7500,
    hra: 3750,
    conveyance: 1500,
    specialAllowance: 2250,
    otherAllowances: 0,
    pfApplicable: true,
    pfEmployeePercent: 12,
    pfEmployerPercent: 12,
    voluntaryPfAboveCeiling: false,
    pfWageCeiling: 15000,
    esiApplicable: true,
    esiEmployeePercent: 0.75,
    esiEmployerPercent: 3.25,
    esiGrossCeiling: 21000,
    professionalTaxApplicable: true,
    professionalTax: 200,
    tdsApplicable: false,
    tds: 0,
    isActive: true,
  };

  const mockAttendance: IAttendanceCycleSnapshot = {
    cycleName: 'July-August 2026',
    startStr: '2026-07-26',
    endStr: '2026-08-25',
    cycleStart: new Date('2026-07-26'),
    cycleEnd: new Date('2026-08-25'),
    totalCalendarDays: 31,
    salaryDays: 27,
    workingDays: 27,
    weekOffs: 4,
    companyHolidays: 0,
    presentDays: 27,
    halfDays: 0,
    paidLeaveDays: 0,
    unpaidLeaveDays: 0,
    absentDays: 0,
    lateArrivalsCount: 0,
    lateHalfDayDeductions: 0,
    payableDays: 27,
    unpaidDays: 0,
  };

  const result = await computePayroll(mockStructure as any, mockAttendance, 8, 2026);

  console.log(`Gross Salary: ₹${result.grossSalary}`);
  console.log(`Total Deductions: ₹${result.totalDeductions} (PF: ₹${result.pfEmployee}, ESI: ₹${result.esiEmployee}, PT: ₹${result.professionalTax})`);
  console.log(`Unrounded Net: ₹${result.unroundedNetSalary}`);
  console.log(`Rounding Adjustment: +₹${result.roundingAdjustment}`);
  console.log(`Final Net Salary: ₹${result.netSalary}`);
  console.log(`Total Earnings: ₹${result.totalEarnings}`);

  assert(
    'computePayroll returns unroundedNetSalary and roundingAdjustment',
    result.unroundedNetSalary !== undefined && result.roundingAdjustment !== undefined
  );

  const lastTwoDigits = result.netSalary % 100;
  assert(
    `Final Net Salary ₹${result.netSalary} ends in 50 or 00`,
    lastTwoDigits === 50 || lastTwoDigits === 0
  );

  assert(
    'Total Earnings - Total Deductions === Final Net Salary',
    Math.round((result.totalEarnings - result.totalDeductions) * 100) / 100 === result.netSalary,
    `${result.totalEarnings} - ${result.totalDeductions} = ${result.netSalary}`
  );

  // 4. Double-Entry Accounting Invariant Test
  console.log('\n--- 4. Double-Entry Accounting Invariant Test ---');
  const grossPayDebit = Math.round(((result.grossSalary - (result.attendanceDeduction || 0)) + result.roundingAdjustment) * 100) / 100;
  const pfEmployerDebit = Math.round((result.pfEmployer || 0) * 100) / 100;
  const esiEmployerDebit = Math.round((result.esiEmployer || 0) * 100) / 100;
  const totalDebits = Math.round((grossPayDebit + pfEmployerDebit + esiEmployerDebit) * 100) / 100;

  const netPayCredit = Math.round(result.netSalary * 100) / 100;
  const totalPfCredit = Math.round(((result.pfEmployee || 0) + pfEmployerDebit) * 100) / 100;
  const totalEsiCredit = Math.round(((result.esiEmployee || 0) + esiEmployerDebit) * 100) / 100;
  const ptCredit = Math.round((result.professionalTax || 0) * 100) / 100;
  const tdsCredit = Math.round((result.tds || 0) * 100) / 100;
  const totalCredits = Math.round((netPayCredit + totalPfCredit + totalEsiCredit + ptCredit + tdsCredit) * 100) / 100;

  assert(
    'Accounting Double-Entry Invariant: Debits === Credits',
    Math.abs(totalDebits - totalCredits) < 0.001,
    `Total Debits ₹${totalDebits.toFixed(2)} === Total Credits ₹${totalCredits.toFixed(2)}`
  );

  console.log('\n================================================================================');
  console.log(`VERIFICATION SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('================================================================================');

  await mongoose.disconnect();
  if (failCount > 0) {
    process.exit(1);
  }
}

testEngine().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
