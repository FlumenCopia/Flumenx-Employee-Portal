import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  legacyId?: number;
  actor?: mongoose.Types.ObjectId | null;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    legacyId: { type: Number, unique: true, sparse: true, index: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String, default: '' },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
