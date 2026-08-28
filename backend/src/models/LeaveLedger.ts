import mongoose, { Schema, Document } from 'mongoose';

export type LeaveLedgerTransactionType =
  | 'OpeningBalance'
  | 'MonthlyAccrual'
  | 'Availed'
  | 'ConversionToSalary'
  | 'Expired'
  | 'ManualAdjustment';

export interface ILeaveLedger extends Document {
  employee: mongoose.Types.ObjectId;
  leaveType: 'Sick' | 'Casual' | 'Annual' | 'Unpaid';
  transactionType: LeaveLedgerTransactionType;
  quantity: number; // positive for additions, negative for deductions
  balanceAfter: number;
  transactionDate: Date;
  earnedMonth?: number; // 1-12
  earnedYear?: number;
  conversionAmount?: number; // ₹ generated if converted to salary
  payrollRecord?: mongoose.Types.ObjectId | null;
  notes?: string;
  createdBy?: mongoose.Types.ObjectId | null;
}

const leaveLedgerSchema = new Schema<ILeaveLedger>(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    leaveType: {
      type: String,
      enum: ['Sick', 'Casual', 'Annual', 'Unpaid'],
      required: true,
      index: true,
    },
    transactionType: {
      type: String,
      enum: ['OpeningBalance', 'MonthlyAccrual', 'Availed', 'ConversionToSalary', 'Expired', 'ManualAdjustment'],
      required: true,
    },
    quantity: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    transactionDate: { type: Date, default: Date.now, index: true },
    earnedMonth: { type: Number, default: null },
    earnedYear: { type: Number, default: null },
    conversionAmount: { type: Number, default: 0 },
    payrollRecord: { type: Schema.Types.ObjectId, ref: 'PayrollRecord', default: null },
    notes: { type: String, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
  }
);

leaveLedgerSchema.index({ employee: 1, leaveType: 1, transactionDate: -1 });

export const LeaveLedger = mongoose.model<ILeaveLedger>('LeaveLedger', leaveLedgerSchema);
