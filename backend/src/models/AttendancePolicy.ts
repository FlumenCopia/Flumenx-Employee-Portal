import mongoose, { Schema, Document } from 'mongoose';

export interface IAttendancePolicy extends Document {
  officeStartTime: string;
  gracePeriodMinutes: number;
  officeEndTime: string;
  earlyCheckoutHalfDayCutoff: string;
  halfDayHours: number;
  fullDayHours: number;
  officeLatitude: number;
  officeLongitude: number;
  allowedRadiusMeters: number;
  activeQrReference: string;
}

const attendancePolicySchema = new Schema<IAttendancePolicy>(
  {
    officeStartTime: { type: String, default: '09:30' },
    gracePeriodMinutes: { type: Number, default: 5 },
    officeEndTime: { type: String, default: '18:30' },
    earlyCheckoutHalfDayCutoff: { type: String, default: '18:00' },
    halfDayHours: { type: Number, default: 4 },
    fullDayHours: { type: Number, default: 8 },
    officeLatitude: { type: Number, default: 8.5213442 },
    officeLongitude: { type: Number, default: 76.97848305555556 },
    allowedRadiusMeters: { type: Number, default: 200 },
    activeQrReference: { type: String, default: 'FLUMENX-HQ' },
  },
  {
    timestamps: true,
  }
);

export const AttendancePolicy = mongoose.model<IAttendancePolicy>('AttendancePolicy', attendancePolicySchema);
