import mongoose, { Schema, Document } from 'mongoose';

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface IInvoiceLine {
  _id?: mongoose.Types.ObjectId;
  description: string;
  account: mongoose.Types.ObjectId; // Revenue GL Account
  quantity: number;
  unitRate: number;
  discount: number;
  taxRate?: mongoose.Types.ObjectId | null;
  taxAmount: number;
  totalAmount: number;
}

export interface IInvoice extends Document {
  invoiceNumber: string; // e.g. "INV-2026-0001"
  client?: mongoose.Types.ObjectId | null;
  clientName: string;
  clientReference?: string; // e.g. Client PO Number / Reference
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  clientGstin?: string;
  isManualClient: boolean;
  project?: mongoose.Types.ObjectId | null;
  invoiceDate: Date;
  dueDate: Date;
  currency: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  status: InvoiceStatus;
  paymentTerms?: string;
  notes?: string;
  attachments?: string[];
  journalEntry?: mongoose.Types.ObjectId | null;
  lines: IInvoiceLine[];
  sentAt?: Date | null;
  paidAt?: Date | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export const invoiceLineSchema = new Schema<IInvoiceLine>(
  {
    description: { type: String, required: true, trim: true },
    account: { type: Schema.Types.ObjectId, ref: 'ChartOfAccount', required: true },
    quantity: { type: Number, required: true, min: 0.01, default: 1 },
    unitRate: { type: Number, required: true, min: 0, default: 0 },
    discount: { type: Number, default: 0, min: 0 },
    taxRate: { type: Schema.Types.ObjectId, ref: 'TaxRate', default: null },
    taxAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
  },
  { _id: true }
);

const invoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: { type: String, required: true, unique: true, trim: true, index: true },
    client: { type: Schema.Types.ObjectId, ref: 'Client', default: null, index: true },
    clientName: { type: String, required: true, trim: true, index: true },
    clientReference: { type: String, default: '', trim: true, index: true },
    clientEmail: { type: String, default: '', trim: true },
    clientPhone: { type: String, default: '', trim: true },
    clientAddress: { type: String, default: '', trim: true },
    clientGstin: { type: String, default: '', trim: true },
    isManualClient: { type: Boolean, default: false, index: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    invoiceDate: { type: Date, required: true, index: true },
    dueDate: { type: Date, required: true, index: true },
    currency: { type: String, default: 'INR' },
    subtotal: { type: Number, required: true, min: 0, default: 0 },
    discountTotal: { type: Number, default: 0, min: 0 },
    taxTotal: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0, default: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    balanceDue: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      required: true,
      enum: ['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'],
      default: 'DRAFT',
      index: true,
    },
    paymentTerms: { type: String, default: 'Net 15 Days' },
    notes: { type: String, default: '' },
    attachments: [{ type: String }],
    journalEntry: { type: Schema.Types.ObjectId, ref: 'JournalEntry', default: null },
    lines: {
      type: [invoiceLineSchema],
      validate: {
        validator: (v: IInvoiceLine[]) => v && v.length > 0,
        message: 'An invoice must have at least one line item.',
      },
    },
    sentAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
  }
);

invoiceSchema.index({ client: 1, status: 1, dueDate: 1 });
invoiceSchema.index({ status: 1, dueDate: 1 });

export const Invoice = mongoose.model<IInvoice>('Invoice', invoiceSchema);
