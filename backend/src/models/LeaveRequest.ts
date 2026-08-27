import mongoose, { Schema, Document } from 'mongoose';

export type LeaveType = 'Annual' | 'Sick' | 'Personal' | 'Unpaid';
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';

export interface ILeaveRequest extends Document {
  legacyId?: number;
  employee?: mongoose.Types.ObjectId | null;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  reason: string;
  status: LeaveStatus;
  adminNote?: string;
}

const leaveRequestSchema = new Schema<ILeaveRequest>(
  {
    legacyId: { type: Number, unique: true, sparse: true, index: true },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    leaveType: { type: String, enum: ['Annual', 'Sick', 'Personal', 'Unpaid'], required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
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
