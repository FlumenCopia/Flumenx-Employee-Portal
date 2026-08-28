import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomHeadEntry {
  head?: mongoose.Types.ObjectId | null;
  headCode: string;
  name: string;
  amount: number;
  type: 'Earning' | 'Deduction' | 'EmployerContribution';
}

export interface IEmployeeSalaryStructure extends Document {
  employee: mongoose.Types.ObjectId;
  effectiveFrom: Date;
  ctc: number;
  grossSalary: number;
  basicSalary: number;
  hra: number;
  conveyance: number;
  specialAllowance: number;
  otherAllowances: number;
  
  // PF Configuration
  pfEnabled: boolean;
  pfEmployeePercent: number;
  pfEmployerPercent: number;
  pfWageCeiling: number; // 15000 default ceiling in India, 0 if uncapped

  // ESI Configuration
  esiEnabled: boolean;
  esiEmployeePercent: number;
  esiEmployerPercent: number;
  esiGrossCeiling: number; // 21000 default ceiling in India

  // Other statutory & tax
  professionalTax: number;
  tds: number;

  customHeads: ICustomHeadEntry[];
  isActive: boolean;
  notes?: string;
  updatedBy?: mongoose.Types.ObjectId | null;
}

const employeeSalaryStructureSchema = new Schema<IEmployeeSalaryStructure>(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, unique: true, index: true },
    effectiveFrom: { type: Date, default: Date.now },
    ctc: { type: Number, default: 0 },
    grossSalary: { type: Number, required: true, default: 0 },
    basicSalary: { type: Number, required: true, default: 0 },
    hra: { type: Number, default: 0 },
    conveyance: { type: Number, default: 0 },
    specialAllowance: { type: Number, default: 0 },
    otherAllowances: { type: Number, default: 0 },

    pfEnabled: { type: Boolean, default: true },
    pfEmployeePercent: { type: Number, default: 12 },
    pfEmployerPercent: { type: Number, default: 12 },
    pfWageCeiling: { type: Number, default: 15000 },

    esiEnabled: { type: Boolean, default: false },
    esiEmployeePercent: { type: Number, default: 0.75 },
    esiEmployerPercent: { type: Number, default: 3.25 },
    esiGrossCeiling: { type: Number, default: 21000 },

    professionalTax: { type: Number, default: 200 },
    tds: { type: Number, default: 0 },

    customHeads: [
      {
        head: { type: Schema.Types.ObjectId, ref: 'SalaryHead', default: null },
        headCode: { type: String, required: true },
        name: { type: String, required: true },
        amount: { type: Number, required: true, default: 0 },
        type: { type: String, enum: ['Earning', 'Deduction', 'EmployerContribution'], required: true },
      },
    ],
    isActive: { type: Boolean, default: true },
    notes: { type: String, default: '' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
  }
);

export const EmployeeSalaryStructure = mongoose.model<IEmployeeSalaryStructure>(
  'EmployeeSalaryStructure',
  employeeSalaryStructureSchema
);
