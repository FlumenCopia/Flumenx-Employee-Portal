import mongoose, { Schema, Document } from 'mongoose';

export type ExpenseApprovalStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'POSTED' | 'REJECTED';

export interface IExpenseTransaction extends Document {
  expenseNumber: string; // e.g. "EXP-2026-0001"
  date: Date;
  title: string;
  category: string;
  expenseAccount: mongoose.Types.ObjectId; // Expense GL Account
  paidFromAccount: mongoose.Types.ObjectId; // Bank, Cash, or Petty Cash GL Account
  vendor?: mongoose.Types.ObjectId | null;
  employee?: mongoose.Types.ObjectId | null; // For reimbursable expenses
  project?: mongoose.Types.ObjectId | null;
  client?: mongoose.Types.ObjectId | null;
  costCenter?: mongoose.Types.ObjectId | null;
  subtotal: number;
  taxRate?: mongoose.Types.ObjectId | null;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: string;
  referenceNumber?: string;
  receiptUrl?: string;
  description?: string;
  approvalStatus: ExpenseApprovalStatus;
  approvedBy?: mongoose.Types.ObjectId | null;
  approvedAt?: Date | null;
  journalEntry?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const expenseTransactionSchema = new Schema<IExpenseTransaction>(
  {
    expenseNumber: { type: String, required: true, unique: true, trim: true, index: true },
    date: { type: Date, required: true, index: true },
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, index: true },
    expenseAccount: { type: Schema.Types.ObjectId, ref: 'ChartOfAccount', required: true, index: true },
    paidFromAccount: { type: Schema.Types.ObjectId, ref: 'ChartOfAccount', required: true, index: true },
    vendor: { type: Schema.Types.ObjectId, ref: 'Vendor', default: null },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    project: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    client: { type: Schema.Types.ObjectId, ref: 'Client', default: null },
    costCenter: { type: Schema.Types.ObjectId, ref: 'CostCenter', default: null },
    subtotal: { type: Number, required: true, min: 0 },
    taxRate: { type: Schema.Types.ObjectId, ref: 'TaxRate', default: null },
    taxAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, default: 'BANK_TRANSFER' },
    referenceNumber: { type: String, default: '' },
    receiptUrl: { type: String, default: '' },
    description: { type: String, default: '' },
    approvalStatus: {
      type: String,
      required: true,
      enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'REJECTED'],
      default: 'DRAFT',
      index: true,
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    journalEntry: { type: Schema.Types.ObjectId, ref: 'JournalEntry', default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
  }
);

expenseTransactionSchema.index({ date: -1, approvalStatus: 1 });
expenseTransactionSchema.index({ category: 1, date: -1 });

export const ExpenseTransaction = mongoose.model<IExpenseTransaction>('ExpenseTransaction', expenseTransactionSchema);
