import mongoose, { Schema, Document } from 'mongoose';

export type TimerStatus = 'RUNNING' | 'PAUSED' | 'STOPPED';

export interface IPauseInterval {
  pausedAt: Date;
  resumedAt?: Date | null;
  durationSeconds?: number;
}

export interface ITimeEntry extends Document {
  legacyId?: number;
  employee: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  client?: mongoose.Types.ObjectId | null;
  project?: mongoose.Types.ObjectId | null;
  task: mongoose.Types.ObjectId;
  startTime: Date;
  endTime?: Date | null;
  durationSeconds: number;
  status: TimerStatus;
  pauseIntervals: IPauseInterval[];
  description?: string;
  isBillable: boolean;
  isManualEntry: boolean;
  entryDate: string; // YYYY-MM-DD format for fast querying
  approvedBy?: mongoose.Types.ObjectId | null;
  approvedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const pauseIntervalSchema = new Schema<IPauseInterval>(
  {
    pausedAt: { type: Date, required: true },
    resumedAt: { type: Date, default: null },
    durationSeconds: { type: Number, default: 0 },
  },
  { _id: false }
);

const timeEntrySchema = new Schema<ITimeEntry>(
  {
    legacyId: { type: Number, unique: true, sparse: true, index: true },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    client: { type: Schema.Types.ObjectId, ref: 'Client', default: null, index: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    task: { type: Schema.Types.ObjectId, ref: 'WorkAssignment', required: true, index: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, default: null },
    durationSeconds: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['RUNNING', 'PAUSED', 'STOPPED'],
      default: 'RUNNING',
      index: true,
    },
    pauseIntervals: [pauseIntervalSchema],
    description: { type: String, default: '' },
    isBillable: { type: Boolean, default: true },
    isManualEntry: { type: Boolean, default: false },
    entryDate: { type: String, required: true, index: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

timeEntrySchema.index({ employee: 1, status: 1 });
timeEntrySchema.index({ task: 1, createdAt: -1 });

export const TimeEntry = mongoose.model<ITimeEntry>('TimeEntry', timeEntrySchema);
