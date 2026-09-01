import mongoose, { Schema, Document } from 'mongoose';
import './Project.js';
import './Client.js';
import './Employee.js';
import './User.js';

export const WORK_STATUSES = [
  'Backlog',
  'Assigned',
  'Pending',
  'In Progress',
  'Ongoing',
  'Blocked',
  'In Review',
  'Changes Requested',
  'Rejected',
  'Approved',
  'Completed',
  'Published',
] as const;

export type WorkStatusType = (typeof WORK_STATUSES)[number];

export const WORK_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'] as const;
export type WorkPriorityType = (typeof WORK_PRIORITIES)[number];

export const REVIEW_STATUSES = ['PENDING_REVIEW', 'OK', 'CORRECTION_NEEDED'] as const;
export type ReviewStatusType = (typeof REVIEW_STATUSES)[number];

export interface IWorkDeliverable {
  _id?: mongoose.Types.ObjectId;
  legacyId?: number;
  client?: mongoose.Types.ObjectId | null;
  title: string;
  brief?: string;
  workType: string;
  dueDate: Date;
  status: WorkStatusType;
  completedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ITimeLog {
  _id?: mongoose.Types.ObjectId;
  startTime: Date;
  endTime?: Date | null;
  durationSeconds: number;
  loggedBy?: mongoose.Types.ObjectId | null;
}

export interface IDepartmentData {
  // Video Editing
  videoCount?: number;
  videoDurationSeconds?: number;
  editingType?: string;
  revisionCount?: number;
  // Digital Marketing
  platforms?: string[];
  campaignName?: string;
  postCount?: number;
  targetDate?: Date | null;
  // Development
  repositoryUrl?: string;
  environment?: 'Development' | 'Staging' | 'Production';
  featureBugType?: 'Feature' | 'Bug' | 'Improvement' | 'Refactor';
  techStack?: string[];
  // Design
  designType?: string;
  creativesCount?: number;
  dimensions?: string;
  // General
  customNotes?: string;
}

export interface ITimeAdjustment {
  _id?: mongoose.Types.ObjectId;
  adjustedAt: Date;
  adjustedBy?: mongoose.Types.ObjectId | null;
  adjustedByName?: string;
  previousSeconds: number;
  newSeconds: number;
  reason: string;
}

export interface ITaskAttachment {
  _id?: mongoose.Types.ObjectId;
  name: string;
  url: string;
  fileType?: string;
  fileSize?: number;
  uploadedAt: Date;
  uploadedBy?: mongoose.Types.ObjectId | null;
  uploadedByName?: string;
}

export interface IWorkAssignment extends Document {
  legacyId?: number;
  employee?: mongoose.Types.ObjectId | null;
  client?: mongoose.Types.ObjectId | null;
  project?: mongoose.Types.ObjectId | null;
  parentTask?: mongoose.Types.ObjectId | IWorkAssignment | null;
  isMasterClientTask?: boolean;
  departmentCategory?: 'Development' | 'Digital Marketing' | 'Video Editing' | 'Design' | 'HR' | 'General';
  title: string;
  description?: string;
  priority: WorkPriorityType;
  assignedDate: Date;
  dueDate: Date;
  status: WorkStatusType;
  progress: number;
  assignedQuantity: number;
  completedQuantity: number;
  unit: string;
  estimatedHours: number;
  actualHours: number;
  overrunHours: number;
  isOverrun: boolean;
  departmentData?: IDepartmentData;
  completedAt?: Date | null;
  assignedBy?: mongoose.Types.ObjectId | null;
  reviewer?: mongoose.Types.ObjectId | null;
  reviewerName?: string;
  reviewStatus: ReviewStatusType;
  reviewNote?: string;
  reviewedBy?: mongoose.Types.ObjectId | null;
  reviewedAt?: Date | null;
  deliverables: IWorkDeliverable[];
  attachments: ITaskAttachment[];
  totalTimeSpentSeconds: number;
  activeTimer?: {
    startedAt: Date;
    startedBy?: mongoose.Types.ObjectId | null;
  } | null;
  timeLogs: ITimeLog[];
  timeAdjustments?: ITimeAdjustment[];
}

const taskAttachmentSchema = new Schema<ITaskAttachment>(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
    fileType: { type: String, default: '' },
    fileSize: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: () => new Date() },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    uploadedByName: { type: String, default: '' },
  },
  { _id: true }
);

