import mongoose, { Schema, Document } from 'mongoose';

export interface IClientDocument {
  name: string;
  url: string;
  documentType: 'Contract' | 'NDA' | 'Proposal' | 'SLA' | 'Asset' | 'Other';
  uploadedAt: Date;
}

export interface IClientProposal {
  title: string;
  url?: string;
  value?: number;
  status: 'Draft' | 'Sent' | 'Approved' | 'Rejected';
  uploadedAt: Date;
}

export interface IClientBrandAsset {
  name: string;
  url: string;
  assetType: 'Logo' | 'Brand Guide' | 'Font' | 'Drive Link' | 'Other';
  notes?: string;
}

export interface IClientContactPerson {
  name?: string;
  email?: string;
  phone?: string;
  designation?: string;
}

export interface IClient extends Document {
  legacyId?: number;
  name: string;
  industry?: string;
  isActive: boolean;
  notes?: string;
  contactPerson?: IClientContactPerson;
  website?: string;
  address?: string;
  contractStartDate?: Date | null;
  contractEndDate?: Date | null;
  retainerMonthlyFee?: number;
  documents: IClientDocument[];
  proposals: IClientProposal[];
  brandAssets: IClientBrandAsset[];
}

const clientDocumentSchema = new Schema(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
    documentType: {
      type: String,
      enum: ['Contract', 'NDA', 'Proposal', 'SLA', 'Asset', 'Other'],
      default: 'Other',
    },
    uploadedAt: { type: Date, default: () => new Date() },
  },
  { _id: true }
);

const clientProposalSchema = new Schema(
  {
    title: { type: String, required: true },
    url: { type: String, default: '' },
    value: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['Draft', 'Sent', 'Approved', 'Rejected'],
      default: 'Draft',
    },
    uploadedAt: { type: Date, default: () => new Date() },
  },
  { _id: true }
);

const clientBrandAssetSchema = new Schema(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
    assetType: {
      type: String,
      enum: ['Logo', 'Brand Guide', 'Font', 'Drive Link', 'Other'],
      default: 'Logo',
    },
    notes: { type: String, default: '' },
  },
  { _id: true }
);

const clientSchema = new Schema<IClient>(
  {
    legacyId: { type: Number, unique: true, sparse: true },
    name: { type: String, required: true, unique: true, trim: true },
    industry: { type: String, default: 'General' },
    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String, default: '' },
    contactPerson: {
      name: { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      designation: { type: String, default: '' },
    },
    website: { type: String, default: '' },
    address: { type: String, default: '' },
    contractStartDate: { type: Date, default: null },
    contractEndDate: { type: Date, default: null },
    retainerMonthlyFee: { type: Number, default: 0 },
    documents: [clientDocumentSchema],
    proposals: [clientProposalSchema],
    brandAssets: [clientBrandAssetSchema],
  },
  {
    timestamps: true,
  }
);

export const Client = mongoose.model<IClient>('Client', clientSchema);
