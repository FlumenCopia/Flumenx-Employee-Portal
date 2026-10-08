import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Employee } from '../models/Employee.js';
import { LeaveLedger } from '../models/LeaveLedger.js';
import { PayrollRecord } from '../models/PayrollRecord.js';
import { getEmployeeLeaveBalance } from '../services/leaveEngine.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/flumenx_portal');
  console.log('Connected to MongoDB');

  const allSpecial = await LeaveLedger.find({
    transactionType: { $in: ['ConversionToSalary', 'ManualAdjustment'] }
  });
  console.log(`Special Transactions across ALL employees: ${allSpecial.length}`);
  allSpecial.forEach(s => console.log('Special tx:', s));

  const allPayrollsWithLeaves = await PayrollRecord.find({
    $or: [
      { leaveConversionDays: { $gt: 0 } },
      { leaveConversionAmount: { $gt: 0 } }
    ]
  });
  console.log(`Payrolls with Leave Conversions: ${allPayrollsWithLeaves.length}`);
  allPayrollsWithLeaves.forEach(p => console.log('Payroll with leave conv:', p));

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
