import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomHeadEntry {
  head?: mongoose.Types.ObjectId | null;
  headCode: string;
  name: string;
  amount: number;
  type: 'Earning' | 'Deduction' | 'EmployerContribution';
}

export interface ISalaryHistoryEntry {
  effectiveFrom: Date;
  effectiveUntil?: Date | null;
  grossSalary: number;
  basicSalary: number;
  hra: number;
  conveyance: number;
  specialAllowance: number;
  otherAllowances: number;
  pfApplicable: boolean;
  voluntaryPfAboveCeiling: boolean;
  esiApplicable: boolean;
  professionalTaxApplicable: boolean;
  tdsApplicable: boolean;
  customHeads: ICustomHeadEntry[];
  updatedBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  notes?: string;
}

export interface IEmployeeSalaryStructure extends Document {
  employee: mongoose.Types.ObjectId;
  effectiveFrom: Date;
  effectiveUntil?: Date | null;
  ctc: number;
  grossSalary: number;
  basicSalary: number;
  hra: number;
  conveyance: number;
  specialAllowance: number;
  otherAllowances: number;
  
  // Explicit Statutory Flags
  pfApplicable: boolean;
  pfEnabled: boolean; // Alias for backward compatibility
  voluntaryPfAboveCeiling: boolean;
  pfEmployeePercent: number;
  pfEmployerPercent: number;
  pfWageCeiling: number; // 15000 default ceiling in India

  esiApplicable: boolean;
  esiEnabled: boolean; // Alias for backward compatibility
  esiEmployeePercent: number;
  esiEmployerPercent: number;
  esiGrossCeiling: number; // 21000 default ceiling in India

  professionalTaxApplicable: boolean;
  professionalTax: number;
  
  tdsApplicable: boolean;
  tds: number;

  customHeads: ICustomHeadEntry[];
  salaryHistory: ISalaryHistoryEntry[];
  isActive: boolean;
  notes?: string;
  updatedBy?: mongoose.Types.ObjectId | null;
}

const employeeSalaryStructureSchema = new Schema<IEmployeeSalaryStructure>(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, unique: true, index: true },
    effectiveFrom: { type: Date, default: Date.now },
    effectiveUntil: { type: Date, default: null },
    ctc: { type: Number, default: 0 },
    grossSalary: { type: Number, required: true, default: 0 },
    basicSalary: { type: Number, required: true, default: 0 },
    hra: { type: Number, default: 0 },
    conveyance: { type: Number, default: 0 },
    specialAllowance: { type: Number, default: 0 },
    otherAllowances: { type: Number, default: 0 },

    pfApplicable: { type: Boolean, default: true },
    pfEnabled: { type: Boolean, default: true },
    voluntaryPfAboveCeiling: { type: Boolean, default: false },
    pfEmployeePercent: { type: Number, default: 12 },
    pfEmployerPercent: { type: Number, default: 12 },
    pfWageCeiling: { type: Number, default: 15000 },

    esiApplicable: { type: Boolean, default: false },
    esiEnabled: { type: Boolean, default: false },
    esiEmployeePercent: { type: Number, default: 0.75 },
    esiEmployerPercent: { type: Number, default: 3.25 },
    esiGrossCeiling: { type: Number, default: 21000 },

    professionalTaxApplicable: { type: Boolean, default: true },
    professionalTax: { type: Number, default: 200 },
    
    tdsApplicable: { type: Boolean, default: false },
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
    salaryHistory: [
      {
        effectiveFrom: { type: Date, default: Date.now },
        effectiveUntil: { type: Date, default: null },
        grossSalary: { type: Number, default: 0 },
        basicSalary: { type: Number, default: 0 },
        hra: { type: Number, default: 0 },
        conveyance: { type: Number, default: 0 },
        specialAllowance: { type: Number, default: 0 },
        otherAllowances: { type: Number, default: 0 },
        pfApplicable: { type: Boolean, default: true },
        voluntaryPfAboveCeiling: { type: Boolean, default: false },
        esiApplicable: { type: Boolean, default: false },
        professionalTaxApplicable: { type: Boolean, default: true },
        tdsApplicable: { type: Boolean, default: false },
        customHeads: { type: Array, default: [] },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        createdAt: { type: Date, default: Date.now },
        notes: { type: String, default: '' },
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
