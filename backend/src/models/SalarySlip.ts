import mongoose, { Schema, Document } from 'mongoose';

export interface ISalarySlip extends Document {
  legacyId?: number;
  employee?: mongoose.Types.ObjectId | null;
  month: number;
  year: number;
  file: string;
  grossSalary: number;
  netSalary: number;
  basicSalary?: number;
  hra?: number;
  conveyance?: number;
  allowances?: number;
  deductions?: number;
  pf?: number;
  tax?: number;
  uploadedAt: Date;
}

const salarySlipSchema = new Schema<ISalarySlip>(
  {
    legacyId: { type: Number, unique: true, sparse: true, index: true },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    file: { type: String, default: '' },
    grossSalary: { type: Number, default: 0 },
    netSalary: { type: Number, default: 0 },
    basicSalary: { type: Number, default: 0 },
    hra: { type: Number, default: 0 },
    conveyance: { type: Number, default: 0 },
    allowances: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    pf: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

salarySlipSchema.index({ year: -1, month: -1 });
salarySlipSchema.index({ employee: 1, month: 1, year: 1 }, { unique: true, partialFilterExpression: { employee: { $ne: null } } });

export const SalarySlip = mongoose.model<ISalarySlip>('SalarySlip', salarySlipSchema);
