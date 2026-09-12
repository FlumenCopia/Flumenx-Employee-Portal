import mongoose, { Schema, Document } from 'mongoose';

export type VoucherType =
  | 'SALES'
  | 'PURCHASE'
  | 'RECEIPT'
  | 'PAYMENT'
  | 'CONTRA'
  | 'JOURNAL'
  | 'CREDIT_NOTE'
  | 'DEBIT_NOTE'
  | 'PAYROLL'
  | 'DEPRECIATION'
  | 'ADJUSTMENT'
  | 'OPENING_BALANCE';

export type JournalStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'POSTED' | 'REVERSED' | 'CANCELLED';

export type TransactionSourceType =
  | 'INVOICE'
  | 'BILL'
  | 'EXPENSE'
  | 'RECEIPT'
  | 'PAYMENT'
  | 'PAYROLL'
  | 'DEPRECIATION'
  | 'FIXED_ASSET'
  | 'MANUAL';

export interface IJournalEntryLine {
  _id?: mongoose.Types.ObjectId;
  account: mongoose.Types.ObjectId;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description?: string;
  client?: mongoose.Types.ObjectId | null;
  project?: mongoose.Types.ObjectId | null;
  employee?: mongoose.Types.ObjectId | null;
  costCenter?: mongoose.Types.ObjectId | null;
  partyType?: 'CLIENT' | 'VENDOR' | 'EMPLOYEE' | 'OTHER' | 'NONE';
  partyName?: string;
  partyReference?: string;
}

export interface IJournalEntry extends Document {
  journalNumber: string; // e.g. "JV-2026-0001"
  date: Date;
  voucherType: VoucherType;
  referenceNumber?: string;
  sourceType: TransactionSourceType;
  sourceId?: mongoose.Types.ObjectId | null;
  description: string;
  client?: mongoose.Types.ObjectId | null;
  clientName?: string;
  clientReference?: string;
  status: JournalStatus;
  totalDebit: number;
  totalCredit: number;
  lines: IJournalEntryLine[];
  isReversed: boolean;
  reversalOf?: mongoose.Types.ObjectId | null;
  reversalJournal?: mongoose.Types.ObjectId | null;
  reversalReason?: string;
  createdBy?: mongoose.Types.ObjectId | null;
  approvedBy?: mongoose.Types.ObjectId | null;
  postedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const journalEntryLineSchema = new Schema<IJournalEntryLine>(
  {
    account: { type: Schema.Types.ObjectId, ref: 'ChartOfAccount', required: true, index: true },
    accountCode: { type: String, required: true },
    accountName: { type: String, required: true },
    debit: { type: Number, required: true, min: 0, default: 0 },
    credit: { type: Number, required: true, min: 0, default: 0 },
    description: { type: String, default: '' },
    client: { type: Schema.Types.ObjectId, ref: 'Client', default: null, index: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', default: null, index: true },
    costCenter: { type: Schema.Types.ObjectId, ref: 'CostCenter', default: null, index: true },
    partyType: { type: String, enum: ['CLIENT', 'VENDOR', 'EMPLOYEE', 'OTHER', 'NONE'], default: 'NONE' },
    partyName: { type: String, default: '' },
    partyReference: { type: String, default: '' },
  },
  { _id: true }
);

const journalEntrySchema = new Schema<IJournalEntry>(
  {
    journalNumber: { type: String, required: true, unique: true, trim: true, index: true },
    date: { type: Date, required: true, index: true },
    voucherType: {
      type: String,
      required: true,
      enum: [
        'SALES',
        'PURCHASE',
        'RECEIPT',
        'PAYMENT',
        'CONTRA',
        'JOURNAL',
        'CREDIT_NOTE',
        'DEBIT_NOTE',
        'PAYROLL',
        'DEPRECIATION',
        'ADJUSTMENT',
        'OPENING_BALANCE',
      ],
      index: true,
    },
    referenceNumber: { type: String, default: '', trim: true },
    client: { type: Schema.Types.ObjectId, ref: 'Client', default: null, index: true },
    clientName: { type: String, default: '' },
    clientReference: { type: String, default: '' },
    sourceType: {
      type: String,
      default: 'MANUAL',
      enum: ['INVOICE', 'BILL', 'EXPENSE', 'RECEIPT', 'PAYMENT', 'PAYROLL', 'DEPRECIATION', 'FIXED_ASSET', 'MANUAL'],
      index: true,
    },
    sourceId: { type: Schema.Types.ObjectId, default: null, index: true },
    description: { type: String, required: true, trim: true },
    status: {
      type: String,
      required: true,
      enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'REVERSED', 'CANCELLED'],
      default: 'DRAFT',
      index: true,
    },
    totalDebit: { type: Number, required: true, min: 0, default: 0 },
    totalCredit: { type: Number, required: true, min: 0, default: 0 },
    lines: {
      type: [journalEntryLineSchema],
      validate: {
        validator: function (lines: IJournalEntryLine[]) {
          return lines && lines.length >= 2;
        },
        message: 'A journal entry must contain at least 2 lines (at least one debit and one credit).',
      },
    },
    isReversed: { type: Boolean, default: false },
    reversalOf: { type: Schema.Types.ObjectId, ref: 'JournalEntry', default: null },
    reversalJournal: { type: Schema.Types.ObjectId, ref: 'JournalEntry', default: null },
    reversalReason: { type: String, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    postedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

// Double-Entry Balance validation pre-save hook
journalEntrySchema.pre<IJournalEntry>('save', function (next) {
  let debitSum = 0;
  let creditSum = 0;
  for (const line of this.lines) {
    debitSum += Number(line.debit || 0);
    creditSum += Number(line.credit || 0);
  }
  // Round to 2 decimal places to avoid floating point issues
  const roundedDebit = Math.round(debitSum * 100) / 100;
  const roundedCredit = Math.round(creditSum * 100) / 100;

  this.totalDebit = roundedDebit;
  this.totalCredit = roundedCredit;

  if (this.status === 'POSTED' && Math.abs(roundedDebit - roundedCredit) > 0.01) {
    return next(new Error(`Double-Entry Invariant Violation: Total Debits (₹${roundedDebit}) does not equal Total Credits (₹${roundedCredit}). Cannot post unbalanced journal entry.`));
  }
  next();
});

journalEntrySchema.index({ date: -1, status: 1 });
journalEntrySchema.index({ voucherType: 1, date: -1 });

export const JournalEntry = mongoose.model<IJournalEntry>('JournalEntry', journalEntrySchema);
