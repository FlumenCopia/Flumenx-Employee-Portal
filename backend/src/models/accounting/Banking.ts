import mongoose, { Schema, Document } from 'mongoose';

export type BankAccountType = 'CURRENT' | 'SAVINGS' | 'OVERDRAFT' | 'CREDIT_CARD' | 'PETTY_CASH';

export interface IBankAccount extends Document {
  accountName: string;
  bankName: string;
  accountNumber: string;
  ifscSwift?: string;
  branchName?: string;
  accountType: BankAccountType;
  currency: string;
  glAccount: mongoose.Types.ObjectId; // ChartOfAccount link
  openingBalance: number;
  currentBalance: number;
  isActive: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const bankAccountSchema = new Schema<IBankAccount>(
  {
    accountName: { type: String, required: true, trim: true },
    bankName: { type: String, required: true, trim: true },
    accountNumber: { type: String, required: true, trim: true },
    ifscSwift: { type: String, default: '', trim: true },
    branchName: { type: String, default: '' },
    accountType: {
      type: String,
      required: true,
      enum: ['CURRENT', 'SAVINGS', 'OVERDRAFT', 'CREDIT_CARD', 'PETTY_CASH'],
      default: 'CURRENT',
    },
    currency: { type: String, default: 'INR' },
    glAccount: { type: Schema.Types.ObjectId, ref: 'ChartOfAccount', required: true, unique: true },
    openingBalance: { type: Number, default: 0 },
    currentBalance: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String, default: '' },
  },
  {
    timestamps: true,
  }
);

export const BankAccount = mongoose.model<IBankAccount>('BankAccount', bankAccountSchema);

export type ReconciliationStatus = 'UNRECONCILED' | 'MATCHED' | 'RECONCILED';

export interface IBankTransaction extends Document {
  bankAccount: mongoose.Types.ObjectId;
  date: Date;
  description: string;
  referenceNumber?: string;
  withdrawalAmount: number;
  depositAmount: number;
  balanceAfter: number;
  matchedJournal?: mongoose.Types.ObjectId | null;
  reconciliationStatus: ReconciliationStatus;
  reconciledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const bankTransactionSchema = new Schema<IBankTransaction>(
  {
    bankAccount: { type: Schema.Types.ObjectId, ref: 'BankAccount', required: true, index: true },
    date: { type: Date, required: true, index: true },
    description: { type: String, required: true, trim: true },
    referenceNumber: { type: String, default: '', trim: true },
    withdrawalAmount: { type: Number, default: 0, min: 0 },
    depositAmount: { type: Number, default: 0, min: 0 },
    balanceAfter: { type: Number, default: 0 },
    matchedJournal: { type: Schema.Types.ObjectId, ref: 'JournalEntry', default: null },
    reconciliationStatus: {
      type: String,
      required: true,
      enum: ['UNRECONCILED', 'MATCHED', 'RECONCILED'],
      default: 'UNRECONCILED',
      index: true,
    },
    reconciledAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

export const BankTransaction = mongoose.model<IBankTransaction>('BankTransaction', bankTransactionSchema);

export interface IBankReconciliation extends Document {
  bankAccount: mongoose.Types.ObjectId;
  statementDate: Date;
  statementClosingBalance: number;
  systemClosingBalance: number;
  reconciledBalance: number;
  difference: number;
  status: 'IN_PROGRESS' | 'RECONCILED';
  reconciledBy?: mongoose.Types.ObjectId | null;
  reconciledAt?: Date | null;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const bankReconciliationSchema = new Schema<IBankReconciliation>(
  {
    bankAccount: { type: Schema.Types.ObjectId, ref: 'BankAccount', required: true, index: true },
    statementDate: { type: Date, required: true, index: true },
    statementClosingBalance: { type: Number, required: true },
    systemClosingBalance: { type: Number, required: true },
    reconciledBalance: { type: Number, required: true, default: 0 },
    difference: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      required: true,
      enum: ['IN_PROGRESS', 'RECONCILED'],
      default: 'IN_PROGRESS',
    },
    reconciledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reconciledAt: { type: Date, default: null },
    notes: { type: String, default: '' },
  },
  {
    timestamps: true,
  }
);

export const BankReconciliation = mongoose.model<IBankReconciliation>('BankReconciliation', bankReconciliationSchema);
