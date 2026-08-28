import mongoose, { Schema, Document } from 'mongoose';

export interface IPayrollSetting extends Document {
  timezone: string;
  cycleStartDay: number;
  cycleEndDay: number;
  officeStartTime: string;
  gracePeriodMinutes: number;
  lateCountForHalfDay: number;
  noonArrivalCutoff: string;
  probationPaidLeave: number;
  permanentSickLeaveMonthly: number;
  permanentCasualLeaveMonthly: number;
  leaveConversionMonths: number;
  leaveConversionRateBase: 'BASIC' | 'GROSS';
  
  pfEnabled: boolean;
  pfEmployeePercent: number;
  pfEmployerPercent: number;
  pfWageCeiling: number;

  esiEnabled: boolean;
  esiEmployeePercent: number;
  esiEmployerPercent: number;
  esiGrossCeiling: number;

  updatedBy?: mongoose.Types.ObjectId | null;
}

const payrollSettingSchema = new Schema<IPayrollSetting>(
  {
    timezone: { type: String, default: 'Asia/Kolkata' },
    cycleStartDay: { type: Number, default: 25 },
    cycleEndDay: { type: Number, default: 24 },
    officeStartTime: { type: String, default: '09:30' },
    gracePeriodMinutes: { type: Number, default: 5 },
    lateCountForHalfDay: { type: Number, default: 3 },
    noonArrivalCutoff: { type: String, default: '12:00' },
    probationPaidLeave: { type: Number, default: 0 },
    permanentSickLeaveMonthly: { type: Number, default: 1 },
    permanentCasualLeaveMonthly: { type: Number, default: 1 },
    leaveConversionMonths: { type: Number, default: 3 },
    leaveConversionRateBase: { type: String, enum: ['BASIC', 'GROSS'], default: 'BASIC' },

    pfEnabled: { type: Boolean, default: true },
    pfEmployeePercent: { type: Number, default: 12 },
    pfEmployerPercent: { type: Number, default: 12 },
    pfWageCeiling: { type: Number, default: 15000 },

    esiEnabled: { type: Boolean, default: true },
    esiEmployeePercent: { type: Number, default: 0.75 },
    esiEmployerPercent: { type: Number, default: 3.25 },
    esiGrossCeiling: { type: Number, default: 21000 },

    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
  }
);

export const PayrollSetting = mongoose.model<IPayrollSetting>('PayrollSetting', payrollSettingSchema);
