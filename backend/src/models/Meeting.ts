import mongoose, { Schema, Document } from 'mongoose';

export interface IMeetingParticipant {
  user?: mongoose.Types.ObjectId | null;
  name: string;
  email?: string;
  role: 'HOST' | 'CO_HOST' | 'PARTICIPANT';
  joinedAt: Date;
  leftAt?: Date;
}

export interface IMeetingSettings {
  isLocked: boolean;
  allowScreenShare: boolean;
  allowChat: boolean;
  muteOnEntry: boolean;
}

export interface IMeeting extends Document {
  legacyId?: number;
  meetingCode: string;
  title: string;
  date: Date;
  time: string;
  description: string;
  department: string;
  location: string;
  status: 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';
  createdBy?: mongoose.Types.ObjectId | null;
  host?: mongoose.Types.ObjectId | null;
  participants: IMeetingParticipant[];
  settings: IMeetingSettings;
  startedAt?: Date;
  endedAt?: Date;
}

const meetingParticipantSchema = new Schema<IMeetingParticipant>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    name: { type: String, required: true },
    email: { type: String, default: '' },
    role: { type: String, enum: ['HOST', 'CO_HOST', 'PARTICIPANT'], default: 'PARTICIPANT' },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date },
  },
  { _id: false }
);

const meetingSettingsSchema = new Schema<IMeetingSettings>(
  {
    isLocked: { type: Boolean, default: false },
    allowScreenShare: { type: Boolean, default: true },
    allowChat: { type: Boolean, default: true },
    muteOnEntry: { type: Boolean, default: false },
  },
  { _id: false }
);

const meetingSchema = new Schema<IMeeting>(
  {
    legacyId: { type: Number, unique: true, sparse: true, index: true },
    meetingCode: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    description: { type: String, default: '' },
    department: { type: String, default: 'All Employees' },
    location: { type: String, default: '' },
    status: {
      type: String,
      enum: ['SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED'],
      default: 'SCHEDULED',
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    host: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    participants: { type: [meetingParticipantSchema], default: [] },
    settings: {
      type: meetingSettingsSchema,
      default: () => ({
        isLocked: false,
        allowScreenShare: true,
        allowChat: true,
        muteOnEntry: false,
      }),
    },
    startedAt: { type: Date },
    endedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

meetingSchema.index({ date: 1, time: 1 });
meetingSchema.index({ department: 1, date: 1 });
meetingSchema.index({ meetingCode: 1 });

export const Meeting = mongoose.model<IMeeting>('Meeting', meetingSchema);
