import mongoose, { Schema, Document } from 'mongoose';
import { PaymentMethodType } from './CustomerReceipt.js';

export interface IPaymentAllocation {
  _id?: mongoose.Types.ObjectId;
  bill: mongoose.Types.ObjectId;
  allocatedAmount: number;
}

export interface IVendorPayment extends Document {
  paymentNumber: string; // e.g. "PMT-2026-0001"
  vendor?: mongoose.Types.ObjectId | null;
  vendorName: string;
  vendorReference?: string; // Vendor payment / cheque / settlement reference
  isManualVendor: boolean;
  date: Date;
  paidFromAccount: mongoose.Types.ObjectId; // Bank or Cash GL Account
  paymentMethod: PaymentMethodType;
  referenceNumber?: string;
  totalAmount: number;
  allocations: IPaymentAllocation[];
  unallocatedAmount: number;
  notes?: string;
  attachment?: string;
  journalEntry?: mongoose.Types.ObjectId | null;
  status: 'DRAFT' | 'POSTED' | 'REVERSED';
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const paymentAllocationSchema = new Schema<IPaymentAllocation>(
  {
    bill: { type: Schema.Types.ObjectId, ref: 'Bill', required: true },
    allocatedAmount: { type: Number, required: true, min: 0.01 },
  },
  { _id: true }
);

const vendorPaymentSchema = new Schema<IVendorPayment>(
  {
    paymentNumber: { type: String, required: true, unique: true, trim: true, index: true },
    vendor: { type: Schema.Types.ObjectId, ref: 'Vendor', default: null, index: true },
    vendorName: { type: String, required: true, trim: true, index: true },
    vendorReference: { type: String, default: '', trim: true },
    isManualVendor: { type: Boolean, default: false },
    date: { type: Date, required: true, index: true },
    paidFromAccount: { type: Schema.Types.ObjectId, ref: 'ChartOfAccount', required: true, index: true },
    paymentMethod: {
      type: String,
      required: true,
      enum: ['BANK_TRANSFER', 'UPI', 'CHEQUE', 'CASH', 'CARD', 'OTHER'],
      default: 'BANK_TRANSFER',
    },
    referenceNumber: { type: String, default: '', trim: true },
    totalAmount: { type: Number, required: true, min: 0.01 },
    allocations: [paymentAllocationSchema],
    unallocatedAmount: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: '' },
    attachment: { type: String, default: '' },
    journalEntry: { type: Schema.Types.ObjectId, ref: 'JournalEntry', default: null },
    status: {
      type: String,
      required: true,
      enum: ['DRAFT', 'POSTED', 'REVERSED'],
      default: 'POSTED',
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
  }
);

vendorPaymentSchema.index({ vendor: 1, date: -1 });

export const VendorPayment = mongoose.model<IVendorPayment>('VendorPayment', vendorPaymentSchema);
