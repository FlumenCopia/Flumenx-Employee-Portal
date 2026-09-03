import { connectDB } from '../config/db.js';
import mongoose from 'mongoose';
import { Employee } from '../models/Employee.js';
import { EmployeeSalaryStructure } from '../models/EmployeeSalaryStructure.js';
import { PayrollRecord } from '../models/PayrollRecord.js';
import { SalarySlip } from '../models/SalarySlip.js';
import { LeaveLedger } from '../models/LeaveLedger.js';
import { AuditLog } from '../models/AuditLog.js';

async function resetSalariesAndClearPayroll() {
  await connectDB();
  console.log('[Salary Reset] Connected to MongoDB database.');

  // 1. Fetch all employees
  const employees = await Employee.find({});
  console.log(`[Salary Reset] Found ${employees.length} total employees.`);

  // 2. Clear all Salary Slips
  const deletedSlips = await SalarySlip.deleteMany({});
  console.log(`[Salary Reset] Purged ${deletedSlips.deletedCount} SalarySlip documents.`);

  // 3. Clear all Payroll Records (processing, calculations, reviews, payouts)
  const deletedPayrollRecords = await PayrollRecord.deleteMany({});
  console.log(`[Salary Reset] Purged ${deletedPayrollRecords.deletedCount} PayrollRecord documents.`);

  // 4. Clear any Leave Ledger salary conversion entries
  const deletedLeaveConversions = await LeaveLedger.deleteMany({ transactionType: 'ConversionToSalary' });
  console.log(`[Salary Reset] Purged ${deletedLeaveConversions.deletedCount} LeaveLedger 'ConversionToSalary' entries.`);

  // 5. Clear related Audit Logs
  const deletedAudit = await AuditLog.deleteMany({
    entityType: { $in: ['PayrollRecord', 'SalarySlip', 'EmployeeSalaryStructure', 'Payroll'] },
  });
  console.log(`[Salary Reset] Purged ${deletedAudit.deletedCount} payroll/salary audit log entries.`);

  // 6. Reset all EmployeeSalaryStructure records to default zero values
  let updatedCount = 0;
  for (const emp of employees) {
    await EmployeeSalaryStructure.findOneAndUpdate(
      { employee: emp._id },
      {
        $set: {
          employee: emp._id,
          effectiveFrom: new Date(),
          effectiveUntil: null,
          ctc: 0,
          grossSalary: 0,
          basicSalary: 0,
          hra: 0,
          conveyance: 0,
          specialAllowance: 0,
          otherAllowances: 0,
          pfApplicable: false,
          pfEnabled: false,
          voluntaryPfAboveCeiling: false,
          pfEmployeePercent: 12,
          pfEmployerPercent: 12,
          pfWageCeiling: 15000,
          esiApplicable: false,
          esiEnabled: false,
          esiEmployeePercent: 0.75,
          esiEmployerPercent: 3.25,
          esiGrossCeiling: 21000,
          professionalTaxApplicable: false,
          professionalTax: 0,
          tdsApplicable: false,
          tds: 0,
          customHeads: [],
          salaryHistory: [],
          isActive: true,
          notes: 'Default zero salary reset',
        },
      },
      { upsert: true, new: true }
    );
    updatedCount++;
  }

  console.log(`[Salary Reset] Successfully updated/upserted ${updatedCount} EmployeeSalaryStructure records with default 0.`);

  // Verification counts
  const remainingSlips = await SalarySlip.countDocuments();
  const remainingPayroll = await PayrollRecord.countDocuments();
  const activeZeroStructures = await EmployeeSalaryStructure.countDocuments({ grossSalary: 0 });

  console.log('====================================================');
  console.log(`[VERIFICATION] Remaining Salary Slips: ${remainingSlips}`);
  console.log(`[VERIFICATION] Remaining Payroll Records: ${remainingPayroll}`);
  console.log(`[VERIFICATION] Total Zero Salary Structures: ${activeZeroStructures}`);
  console.log('====================================================');
  console.log('[Salary Reset] Reset and cleanup complete.');

  await mongoose.disconnect();
  console.log('[Salary Reset] Disconnected from database.');
  process.exit(0);
}

resetSalariesAndClearPayroll().catch((err) => {
  console.error('[Salary Reset] Fatal error:', err);
  process.exit(1);
});
