import mongoose, { Schema, Document } from 'mongoose';

// ==========================================
// 1. TAX CONFIGURATION
// ==========================================
export type TaxType = 'OUTPUT_TAX' | 'INPUT_TAX' | 'TDS_PAYABLE' | 'TCS' | 'EXEMPT';

export interface ITaxRate extends Document {
  name: string;
  code: string;
  ratePercentage: number;
  taxType: TaxType;
  glAccount: mongoose.Types.ObjectId; // ChartOfAccount link
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const taxRateSchema = new Schema<ITaxRate>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true },
    ratePercentage: { type: Number, required: true, min: 0, max: 100 },
    taxType: {
      type: String,
      required: true,
      enum: ['OUTPUT_TAX', 'INPUT_TAX', 'TDS_PAYABLE', 'TCS', 'EXEMPT'],
      default: 'OUTPUT_TAX',
    },
    glAccount: { type: Schema.Types.ObjectId, ref: 'ChartOfAccount', required: true },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
  }
);

export const TaxRate = mongoose.model<ITaxRate>('TaxRate', taxRateSchema);

// ==========================================
// 2. FIXED ASSETS & DEPRECIATION
// ==========================================
export type DepreciationMethodType = 'STRAIGHT_LINE' | 'WRITTEN_DOWN_VALUE';
export type AssetStatus = 'ACTIVE' | 'DISPOSED' | 'SOLD';

export interface IFixedAsset extends Document {
  assetCode: string;
  name: string;
  category: string; // "Computer Hardware", "Office Furniture", "Equipment"
  purchaseDate: Date;
  purchaseCost: number;
  residualValue: number;
  usefulLifeMonths: number;
  depreciationMethod: DepreciationMethodType;
  assetAccount: mongoose.Types.ObjectId; // 1200 Fixed Asset GL Account
  accumulatedDepreciationAccount: mongoose.Types.ObjectId; // 1215 Contra Asset GL
  depreciationExpenseAccount: mongoose.Types.ObjectId; // 5610 Expense GL
  currentBookValue: number;
  accumulatedDepreciation: number;
  status: AssetStatus;
  assignedEmployee?: mongoose.Types.ObjectId | null;
  location?: string;
  serialNumber?: string;
  lastDepreciationDate?: Date | null;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const fixedAssetSchema = new Schema<IFixedAsset>(
  {
    assetCode: { type: String, required: true, unique: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, index: true },
    purchaseDate: { type: Date, required: true },
    purchaseCost: { type: Number, required: true, min: 0 },
    residualValue: { type: Number, default: 0, min: 0 },
    usefulLifeMonths: { type: Number, required: true, min: 1 },
    depreciationMethod: {
      type: String,
      required: true,
      enum: ['STRAIGHT_LINE', 'WRITTEN_DOWN_VALUE'],
      default: 'STRAIGHT_LINE',
    },
    assetAccount: { type: Schema.Types.ObjectId, ref: 'ChartOfAccount', required: true },
    accumulatedDepreciationAccount: { type: Schema.Types.ObjectId, ref: 'ChartOfAccount', required: true },
    depreciationExpenseAccount: { type: Schema.Types.ObjectId, ref: 'ChartOfAccount', required: true },
    currentBookValue: { type: Number, required: true },
    accumulatedDepreciation: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      required: true,
      enum: ['ACTIVE', 'DISPOSED', 'SOLD'],
      default: 'ACTIVE',
      index: true,
    },
    assignedEmployee: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    location: { type: String, default: 'Head Office' },
    serialNumber: { type: String, default: '' },
    lastDepreciationDate: { type: Date, default: null },
    notes: { type: String, default: '' },
  },
  {
    timestamps: true,
  }
);

export const FixedAsset = mongoose.model<IFixedAsset>('FixedAsset', fixedAssetSchema);

