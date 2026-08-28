import mongoose, { Schema, Document } from 'mongoose';

export type HolidayType = 'Public' | 'National' | 'Regional' | 'Company' | 'Restricted';

export interface ICompanyHoliday extends Document {
  name: string;
  date: Date;
  dateStr: string; // YYYY-MM-DD in Asia/Kolkata
  holidayType: HolidayType;
  description: string;
  isPaid: boolean;
  applicableToAll: boolean;
  departments: string[];
  employees: mongoose.Types.ObjectId[];
  recurringAnnually: boolean;
  year: number;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId | null;
  updatedBy?: mongoose.Types.ObjectId | null;
}

const companyHolidaySchema = new Schema<ICompanyHoliday>(
  {
    name: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    dateStr: { type: String, required: true, unique: true, index: true },
    holidayType: {
      type: String,
      enum: ['Public', 'National', 'Regional', 'Company', 'Restricted'],
      default: 'Company',
    },
    description: { type: String, default: '', trim: true },
    isPaid: { type: Boolean, default: true },
    applicableToAll: { type: Boolean, default: true },
    departments: { type: [String], default: [] },
    employees: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
    recurringAnnually: { type: Boolean, default: false },
    year: { type: Number, required: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
  }
);

companyHolidaySchema.index({ date: 1 });
companyHolidaySchema.index({ year: 1, isActive: 1 });

export const CompanyHoliday = mongoose.model<ICompanyHoliday>('CompanyHoliday', companyHolidaySchema);
