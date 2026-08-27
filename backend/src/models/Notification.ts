import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  legacyId?: number;
  user?: mongoose.Types.ObjectId | null;
  title: string;
  message: string;
  category: string;
  isRead: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    legacyId: { type: Number, unique: true, sparse: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    category: { type: String, default: 'General' },
    isRead: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
