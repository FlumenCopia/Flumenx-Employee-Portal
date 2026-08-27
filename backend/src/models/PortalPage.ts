import mongoose, { Schema, Document } from 'mongoose';

export interface IPortalPage extends Document {
  legacyId?: number;
  title: string;
  routePath: string;
  moduleCode: string;
  icon: string;
  sidebarOrder: number;
  isActive: boolean;
}

const portalPageSchema = new Schema<IPortalPage>(
  {
    legacyId: { type: Number, unique: true, sparse: true, index: true },
    title: { type: String, required: true, trim: true },
    routePath: { type: String, required: true, unique: true, trim: true },
    moduleCode: { type: String, required: true, unique: true, trim: true },
    icon: { type: String, default: 'LayoutDashboard' },
    sidebarOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

portalPageSchema.index({ sidebarOrder: 1, title: 1 });

export const PortalPage = mongoose.model<IPortalPage>('PortalPage', portalPageSchema);
