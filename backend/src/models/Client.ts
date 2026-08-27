import mongoose, { Schema, Document } from 'mongoose';

export interface IClient extends Document {
  legacyId?: number;
  name: string;
}

const clientSchema = new Schema<IClient>(
  {
    legacyId: { type: Number, unique: true, sparse: true },
    name: { type: String, required: true, unique: true, trim: true },
  },
  {
    timestamps: true,
  }
);

export const Client = mongoose.model<IClient>('Client', clientSchema);
