import mongoose from 'mongoose';
import { Employee } from '../models/Employee.js';
import { LeaveLedger } from '../models/LeaveLedger.js';
import { PayrollRecord } from '../models/PayrollRecord.js';
import { PayrollSetting } from '../models/PayrollSetting.js';
import { EmployeeSalaryStructure } from '../models/EmployeeSalaryStructure.js';
import { getEmployeeLeaveBalance, convertThreeMonthUnusedLeaveToSalary } from '../services/leaveEngine.js';
import { computePayroll, calculateAttendanceForCycle } from '../services/payrollEngine.js';
import { getAttendanceCycleForMonth } from '../utils/tzUtils.js';

async function runE2ETest() {
  console.log('--- STARTING USER REQUIREMENTS E2E TEST ---');
  await mongoose.connect('mongodb://127.0.0.1:27017/flumenx_portal');

  // 1. Configure Payroll Settings with 7 September baseline & 3-month gap
  console.log('\n[TEST 1] Setting up Payroll & Leave Encashment Settings...');
  const allSettings = await PayrollSetting.find();
  if (allSettings.length > 1) {
    const keepId = allSettings[0]._id;
    await PayrollSetting.deleteMany({ _id: { $ne: keepId } });
  }
  let settings = await PayrollSetting.findOne();
  if (!settings) {
    settings = await PayrollSetting.create({
      isDefault: true,
      leaveEncashmentIntervalMonths: 3,
      lastEncashmentMonth: 9,
      lastEncashmentYear: 2026,
      lastEncashmentDate: '2026-09-07',
      enableQuarterlyEncashment: true,
    });
  } else {
    settings.isDefault = true;
    settings.leaveEncashmentIntervalMonths = 3;
    settings.lastEncashmentMonth = 9;
    settings.lastEncashmentYear = 2026;
    settings.lastEncashmentDate = '2026-09-07';
    settings.enableQuarterlyEncashment = true;
    await settings.save();
  }
  console.log('✓ Settings configured: Interval = 3 months, Baseline = 2026-09-07 (Month 9)');

  // 2. Setup Test Employee with Banking & Statutory Information
  console.log('\n[TEST 2] Configuring Employee with Bank Details...');
  let testEmp = await Employee.findOne({ employeeCode: 'FLX-E2E-TEST' });
  if (!testEmp) {
    testEmp = await Employee.create({
      employeeCode: 'FLX-E2E-TEST',
      name: 'E2E Verification Employee',
      email: 'e2e.test@flumenx.com',
      phone: '+91 9876543210',
      department: 'Engineering',
      designation: 'Senior Developer',
      joiningDate: new Date('2025-01-01'),
      status: 'Active',
      employmentStatus: 'Permanent',
      bankName: 'HDFC Bank',
      bankAccountNumber: '50100456789123',
      bankIfsc: 'HDFC0001234',
      bankBranch: 'MG Road, Bangalore',
      panNumber: 'ABCDE1234F',
      uanNumber: '100987654321',
      pfNumber: 'MH/BAN/0012345/000/0001234',
      esiNumber: '31001234560000001',
    });
  } else {
    testEmp.employmentStatus = 'Permanent';
    testEmp.bankName = 'HDFC Bank';
    testEmp.bankAccountNumber = '50100456789123';
    testEmp.bankIfsc = 'HDFC0001234';
    testEmp.bankBranch = 'MG Road, Bangalore';
    testEmp.panNumber = 'ABCDE1234F';
    testEmp.uanNumber = '100987654321';
    testEmp.pfNumber = 'MH/BAN/0012345/000/0001234';
    testEmp.esiNumber = '31001234560000001';
    await testEmp.save();
  }
  console.log('✓ Employee saved with Bank A/C:', testEmp.bankAccountNumber, 'IFSC:', testEmp.bankIfsc, 'PAN:', testEmp.panNumber);

  // Setup Salary Structure (Fixed Gross 50,000, Basic 25,000)
  await EmployeeSalaryStructure.deleteMany({ employee: testEmp._id });
  const testStructure = await EmployeeSalaryStructure.create({
    employee: testEmp._id,
    effectiveFrom: new Date('2025-01-01'),
    grossSalary: 50000,
    basicSalary: 25000,
    hra: 12500,
    conveyance: 3000,
    specialAllowance: 9500,
    otherAllowances: 0,
    pfApplicable: false,
    esiApplicable: false,
    professionalTaxApplicable: false,
    tdsApplicable: false,
    isActive: true,
  });

  // Clean prior ledgers
  await LeaveLedger.deleteMany({ employee: testEmp._id });

  // 3. Test Carry Forward Adjustment via Employee Profile Option
  console.log('\n[TEST 3] Adjusting Carry Forward Leaves to 7.0 days...');
  async function adjustCarryForward(empId: any, targetCF: number) {
    const currentBal = await getEmployeeLeaveBalance(empId);
    const remainingMonthQuota = Math.max(0, 2 - currentBal.availedThisMonth);
    const targetTotalPaid = targetCF + remainingMonthQuota;
    const delta = Math.round((targetTotalPaid - currentBal.totalPaidLeaveBalance) * 10) / 10;
    if (delta !== 0) {
      await new LeaveLedger({
        employee: empId,
        leaveType: 'Casual',
        transactionType: 'ManualAdjustment',
        quantity: delta,
        balanceAfter: Math.max(0, currentBal.totalPaidLeaveBalance + delta),
        notes: `Admin set carry forward to ${targetCF} days (delta: ${delta})`,
      }).save();
    }
    return await getEmployeeLeaveBalance(empId);
  }

  const adjustResult = await adjustCarryForward(testEmp._id, 7.0);
  console.log('✓ Carry forward balance set:', adjustResult.carriedForwardBalance, 'Total Paid:', adjustResult.totalPaidLeaveBalance);
  if (adjustResult.carriedForwardBalance !== 7) throw new Error('Expected 7.0 carried forward leaves');

  // 4. Test September (Month 9 - Baseline Month) Encashment
  console.log('\n[TEST 4] Processing September 2026 (Month 9) Salary Encashment...');
  const cycle9 = getAttendanceCycleForMonth(2026, 9);
  const att9 = await calculateAttendanceForCycle(testEmp._id as any, cycle9);
  const sepRecord = await computePayroll(testStructure, att9, 9, 2026);

  console.log('✓ September Gross Pay: ₹', sepRecord.grossSalary);
  console.log('✓ September Leave Conversion Days:', sepRecord.leaveConversionDays);
  console.log('✓ September Leave Conversion Amount: ₹', sepRecord.leaveConversionAmount);
  console.log('✓ September Net Salary: ₹', sepRecord.netSalary);

  if (sepRecord.leaveConversionDays !== 7) throw new Error('September should encash 7 days');
  if (!sepRecord.leaveConversionAmount || sepRecord.leaveConversionAmount <= 0) throw new Error('September should have positive encashment amount');

  // Verify carry forward reset
  const postSepBal = await getEmployeeLeaveBalance(testEmp._id.toString(), 9, 2026);
  console.log('✓ Post-September Carried Forward Balance:', postSepBal.carriedForwardBalance, '(Reset to 0)');
  if (postSepBal.carriedForwardBalance !== 0) throw new Error('Carry forward balance should reset to 0 after encashment');

  // 5. Test October 2026 (Month 10, Gap = 1 Month) -> Should NOT encash
  console.log('\n[TEST 5] Testing October 2026 (Month 10, Gap = 1)...');
  await adjustCarryForward(testEmp._id, 3.0);
  const cycle10 = getAttendanceCycleForMonth(2026, 10);
  const att10 = await calculateAttendanceForCycle(testEmp._id as any, cycle10);
  const octRecord = await computePayroll(testStructure, att10, 10, 2026);
  console.log('✓ October Leave Conversion Days:', octRecord?.leaveConversionDays ?? 0);
  if ((octRecord?.leaveConversionDays ?? 0) !== 0) throw new Error('October should NOT encash leaves (gap is 1 month)');

  // 6. Test November 2026 (Month 11, Gap = 2 Months) -> Should NOT encash
  console.log('\n[TEST 6] Testing November 2026 (Month 11, Gap = 2)...');
  const cycle11 = getAttendanceCycleForMonth(2026, 11);
  const att11 = await calculateAttendanceForCycle(testEmp._id as any, cycle11);
  const novRecord = await computePayroll(testStructure, att11, 11, 2026);
  console.log('✓ November Leave Conversion Days:', novRecord?.leaveConversionDays ?? 0);
  if ((novRecord?.leaveConversionDays ?? 0) !== 0) throw new Error('November should NOT encash leaves (gap is 2 months)');

  // 7. Test December 2026 (Month 12, Gap = 3 Months from September) -> MUST encash!
  console.log('\n[TEST 7] Testing December 2026 (Month 12, Gap = 3 Months from Sept 7 baseline)...');
  const cycle12 = getAttendanceCycleForMonth(2026, 12);
  const att12 = await calculateAttendanceForCycle(testEmp._id as any, cycle12);
  const decRecord = await computePayroll(testStructure, att12, 12, 2026);
  console.log('✓ December Leave Conversion Days:', decRecord?.leaveConversionDays ?? 0);
  console.log('✓ December Leave Conversion Amount: ₹', decRecord?.leaveConversionAmount ?? 0);
  if ((decRecord?.leaveConversionDays ?? 0) !== 3) throw new Error('December MUST encash the 3.0 carried forward leaves');

  // 8. Test Dynamic Config Change in Settings (Change interval to 4 months)
  console.log('\n[TEST 8] Dynamic Settings Change Test (Interval = 4 months)...');
  settings.leaveEncashmentIntervalMonths = 4;
  await settings.save();

  // Clear December conversion from Test 7 to test raw eligibility with interval=4
  await LeaveLedger.deleteMany({
    employee: testEmp._id,
    transactionType: 'ConversionToSalary',
    earnedMonth: 12,
    earnedYear: 2026,
  });

  // With interval = 4 from Month 9, Month 12 (diff = 3) should now NOT be eligible!
  const decCheckWith4 = await convertThreeMonthUnusedLeaveToSalary(testEmp._id as any, 12, 2026, 961.54);
  console.log('✓ With 4-month interval, December converted days:', decCheckWith4.convertedDays);
  if (decCheckWith4.convertedDays !== 0) throw new Error('With 4-month interval, Month 12 should not be eligible');

  // Month 1 (January 2027, diff = 4) SHOULD be eligible!
  await adjustCarryForward(testEmp._id, 2.0);
  const janCheckWith4 = await convertThreeMonthUnusedLeaveToSalary(testEmp._id as any, 1, 2027, 961.54);
  console.log('✓ With 4-month interval, January 2027 (Month 1) converted days:', janCheckWith4.convertedDays);
  if (janCheckWith4.convertedDays !== 2) throw new Error('With 4-month interval, Month 1 (+4 months) should encash 2 days');

  // Reset back to 3 months standard
  settings.leaveEncashmentIntervalMonths = 3;
  await settings.save();
  console.log('✓ Reverted settings back to standard 3-month gap.');

  console.log('\n=== ALL USER REQUIREMENTS VERIFIED SUCCESSFULLY ===');
  await mongoose.disconnect();
}

runE2ETest().catch((err) => {
  console.error('❌ E2E TEST FAILED:', err);
  process.exit(1);
});
