import mongoose, { Schema, Document } from 'mongoose';

export interface IEmployeeDocument extends Document {
  employee: mongoose.Types.ObjectId;
  title: string;
  documentType: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const employeeDocumentSchema = new Schema<IEmployeeDocument>(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    title: { type: String, required: true, trim: true },
    documentType: {
      type: String,
      required: true,
      default: 'Other',
    },
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    fileType: { type: String, default: 'application/pdf' },
    fileSize: { type: Number, default: 0 },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
  }
);

export const EmployeeDocument = mongoose.model<IEmployeeDocument>(
  'EmployeeDocument',
  employeeDocumentSchema
);
