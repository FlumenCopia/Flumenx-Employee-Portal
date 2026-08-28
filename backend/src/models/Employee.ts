import mongoose, { Schema, Document } from 'mongoose';

export type EmployeeStatus = 'Active' | 'On Leave' | 'Inactive';
export type EmploymentStatus = 'Probation' | 'Permanent' | 'Contract' | 'Intern';

export interface IEmployee extends Document {
  legacyId?: number;
  user?: mongoose.Types.ObjectId | null;
  employeeCode: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  departmentRef?: mongoose.Types.ObjectId | null;
  designation: string;
  joiningDate: Date;
  status: EmployeeStatus;
  employmentStatus: EmploymentStatus;
  probationStartDate?: Date | null;
  probationEndDate?: Date | null;
  confirmationDate?: Date | null;
  exitDate?: Date | null;
  avatar: string;
  location: string;
  teamLead?: mongoose.Types.ObjectId | null;
}

const employeeSchema = new Schema<IEmployee>(
  {
    legacyId: { type: Number, unique: true, sparse: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', unique: true, sparse: true },
    employeeCode: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    department: { type: String, required: true },
    departmentRef: { type: Schema.Types.ObjectId, ref: 'Department', default: null },
    designation: { type: String, required: true, trim: true },
    joiningDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['Active', 'On Leave', 'Inactive'],
      default: 'Active',
    },
    employmentStatus: {
      type: String,
      enum: ['Probation', 'Permanent', 'Contract', 'Intern'],
      default: 'Permanent',
      index: true,
    },
    probationStartDate: { type: Date, default: null },
    probationEndDate: { type: Date, default: null },
    confirmationDate: { type: Date, default: null },
    exitDate: { type: Date, default: null },
    avatar: { type: String, default: '' },
    location: { type: String, default: '' },
    teamLead: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
  },
  {
    timestamps: true,
  }
);

employeeSchema.index({ status: 1, name: 1 });
employeeSchema.index({ department: 1, status: 1 });

export const Employee = mongoose.model<IEmployee>('Employee', employeeSchema);
