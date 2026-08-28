import mongoose, { Schema, Document } from 'mongoose';

export type PayrollStatus = 'Draft' | 'Calculated' | 'Reviewed' | 'Approved' | 'Paid';

export interface IPayrollItemSnapshot {
  code: string;
  name: string;
  amount: number;
}

export interface IAttendanceCycleSnapshot {
  cycleName: string;
  startStr: string;
  endStr: string;
  cycleStart: Date;
  cycleEnd: Date;
  totalCalendarDays: number;
  workingDays: number;
  weekOffs: number;
  companyHolidays: number;
  presentDays: number;
  halfDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  absentDays: number;
  lateArrivalsCount: number;
  lateHalfDayDeductions: number; // e.g. 0.5 for 3 lates, 1.0 for 6 lates
  payableDays: number;
  unpaidDays: number;
}

export interface ISalarySnapshot {
  basicSalary: number;
  hra: number;
  conveyance: number;
  specialAllowance: number;
  otherAllowances: number;
  grossSalary: number;
  earnings: IPayrollItemSnapshot[];
  deductions: IPayrollItemSnapshot[];
  employerContributions: IPayrollItemSnapshot[];
}

export interface IPayrollRecord extends Document {
  employee: mongoose.Types.ObjectId;
  month: number; // 1-12
  year: number;
  attendanceCycle: IAttendanceCycleSnapshot;
  salarySnapshot: ISalarySnapshot;
  
  grossSalary: number;
  totalEarnings: number;
  attendanceDeduction: number;
  pfEmployee: number;
  pfEmployer: number;
  esiEmployee: number;
  esiEmployer: number;
  professionalTax: number;
  tds: number;
  totalDeductions: number;
  netSalary: number;

  status: PayrollStatus;
  payslipFile?: string;
  notes?: string;

  calculatedAt: Date;
  calculatedBy?: mongoose.Types.ObjectId | null;
  approvedAt?: Date | null;
  approvedBy?: mongoose.Types.ObjectId | null;
  paidAt?: Date | null;
}

const payrollRecordSchema = new Schema<IPayrollRecord>(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    attendanceCycle: {
      cycleName: { type: String, required: true },
      startStr: { type: String, required: true },
      endStr: { type: String, required: true },
      cycleStart: { type: Date, required: true },
      cycleEnd: { type: Date, required: true },
      totalCalendarDays: { type: Number, default: 30 },
      workingDays: { type: Number, default: 0 },
      weekOffs: { type: Number, default: 0 },
      companyHolidays: { type: Number, default: 0 },
      presentDays: { type: Number, default: 0 },
      halfDays: { type: Number, default: 0 },
      paidLeaveDays: { type: Number, default: 0 },
      unpaidLeaveDays: { type: Number, default: 0 },
      absentDays: { type: Number, default: 0 },
      lateArrivalsCount: { type: Number, default: 0 },
      lateHalfDayDeductions: { type: Number, default: 0 },
      payableDays: { type: Number, default: 0 },
      unpaidDays: { type: Number, default: 0 },
    },
    salarySnapshot: {
      basicSalary: { type: Number, default: 0 },
      hra: { type: Number, default: 0 },
      conveyance: { type: Number, default: 0 },
      specialAllowance: { type: Number, default: 0 },
      otherAllowances: { type: Number, default: 0 },
      grossSalary: { type: Number, default: 0 },
      earnings: [
        {
          code: { type: String, required: true },
          name: { type: String, required: true },
          amount: { type: Number, required: true },
        },
      ],
      deductions: [
        {
          code: { type: String, required: true },
          name: { type: String, required: true },
          amount: { type: Number, required: true },
        },
      ],
      employerContributions: [
        {
          code: { type: String, required: true },
          name: { type: String, required: true },
          amount: { type: Number, required: true },
        },
      ],
    },
    grossSalary: { type: Number, required: true, default: 0 },
    totalEarnings: { type: Number, required: true, default: 0 },
    attendanceDeduction: { type: Number, default: 0 },
    pfEmployee: { type: Number, default: 0 },
    pfEmployer: { type: Number, default: 0 },
    esiEmployee: { type: Number, default: 0 },
    esiEmployer: { type: Number, default: 0 },
    professionalTax: { type: Number, default: 0 },
    tds: { type: Number, default: 0 },
    totalDeductions: { type: Number, required: true, default: 0 },
    netSalary: { type: Number, required: true, default: 0 },

    status: {
      type: String,
      enum: ['Draft', 'Calculated', 'Reviewed', 'Approved', 'Paid'],
      default: 'Draft',
      index: true,
    },
    payslipFile: { type: String, default: '' },
    notes: { type: String, default: '' },

    calculatedAt: { type: Date, default: Date.now },
    calculatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    paidAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

payrollRecordSchema.index({ employee: 1, month: 1, year: 1 }, { unique: true });
payrollRecordSchema.index({ year: -1, month: -1, status: 1 });

export const PayrollRecord = mongoose.model<IPayrollRecord>('PayrollRecord', payrollRecordSchema);
