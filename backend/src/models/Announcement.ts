import mongoose, { Schema, Document } from 'mongoose';

export type PriorityLevel = 'Normal' | 'Important' | 'Urgent';

export interface IAnnouncement extends Document {
  legacyId?: number;
  title: string;
  message: string;
  date: Date;
  priority: PriorityLevel;
  createdBy?: mongoose.Types.ObjectId | null;
}

const announcementSchema = new Schema<IAnnouncement>(
  {
    legacyId: { type: Number, unique: true, sparse: true, index: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    date: { type: Date, default: Date.now },
    priority: { type: String, enum: ['Normal', 'Important', 'Urgent'], default: 'Normal' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
  }
);

announcementSchema.index({ date: -1 });

export const Announcement = mongoose.model<IAnnouncement>('Announcement', announcementSchema);
