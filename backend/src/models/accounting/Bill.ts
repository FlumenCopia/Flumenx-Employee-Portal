import mongoose, { Schema, Document } from 'mongoose';

export type BillStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface IBillLine {
  _id?: mongoose.Types.ObjectId;
  description: string;
  account: mongoose.Types.ObjectId; // Expense or Asset GL Account
  quantity: number;
  unitRate: number;
  taxRate?: mongoose.Types.ObjectId | null;
  taxAmount: number;
  totalAmount: number;
  costCenter?: mongoose.Types.ObjectId | null;
  project?: mongoose.Types.ObjectId | null;
}

export interface IBill extends Document {
  billNumber: string; // Internal sequential e.g. "BILL-2026-0001"
  vendorInvoiceNumber?: string; // Vendor's tax invoice number
  vendor?: mongoose.Types.ObjectId | null;
  vendorName: string;
  vendorReference?: string; // e.g. PO number / order reference
  vendorGstin?: string;
  isManualVendor: boolean;
  billDate: Date;
  dueDate: Date;
  currency: string;
  subtotal: number;
  taxTotal: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  status: BillStatus;
  attachment?: string;
  notes?: string;
  journalEntry?: mongoose.Types.ObjectId | null;
  lines: IBillLine[];
  approvedBy?: mongoose.Types.ObjectId | null;
  approvedAt?: Date | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export const billLineSchema = new Schema<IBillLine>(
  {
    description: { type: String, required: true, trim: true },
    account: { type: Schema.Types.ObjectId, ref: 'ChartOfAccount', required: true },
    quantity: { type: Number, required: true, min: 0.01, default: 1 },
    unitRate: { type: Number, required: true, min: 0, default: 0 },
    taxRate: { type: Schema.Types.ObjectId, ref: 'TaxRate', default: null },
    taxAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    costCenter: { type: Schema.Types.ObjectId, ref: 'CostCenter', default: null },
    project: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
  },
  { _id: true }
);

const billSchema = new Schema<IBill>(
  {
    billNumber: { type: String, required: true, unique: true, trim: true, index: true },
    vendorInvoiceNumber: { type: String, default: '', trim: true },
    vendor: { type: Schema.Types.ObjectId, ref: 'Vendor', default: null, index: true },
    vendorName: { type: String, required: true, trim: true, index: true },
    vendorReference: { type: String, default: '', trim: true, index: true },
    vendorGstin: { type: String, default: '', trim: true },
    isManualVendor: { type: Boolean, default: false, index: true },
    billDate: { type: Date, required: true, index: true },
    dueDate: { type: Date, required: true, index: true },
    currency: { type: String, default: 'INR' },
    subtotal: { type: Number, required: true, min: 0, default: 0 },
    taxTotal: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0, default: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    balanceDue: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      required: true,
      enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'],
      default: 'DRAFT',
      index: true,
    },
    attachment: { type: String, default: '' },
    notes: { type: String, default: '' },
    journalEntry: { type: Schema.Types.ObjectId, ref: 'JournalEntry', default: null },
    lines: {
      type: [billLineSchema],
      validate: {
        validator: (v: IBillLine[]) => v && v.length > 0,
        message: 'A bill must have at least one line item.',
      },
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
  }
);

billSchema.index({ vendor: 1, status: 1, dueDate: 1 });
billSchema.index({ status: 1, dueDate: 1 });

export const Bill = mongoose.model<IBill>('Bill', billSchema);
