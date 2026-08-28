import mongoose, { Schema, Document } from 'mongoose';

export type SalaryHeadType = 'Earning' | 'Deduction' | 'EmployerContribution';
export type CalculationType = 'Fixed' | 'Percentage' | 'Formula';

export interface ISalaryHead extends Document {
  name: string;
  code: string;
  type: SalaryHeadType;
  calculationType: CalculationType;
  percentage: number;
  percentageBaseHead: string; // e.g. "BASIC" or "GROSS"
  formula: string; // e.g. "BASIC * 0.40"
  defaultAmount: number;
  isStatutory: boolean; // e.g. PF, ESI, Professional Tax
  taxable: boolean;
  pfEligible: boolean;
  esiEligible: boolean;
  includedInGross: boolean;
  includedInNet: boolean;
  isActive: boolean;
  displayOrder: number;
  description: string;
}

const salaryHeadSchema = new Schema<ISalaryHead>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    type: {
      type: String,
      enum: ['Earning', 'Deduction', 'EmployerContribution'],
      required: true,
    },
    calculationType: {
      type: String,
      enum: ['Fixed', 'Percentage', 'Formula'],
      default: 'Fixed',
    },
    percentage: { type: Number, default: 0 },
    percentageBaseHead: { type: String, default: 'BASIC', uppercase: true, trim: true },
    formula: { type: String, default: '', trim: true },
    defaultAmount: { type: Number, default: 0 },
    isStatutory: { type: Boolean, default: false },
    taxable: { type: Boolean, default: true },
    pfEligible: { type: Boolean, default: false },
    esiEligible: { type: Boolean, default: false },
    includedInGross: { type: Boolean, default: true },
    includedInNet: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
    description: { type: String, default: '', trim: true },
  },
  {
    timestamps: true,
  }
);

salaryHeadSchema.index({ type: 1, displayOrder: 1 });

export const SalaryHead = mongoose.model<ISalaryHead>('SalaryHead', salaryHeadSchema);
