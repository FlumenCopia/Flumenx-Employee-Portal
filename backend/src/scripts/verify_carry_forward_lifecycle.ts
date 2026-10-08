import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Employee } from '../models/Employee.js';
import { LeaveLedger } from '../models/LeaveLedger.js';
import { EmployeeSalaryStructure } from '../models/EmployeeSalaryStructure.js';
import { getEmployeeLeaveBalance, convertThreeMonthUnusedLeaveToSalary, accrueMonthlyLeave } from '../services/leaveEngine.js';
import { computePayroll, calculateAttendanceForCycle } from '../services/payrollEngine.js';
import { getAttendanceCycleForMonth } from '../utils/tzUtils.js';

dotenv.config();

async function runTest() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/flumenx_portal');
  console.log('Connected to MongoDB for Leave Encashment & Carry Forward Verification');

  // Find a Permanent employee with a salary structure
  const permEmployees = await Employee.find({ employmentStatus: 'Permanent', status: { $ne: 'Inactive' } });
  let testEmp = null;
  let testStructure = null;

  for (const emp of permEmployees) {
    const struct = await EmployeeSalaryStructure.findOne({ employee: emp._id, isActive: true });
    if (struct) {
      testEmp = emp;
      testStructure = struct;
      break;
    }
  }

  if (!testEmp || !testStructure) {
    console.error('Could not find permanent employee with salary structure');
    await mongoose.disconnect();
    return;
  }

  console.log(`\n======================================================`);
  console.log(`TEST EMPLOYEE: ${testEmp.name} (${testEmp.employeeCode})`);
  console.log(`Status: ${testEmp.employmentStatus}, Gross: ₹${testStructure.grossSalary}, Basic: ₹${testStructure.basicSalary}`);
  console.log(`======================================================\n`);

  // Snapshot original transactions so we can restore DB state after test
  const originalTx = await LeaveLedger.find({ employee: testEmp._id });
  console.log(`Existing LeaveLedger transactions count: ${originalTx.length}`);

  try {
    // ---------------------------------------------------------
    // STEP 1: INITIAL BALANCE CHECK
    // ---------------------------------------------------------
    console.log('\n--- [TEST 1] Initial Leave Balance ---');
    const initBal = await getEmployeeLeaveBalance(testEmp._id as any);
    console.log('Initial balance:', {
      totalPaid: initBal.totalPaidLeaveBalance,
      carriedForward: initBal.carriedForwardBalance,
      availedThisMonth: initBal.availedThisMonth,
      convertedToSalary: initBal.convertedToSalary,
    });

    // ---------------------------------------------------------
    // STEP 2: CARRY FORWARD LEAVES ADJUSTMENT (SET TO 7 DAYS)
    // Simulating setCarryForwardBalance endpoint logic
    // ---------------------------------------------------------
    console.log('\n--- [TEST 2] Carry Forward Adjustment to 7 Days ---');
    const targetCarryForward = 7;
    const remainingMonthQuota = Math.max(0, 2 - initBal.availedThisMonth);
    const targetTotalPaid = targetCarryForward + remainingMonthQuota;
    const delta = Math.round((targetTotalPaid - initBal.totalPaidLeaveBalance) * 10) / 10;

    console.log(`Setting carry forward to ${targetCarryForward} days. Target total paid: ${targetTotalPaid}, delta: +${delta}`);

    const adjustmentTx = await new LeaveLedger({
      employee: testEmp._id,
      leaveType: 'Casual',
      transactionType: 'ManualAdjustment',
      quantity: delta,
      balanceAfter: Math.max(0, initBal.totalPaidLeaveBalance + delta),
      notes: `Test: Admin set carry forward to ${targetCarryForward} days (delta: +${delta})`,
    }).save();

    const postAdjustBal = await getEmployeeLeaveBalance(testEmp._id as any);
    console.log('Balance after adjustment:', {
      totalPaid: postAdjustBal.totalPaidLeaveBalance,
      carriedForward: postAdjustBal.carriedForwardBalance,
      availedThisMonth: postAdjustBal.availedThisMonth,
    });

    const adjustSuccess = postAdjustBal.carriedForwardBalance === 7 && postAdjustBal.totalPaidLeaveBalance === 9;
    console.log(`>> Adjustment Result: ${adjustSuccess ? 'PASSED (7 days carried forward)' : 'FAILED'}`);

    // ---------------------------------------------------------
    // STEP 3: SEPTEMBER (MONTH 9) PAYROLL GENERATION & ENCASHMENT
    // September is Month 9 (Quarterly month: 3, 6, 9, 12)
    // ---------------------------------------------------------
    console.log('\n--- [TEST 3] September (Month 9) Salary Encashment ---');
    const cycle9 = getAttendanceCycleForMonth(2026, 9);
    const att9 = await calculateAttendanceForCycle(testEmp._id as any, cycle9);
    const salaryResult9 = await computePayroll(testStructure, att9, 9, 2026);

    console.log('September Payroll Result:');
    console.log(`  Leave Conversion Days: ${salaryResult9.leaveConversionDays}`);
    console.log(`  Leave Conversion Amount: ₹${salaryResult9.leaveConversionAmount}`);
    console.log(`  Gross Salary: ₹${salaryResult9.grossSalary}`);
    console.log(`  Total Earnings: ₹${salaryResult9.totalEarnings}`);
    console.log(`  Net Salary: ₹${salaryResult9.netSalary}`);

    const leaveEarningItem = salaryResult9.salarySnapshot.earnings.find(e => e.code === 'LEAVE_CONV');
    console.log(`  LEAVE_CONV in earnings:`, leaveEarningItem);

    const encashSuccess = salaryResult9.leaveConversionDays === 7 &&
                          (salaryResult9.leaveConversionAmount || 0) > 0 &&
                          !!leaveEarningItem;
    console.log(`>> September Encashment: ${encashSuccess ? 'PASSED (7 days encashed in September salary)' : 'FAILED'}`);

    // ---------------------------------------------------------
    // STEP 4: CARRY FORWARD RESET VERIFICATION
    // After September encashment, carriedForwardBalance must be reset to 0
    // ---------------------------------------------------------
    console.log('\n--- [TEST 4] Carry Forward Reset Verification ---');
    const postEncashBal = await getEmployeeLeaveBalance(testEmp._id as any);
    console.log('Balance immediately after September encashment:', {
      totalPaid: postEncashBal.totalPaidLeaveBalance,
      carriedForward: postEncashBal.carriedForwardBalance,
      availedThisMonth: postEncashBal.availedThisMonth,
      convertedToSalary: postEncashBal.convertedToSalary,
    });

    const resetSuccess = postEncashBal.carriedForwardBalance === 0 &&
                         postEncashBal.totalPaidLeaveBalance === 2 &&
                         postEncashBal.convertedToSalary >= 7;
    console.log(`>> Reset Carry Forward: ${resetSuccess ? 'PASSED (Carried forward reset to 0, quota preserved at 2.0)' : 'FAILED'}`);

    // ---------------------------------------------------------
    // STEP 5: MONTH 10 (OCTOBER) - NON-QUARTERLY MONTH (NO ENCASHMENT)
    // October (Month 10) is 1 month after September
    // ---------------------------------------------------------
    console.log('\n--- [TEST 5] October (Month 10) - Non-Quarter Month ---');
    const cycle10 = getAttendanceCycleForMonth(2026, 10);
    const att10 = await calculateAttendanceForCycle(testEmp._id as any, cycle10);
    const salaryResult10 = await computePayroll(testStructure, att10, 10, 2026);

    console.log('October Payroll Result:');
    console.log(`  Leave Conversion Days: ${salaryResult10.leaveConversionDays}`);
    console.log(`  Leave Conversion Amount: ₹${salaryResult10.leaveConversionAmount}`);

    const octNoEncash = (salaryResult10.leaveConversionDays === 0 || salaryResult10.leaveConversionDays === undefined) &&
                        (salaryResult10.leaveConversionAmount === 0 || salaryResult10.leaveConversionAmount === undefined);
    console.log(`>> October (Month 10) Non-Encashment: ${octNoEncash ? 'PASSED (Not encashed in non-quarter month)' : 'FAILED'}`);

    // ---------------------------------------------------------
    // STEP 6: MONTH 11 (NOVEMBER) - NON-QUARTERLY MONTH (NO ENCASHMENT)
    // November (Month 11) is 2 months after September
    // ---------------------------------------------------------
    console.log('\n--- [TEST 6] November (Month 11) - Non-Quarter Month ---');
    const cycle11 = getAttendanceCycleForMonth(2026, 11);
    const att11 = await calculateAttendanceForCycle(testEmp._id as any, cycle11);
    const salaryResult11 = await computePayroll(testStructure, att11, 11, 2026);

    const novNoEncash = (salaryResult11.leaveConversionDays === 0 || salaryResult11.leaveConversionDays === undefined) &&
                        (salaryResult11.leaveConversionAmount === 0 || salaryResult11.leaveConversionAmount === undefined);
    console.log(`>> November (Month 11) Non-Encashment: ${novNoEncash ? 'PASSED (Not encashed in non-quarter month)' : 'FAILED'}`);

    // ---------------------------------------------------------
    // STEP 7: MONTH 12 (DECEMBER) - 3 MONTHS AFTER SEPTEMBER (QUARTER ENCASHMENT)
    // December is Month 12 (3 months after Month 9)
    // Let's add 2 days new carry forward to test if December encashes them!
    // ---------------------------------------------------------
    console.log('\n--- [TEST 7] December (Month 12) - 3 Months Later (Quarter Encashment) ---');
    // Simulate employee accruing / carrying forward 3 days by December
    await new LeaveLedger({
      employee: testEmp._id,
      leaveType: 'Casual',
      transactionType: 'ManualAdjustment',
      quantity: 3,
      balanceAfter: 5,
      notes: 'Test: Accrued 3 days unused leaves leading into December quarter',
    }).save();

    const decBalBefore = await getEmployeeLeaveBalance(testEmp._id as any);
    console.log('Balance before December payroll:', {
      totalPaid: decBalBefore.totalPaidLeaveBalance,
      carriedForward: decBalBefore.carriedForwardBalance,
    });

    const cycle12 = getAttendanceCycleForMonth(2026, 12);
    const att12 = await calculateAttendanceForCycle(testEmp._id as any, cycle12);
    const salaryResult12 = await computePayroll(testStructure, att12, 12, 2026);

    console.log('December Payroll Result:');
    console.log(`  Leave Conversion Days: ${salaryResult12.leaveConversionDays}`);
    console.log(`  Leave Conversion Amount: ₹${salaryResult12.leaveConversionAmount}`);

    const decEncashPass = salaryResult12.leaveConversionDays === 3 && (salaryResult12.leaveConversionAmount || 0) > 0;
    console.log(`>> December (Month 12, 3 months later) Encashment: ${decEncashPass ? 'PASSED (Encashment triggers in 3rd month)' : 'FAILED'}`);

    // ---------------------------------------------------------
    // STEP 8: IDEMPOTENCY CHECK
    // Reprocessing September or December payroll must NOT double-encash
    // ---------------------------------------------------------
    console.log('\n--- [TEST 8] Idempotency Check on Reprocessing ---');
    const salaryResult9Reprocess = await computePayroll(testStructure, att9, 9, 2026);
    const idempPass = salaryResult9Reprocess.leaveConversionDays === 7;
    const conversionTxs = await LeaveLedger.find({
      employee: testEmp._id,
      transactionType: 'ConversionToSalary',
      earnedMonth: 9,
      earnedYear: 2026,
    });
    console.log(`Conversion records in ledger for Month 9: ${conversionTxs.length}`);
    const idempLedgerPass = conversionTxs.length === 1;
    console.log(`>> Idempotency: ${idempPass && idempLedgerPass ? 'PASSED (Exactly 1 ledger entry, no double conversion)' : 'FAILED'}`);

  } finally {
    // ---------------------------------------------------------
    // CLEANUP: Clean up test ledger entries created during simulation
    // ---------------------------------------------------------
    console.log('\n--- Cleaning up test ledger entries to restore DB clean state ---');
    const currentTx = await LeaveLedger.find({ employee: testEmp._id });
    const originalIds = new Set(originalTx.map(t => t._id.toString()));
    const toDelete = currentTx.filter(t => !originalIds.has(t._id.toString()));
    for (const d of toDelete) {
      await LeaveLedger.findByIdAndDelete(d._id);
    }
    console.log(`Purged ${toDelete.length} temporary test entries. Database restored.`);
  }

  await mongoose.disconnect();
}

runTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
