import mongoose, { Schema, Document } from 'mongoose';

export interface IMeeting extends Document {
  legacyId?: number;
  title: string;
  date: Date;
  time: string;
  description: string;
  department: string;
  location: string;
  createdBy?: mongoose.Types.ObjectId | null;
}

const meetingSchema = new Schema<IMeeting>(
  {
    legacyId: { type: Number, unique: true, sparse: true, index: true },
    title: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    description: { type: String, default: '' },
    department: { type: String, default: 'All Employees' },
    location: { type: String, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
  }
);

meetingSchema.index({ date: 1, time: 1 });
meetingSchema.index({ department: 1, date: 1 });

export const Meeting = mongoose.model<IMeeting>('Meeting', meetingSchema);
