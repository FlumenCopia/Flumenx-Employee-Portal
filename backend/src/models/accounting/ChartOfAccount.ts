import mongoose, { Schema, Document } from 'mongoose';

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export type AccountSubtype =
  // Assets
  | 'CASH'
  | 'BANK'
  | 'ACCOUNTS_RECEIVABLE'
  | 'CURRENT_ASSET'
  | 'PREPAID_EXPENSE'
  | 'FIXED_ASSET'
  | 'ACCUMULATED_DEPRECIATION'
  | 'NON_CURRENT_ASSET'
  // Liabilities
  | 'ACCOUNTS_PAYABLE'
  | 'CURRENT_LIABILITY'
  | 'PAYROLL_PAYABLE'
  | 'TAX_PAYABLE'
  | 'NON_CURRENT_LIABILITY'
  | 'LOAN'
  // Equity
  | 'EQUITY'
  | 'RETAINED_EARNINGS'
  | 'CAPITAL'
  // Revenue
  | 'DIRECT_REVENUE'
  | 'INDIRECT_REVENUE'
  | 'SERVICE_REVENUE'
  | 'OTHER_INCOME'
  // Expense
  | 'DIRECT_EXPENSE'
  | 'OPERATING_EXPENSE'
  | 'EMPLOYEE_EXPENSE'
  | 'OFFICE_EXPENSE'
  | 'TECH_EXPENSE'
  | 'SALES_EXPENSE'
  | 'DEPRECIATION_EXPENSE'
  | 'FINANCE_EXPENSE';

export type BalanceNature = 'DEBIT' | 'CREDIT';

export interface IChartOfAccount extends Document {
  code: string; // e.g., "1110", "2110", "4010"
  name: string;
  type: AccountType;
  subtype: AccountSubtype;
  parentAccount?: mongoose.Types.ObjectId | null;
  nature: BalanceNature; // Natural balance side
  openingBalance: number;
  openingBalanceDate?: Date | null;
  currentBalance: number; // Cache of net balance (derived from journal lines)
  totalDebit: number;
  totalCredit: number;
  isActive: boolean;
  isSystemAccount: boolean; // Protected system accounts (Cash, Bank, A/R, A/P, Payroll, Retained Earnings)
  description?: string;
  currency: string;
  taxRate?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const chartOfAccountSchema = new Schema<IChartOfAccount>(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'],
      index: true,
    },
    subtype: {
      type: String,
      required: true,
      index: true,
    },
    parentAccount: { type: Schema.Types.ObjectId, ref: 'ChartOfAccount', default: null },
    nature: {
      type: String,
      required: true,
      enum: ['DEBIT', 'CREDIT'],
    },
    openingBalance: { type: Number, default: 0 },
    openingBalanceDate: { type: Date, default: null },
    currentBalance: { type: Number, default: 0 },
    totalDebit: { type: Number, default: 0 },
    totalCredit: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    isSystemAccount: { type: Boolean, default: false },
    description: { type: String, default: '' },
    currency: { type: String, default: 'INR' },
    taxRate: { type: Schema.Types.ObjectId, ref: 'TaxRate', default: null },
  },
  {
    timestamps: true,
  }
);

chartOfAccountSchema.index({ type: 1, subtype: 1 });
chartOfAccountSchema.index({ parentAccount: 1 });

export const ChartOfAccount = mongoose.model<IChartOfAccount>('ChartOfAccount', chartOfAccountSchema);