const workDeliverableSchema = new Schema(
  {
    legacyId: { type: Number, sparse: true },
    client: { type: Schema.Types.ObjectId, ref: 'Client', default: null },
    title: { type: String, default: '', trim: true },
    name: { type: String, default: '', trim: true },
    brief: { type: String, default: '' },
    type: { type: String, default: '' },
    workType: { type: String, default: 'General', trim: true },
    contracted: { type: Number, default: 1 },
    delivered: { type: Number, default: 0 },
    dueDate: { type: Date, default: () => new Date(Date.now() + 7 * 86400000) },
    status: { type: String, default: 'Assigned' },
    completedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    strict: false,
  }
);

const timeLogSchema = new Schema<ITimeLog>(
  {
    startTime: { type: Date, required: true },
    endTime: { type: Date, default: null },
    durationSeconds: { type: Number, default: 0 },
    loggedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
  }
);

const timeAdjustmentSchema = new Schema<ITimeAdjustment>(
  {
    adjustedAt: { type: Date, default: () => new Date() },
    adjustedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    adjustedByName: { type: String, default: '' },
    previousSeconds: { type: Number, required: true },
    newSeconds: { type: Number, required: true },
    reason: { type: String, required: true, trim: true },
  },
  { _id: true }
);

const workAssignmentSchema = new Schema<IWorkAssignment>(
  {
    legacyId: { type: Number, unique: true, sparse: true, index: true },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    client: { type: Schema.Types.ObjectId, ref: 'Client', default: null, index: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    parentTask: { type: Schema.Types.ObjectId, ref: 'WorkAssignment', default: null },
    isMasterClientTask: { type: Boolean, default: false },
    departmentCategory: {
      type: String,
      enum: ['Development', 'Digital Marketing', 'Video Editing', 'Design', 'HR', 'General'],
      default: 'General',
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    priority: { type: String, enum: WORK_PRIORITIES, default: 'Normal' },
    assignedDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: WORK_STATUSES, default: 'Assigned' },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    assignedQuantity: { type: Number, default: 100, min: 1 },
    completedQuantity: { type: Number, default: 0, min: 0 },
    unit: { type: String, default: '%' },
    estimatedHours: { type: Number, default: 0, min: 0 },
    actualHours: { type: Number, default: 0, min: 0 },
    overrunHours: { type: Number, default: 0, min: 0 },
    isOverrun: { type: Boolean, default: false },
    departmentData: { type: Schema.Types.Mixed, default: {} },
    completedAt: { type: Date, default: null },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewer: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewerName: { type: String, default: '' },
    reviewStatus: { type: String, enum: REVIEW_STATUSES, default: 'PENDING_REVIEW' },
    reviewNote: { type: String, default: '' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    deliverables: [workDeliverableSchema],
    attachments: [taskAttachmentSchema],
    totalTimeSpentSeconds: { type: Number, default: 0 },
    activeTimer: {
      type: {
        startedAt: { type: Date, required: true },
        startedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      },
      default: null,
    },
    timeLogs: [timeLogSchema],
    timeAdjustments: [timeAdjustmentSchema],
  },
  {
    timestamps: true,
  }
);

workAssignmentSchema.index({ dueDate: 1, status: 1 });
workAssignmentSchema.index({ status: 1, priority: 1 });
workAssignmentSchema.index({ employee: 1, status: 1, dueDate: 1 });
workAssignmentSchema.index({ client: 1, status: 1 });

export const WorkAssignment = mongoose.model<IWorkAssignment>('WorkAssignment', workAssignmentSchema);
