import mongoose, { Schema, Document } from 'mongoose';

export interface IVendor extends Document {
  name: string;
  code: string;
  taxId?: string; // GSTIN / PAN / Tax Registration
  email?: string;
  phone?: string;
  contactPerson?: string;
  address?: string;
  bankDetails?: {
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    beneficiaryName?: string;
  };
  paymentTerms: string;
  defaultExpenseAccount?: mongoose.Types.ObjectId | null;
  isActive: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const vendorSchema = new Schema<IVendor>(
  {
    name: { type: String, required: true, trim: true, index: true },
    code: { type: String, required: true, unique: true, trim: true },
    taxId: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    contactPerson: { type: String, default: '' },
    address: { type: String, default: '' },
    bankDetails: {
      bankName: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      ifscCode: { type: String, default: '' },
      beneficiaryName: { type: String, default: '' },
    },
    paymentTerms: { type: String, default: 'Net 30 Days' },
    defaultExpenseAccount: { type: Schema.Types.ObjectId, ref: 'ChartOfAccount', default: null },
    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String, default: '' },
  },
  {
    timestamps: true,
  }
);

export const Vendor = mongoose.model<IVendor>('Vendor', vendorSchema);