// ==========================================
// 3. COST CENTERS & PROFITABILITY
// ==========================================
export interface ICostCenter extends Document {
  code: string;
  name: string;
  category: 'DEPARTMENT' | 'PROJECT' | 'CLIENT' | 'GENERAL';
  departmentRef?: mongoose.Types.ObjectId | null;
  projectRef?: mongoose.Types.ObjectId | null;
  clientRef?: mongoose.Types.ObjectId | null;
  isActive: boolean;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const costCenterSchema = new Schema<ICostCenter>(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: ['DEPARTMENT', 'PROJECT', 'CLIENT', 'GENERAL'],
      default: 'GENERAL',
    },
    departmentRef: { type: Schema.Types.ObjectId, ref: 'Department', default: null },
    projectRef: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    clientRef: { type: Schema.Types.ObjectId, ref: 'Client', default: null },
    isActive: { type: Boolean, default: true, index: true },
    description: { type: String, default: '' },
  },
  {
    timestamps: true,
  }
);

export const CostCenter = mongoose.model<ICostCenter>('CostCenter', costCenterSchema);

// ==========================================
// 4. BUDGETS
// ==========================================
export interface IBudgetLine {
  _id?: mongoose.Types.ObjectId;
  account: mongoose.Types.ObjectId;
  monthlyAllocations: number[]; // 12 months array
  totalAnnualBudget: number;
}

export interface IBudget extends Document {
  name: string;
  fiscalYear: string; // e.g. "FY 2026-27"
  costCenter?: mongoose.Types.ObjectId | null;
  lines: IBudgetLine[];
  totalBudget: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const budgetLineSchema = new Schema<IBudgetLine>(
  {
    account: { type: Schema.Types.ObjectId, ref: 'ChartOfAccount', required: true },
    monthlyAllocations: {
      type: [Number],
      validate: (arr: number[]) => arr.length === 12,
      default: () => Array(12).fill(0),
    },
    totalAnnualBudget: { type: Number, required: true, default: 0 },
  },
  { _id: true }
);

const budgetSchema = new Schema<IBudget>(
  {
    name: { type: String, required: true, trim: true },
    fiscalYear: { type: String, required: true, trim: true, index: true },
    costCenter: { type: Schema.Types.ObjectId, ref: 'CostCenter', default: null },
    lines: [budgetLineSchema],
    totalBudget: { type: Number, required: true, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

export const Budget = mongoose.model<IBudget>('Budget', budgetSchema);

// ==========================================
// 5. FISCAL YEAR & ACCOUNTING PERIODS
// ==========================================
export interface IFiscalYear extends Document {
  name: string; // "FY 2026-27"
  startDate: Date;
  endDate: Date;
  isClosed: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const fiscalYearSchema = new Schema<IFiscalYear>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isClosed: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

export const FiscalYear = mongoose.model<IFiscalYear>('FiscalYear', fiscalYearSchema);

export interface IAccountingPeriod extends Document {
  fiscalYear: mongoose.Types.ObjectId;
  month: number; // 1-12
  year: number;
  startDate: Date;
  endDate: Date;
  status: 'OPEN' | 'LOCKED' | 'CLOSED';
  closingChecklist: {
    bankReconciled: boolean;
    payablesReviewed: boolean;
    receivablesReviewed: boolean;
    payrollPosted: boolean;
    depreciationRun: boolean;
    trialBalanceVerified: boolean;
  };
  lockedAt?: Date | null;
  lockedBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const accountingPeriodSchema = new Schema<IAccountingPeriod>(
  {
    fiscalYear: { type: Schema.Types.ObjectId, ref: 'FiscalYear', required: true, index: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      required: true,
      enum: ['OPEN', 'LOCKED', 'CLOSED'],
      default: 'OPEN',
      index: true,
    },
    closingChecklist: {
      bankReconciled: { type: Boolean, default: false },
      payablesReviewed: { type: Boolean, default: false },
      receivablesReviewed: { type: Boolean, default: false },
      payrollPosted: { type: Boolean, default: false },
      depreciationRun: { type: Boolean, default: false },
      trialBalanceVerified: { type: Boolean, default: false },
    },
    lockedAt: { type: Date, default: null },
    lockedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
  }
);

accountingPeriodSchema.index({ year: 1, month: 1 }, { unique: true });

export const AccountingPeriod = mongoose.model<IAccountingPeriod>('AccountingPeriod', accountingPeriodSchema);
