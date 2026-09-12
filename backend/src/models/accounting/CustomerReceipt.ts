import mongoose, { Schema, Document } from 'mongoose';

export type PaymentMethodType = 'BANK_TRANSFER' | 'UPI' | 'CHEQUE' | 'CASH' | 'CARD' | 'OTHER';

export interface IReceiptAllocation {
  _id?: mongoose.Types.ObjectId;
  invoice: mongoose.Types.ObjectId;
  allocatedAmount: number;
}

export interface ICustomerReceipt extends Document {
  receiptNumber: string; // e.g. "RCP-2026-0001"
  client?: mongoose.Types.ObjectId | null;
  clientName: string;
  clientReference?: string; // Client transaction / cheque / settlement reference
  isManualClient: boolean;
  date: Date;
  depositAccount: mongoose.Types.ObjectId; // Bank or Cash GL Account
  paymentMethod: PaymentMethodType;
  referenceNumber?: string;
  totalAmount: number;
  allocations: IReceiptAllocation[];
  unallocatedAmount: number;
  notes?: string;
  attachment?: string;
  journalEntry?: mongoose.Types.ObjectId | null;
  status: 'DRAFT' | 'POSTED' | 'REVERSED';
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const receiptAllocationSchema = new Schema<IReceiptAllocation>(
  {
    invoice: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
    allocatedAmount: { type: Number, required: true, min: 0.01 },
  },
  { _id: true }
);

const customerReceiptSchema = new Schema<ICustomerReceipt>(
  {
    receiptNumber: { type: String, required: true, unique: true, trim: true, index: true },
    client: { type: Schema.Types.ObjectId, ref: 'Client', default: null, index: true },
    clientName: { type: String, required: true, trim: true, index: true },
    clientReference: { type: String, default: '', trim: true },
    isManualClient: { type: Boolean, default: false },
    date: { type: Date, required: true, index: true },
    depositAccount: { type: Schema.Types.ObjectId, ref: 'ChartOfAccount', required: true, index: true },
    paymentMethod: {
      type: String,
      required: true,
      enum: ['BANK_TRANSFER', 'UPI', 'CHEQUE', 'CASH', 'CARD', 'OTHER'],
      default: 'BANK_TRANSFER',
    },
    referenceNumber: { type: String, default: '', trim: true },
    totalAmount: { type: Number, required: true, min: 0.01 },
    allocations: [receiptAllocationSchema],
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

customerReceiptSchema.index({ client: 1, date: -1 });

export const CustomerReceipt = mongoose.model<ICustomerReceipt>('CustomerReceipt', customerReceiptSchema);
