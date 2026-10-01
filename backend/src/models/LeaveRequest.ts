import mongoose, { Schema, Document } from 'mongoose';

export type LeaveType = 'Annual' | 'Sick' | 'Personal' | 'Unpaid' | 'Casual' | 'Emergency';
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';
export type HalfDayPeriod = 'First Half' | 'Second Half' | null;

export interface ILeaveRequest extends Document {
  legacyId?: number;
  employee?: mongoose.Types.ObjectId | null;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  isHalfDay: boolean;
  halfDayPeriod?: HalfDayPeriod;
  daysCount: number;
  reason: string;
  status: LeaveStatus;
  adminNote?: string;
}

const leaveRequestSchema = new Schema<ILeaveRequest>(
  {
    legacyId: { type: Number, unique: true, sparse: true, index: true },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    leaveType: {
      type: String,
      enum: ['Annual', 'Sick', 'Personal', 'Unpaid', 'Casual', 'Emergency'],
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isHalfDay: { type: Boolean, default: false },
    halfDayPeriod: { type: String, enum: ['First Half', 'Second Half', null], default: null },
    daysCount: { type: Number, default: 1 },
    reason: { type: String, required: true },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    adminNote: { type: String, default: '' },
  },
  {
    timestamps: true,
  }
);

leaveRequestSchema.index({ status: 1, createdAt: -1 });

export const LeaveRequest = mongoose.model<ILeaveRequest>('LeaveRequest', leaveRequestSchema);
