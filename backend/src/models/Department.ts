import mongoose, { Schema, Document } from 'mongoose';

export interface IDepartment extends Document {
  legacyId?: number;
  name: string;
  code: string;
  description: string;
  isActive: boolean;
  displayOrder: number;
}

const departmentSchema = new Schema<IDepartment>(
  {
    legacyId: { type: Number, unique: true, sparse: true, index: true },
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

departmentSchema.index({ displayOrder: 1, name: 1 });

export const Department = mongoose.model<IDepartment>('Department', departmentSchema);
