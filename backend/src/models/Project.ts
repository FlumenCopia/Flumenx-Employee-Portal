import mongoose, { Schema, Document } from 'mongoose';

export type ProjectStatus = 'Planning' | 'Active' | 'On Hold' | 'Completed' | 'Archived';

export interface IProject extends Document {
  legacyId?: number;
  client: mongoose.Types.ObjectId;
  name: string;
  code?: string;
  description?: string;
  status: ProjectStatus;
  startDate?: Date | null;
  targetEndDate?: Date | null;
  actualEndDate?: Date | null;
  budgetHours?: number;
  projectManager?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    legacyId: { type: Number, unique: true, sparse: true, index: true },
    client: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, default: '', trim: true },
    description: { type: String, default: '' },
    status: {
      type: String,
      enum: ['Planning', 'Active', 'On Hold', 'Completed', 'Archived'],
      default: 'Active',
      index: true,
    },
    startDate: { type: Date, default: null },
    targetEndDate: { type: Date, default: null },
    actualEndDate: { type: Date, default: null },
    budgetHours: { type: Number, default: 0, min: 0 },
    projectManager: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
  }
);

projectSchema.index({ client: 1, name: 1 }, { unique: true });

export const Project = mongoose.model<IProject>('Project', projectSchema);
