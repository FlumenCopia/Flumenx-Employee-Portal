import mongoose, { Schema, Document } from 'mongoose';

export interface IClientWorkShareLink extends Document {
  legacyId?: number;
  token: string;
  client: mongoose.Types.ObjectId;
  assignment?: mongoose.Types.ObjectId | null;
  publicUpdate: string;
  createdBy?: mongoose.Types.ObjectId | null;
  expiresAt?: Date | null;
  isRevoked: boolean;
  isValid(): boolean;
}

const clientWorkShareLinkSchema = new Schema<IClientWorkShareLink>(
  {
    legacyId: { type: Number, unique: true, sparse: true, index: true },
    token: { type: String, required: true, unique: true, index: true },
    client: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    assignment: { type: Schema.Types.ObjectId, ref: 'WorkAssignment', default: null },
    publicUpdate: { type: String, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    expiresAt: { type: Date, default: null },
    isRevoked: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

clientWorkShareLinkSchema.index({ token: 1, isRevoked: 1 });
clientWorkShareLinkSchema.index({ client: 1, isRevoked: 1 });

clientWorkShareLinkSchema.methods.isValid = function (): boolean {
  if (this.isRevoked) return false;
  if (this.expiresAt && this.expiresAt.getTime() < Date.now()) return false;
  return true;
};

export const ClientWorkShareLink = mongoose.model<IClientWorkShareLink>('ClientWorkShareLink', clientWorkShareLinkSchema);
