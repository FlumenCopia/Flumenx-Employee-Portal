import mongoose, { Schema, Document } from 'mongoose';

export interface IEmployeeKPIRating extends Document {
  legacyId?: number;
  employee?: mongoose.Types.ObjectId | null;
  month: number;
  year: number;
  rating: number;
  notes?: string;
  ratedBy?: mongoose.Types.ObjectId | null;
}

const employeeKPIRatingSchema = new Schema<IEmployeeKPIRating>(
  {
    legacyId: { type: Number, unique: true, sparse: true, index: true },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    rating: { type: Number, default: 5.0, min: 1.0, max: 5.0 },
    notes: { type: String, default: '' },
    ratedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
  }
);

employeeKPIRatingSchema.index({ year: -1, month: -1 });
employeeKPIRatingSchema.index({ employee: 1, month: 1, year: 1 }, { unique: true, partialFilterExpression: { employee: { $ne: null } } });

export const EmployeeKPIRating = mongoose.model<IEmployeeKPIRating>(
  'EmployeeKPIRating',
  employeeKPIRatingSchema
);
