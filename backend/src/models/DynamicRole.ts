import mongoose, { Schema, Document } from 'mongoose';

export interface IRolePermission {
  page: mongoose.Types.ObjectId;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface IDynamicRole extends Document {
  legacyId?: number;
  name: string;
  code: string;
  description: string;
  isSuperadminWildcard: boolean;
  isSystemRole: boolean;
  permissions: IRolePermission[];
}

const rolePermissionSchema = new Schema<IRolePermission>(
  {
    page: { type: Schema.Types.ObjectId, ref: 'PortalPage', required: true },
    canView: { type: Boolean, default: false },
    canCreate: { type: Boolean, default: false },
    canEdit: { type: Boolean, default: false },
    canDelete: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

const dynamicRoleSchema = new Schema<IDynamicRole>(
  {
    legacyId: { type: Number, unique: true, sparse: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: '' },
    isSuperadminWildcard: { type: Boolean, default: false },
    isSystemRole: { type: Boolean, default: false },
    permissions: [rolePermissionSchema],
  },
  {
    timestamps: true,
  }
);

export const DynamicRole = mongoose.model<IDynamicRole>('DynamicRole', dynamicRoleSchema);
