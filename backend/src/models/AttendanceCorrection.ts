import mongoose, { Schema, Document } from 'mongoose';

export type CorrectionStatus = 'Pending' | 'Approved' | 'Rejected';

export interface IAttendanceCorrection extends Document {
  legacyId?: number;
  employee?: mongoose.Types.ObjectId | null;
  attendanceRecord: mongoose.Types.ObjectId;
  requestedCheckIn?: string | null;
  requestedCheckOut?: string | null;
  reason: string;
  status: CorrectionStatus;
  adminNote?: string;
  reviewedBy?: mongoose.Types.ObjectId | null;
  reviewedAt?: Date | null;
}

const attendanceCorrectionSchema = new Schema<IAttendanceCorrection>(
  {
    legacyId: { type: Number, unique: true, sparse: true, index: true },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    attendanceRecord: { type: Schema.Types.ObjectId, ref: 'AttendanceRecord', required: true },
    requestedCheckIn: { type: String, default: null },
    requestedCheckOut: { type: String, default: null },
    reason: { type: String, required: true },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    adminNote: { type: String, default: '' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

attendanceCorrectionSchema.index({ createdAt: -1 });

export const AttendanceCorrection = mongoose.model<IAttendanceCorrection>(
  'AttendanceCorrection',
  attendanceCorrectionSchema
);
