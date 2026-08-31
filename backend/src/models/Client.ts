import mongoose, { Schema, Document } from 'mongoose';

export interface IClient extends Document {
  legacyId?: number;
  name: string;
  industry?: string;
  isActive: boolean;
  notes?: string;
}

const clientSchema = new Schema<IClient>(
  {
    legacyId: { type: Number, unique: true, sparse: true },
    name: { type: String, required: true, unique: true, trim: true },
    industry: { type: String, default: 'General' },
    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String, default: '' },
  },
  {
    timestamps: true,
  }
);

export const Client = mongoose.model<IClient>('Client', clientSchema);
