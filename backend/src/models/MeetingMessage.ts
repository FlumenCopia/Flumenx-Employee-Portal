import mongoose, { Schema, Document } from 'mongoose';

export interface IMeetingMessage extends Document {
  meeting: mongoose.Types.ObjectId;
  meetingCode: string;
  sender?: mongoose.Types.ObjectId | null;
  senderName: string;
  senderRole?: string;
  senderAvatar?: string;
  text: string;
  timestamp: Date;
}

const meetingMessageSchema = new Schema<IMeetingMessage>(
  {
    meeting: { type: Schema.Types.ObjectId, ref: 'Meeting', required: true, index: true },
    meetingCode: { type: String, required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    senderName: { type: String, required: true },
    senderRole: { type: String, default: 'Participant' },
    senderAvatar: { type: String, default: '' },
    text: { type: String, required: true, trim: true },
    timestamp: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

meetingMessageSchema.index({ meetingCode: 1, timestamp: 1 });

export const MeetingMessage = mongoose.model<IMeetingMessage>('MeetingMessage', meetingMessageSchema);
