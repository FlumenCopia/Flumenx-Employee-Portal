import mongoose, { Schema, Document } from 'mongoose';

export type ChatMessageType =
  | 'TEXT'
  | 'IMAGE'
  | 'VIDEO'
  | 'FILE'
  | 'TASK_EMBED'
  | 'CLIENT_EMBED'
  | 'STANDUP_UPDATE'
  | 'MEETING_LINK'
  | 'CALL_LOG'
  | 'SYSTEM';

export interface IMessageAttachment {
  name: string;
  url: string;
  fileType: string;
  fileSize?: number;
}

export interface IMessageTaskEmbed {
  id: string | mongoose.Types.ObjectId;
  title: string;
  status: string;
  priority: string;
  completedQuantity?: number;
  assignedQuantity?: number;
  unit?: string;
  employeeName?: string;
  clientName?: string;
}

export interface IMessageClientEmbed {
  id: string | mongoose.Types.ObjectId;
  name: string;
  industry?: string;
  contactPerson?: string;
}

export interface IMessageStandupData {
  date: string;
  completedTasks: string[];
  inProgressTasks: string[];
  blockers: string[];
  note?: string;
}

export interface IMessageReaction {
  emoji: string;
  user: mongoose.Types.ObjectId;
  userName?: string;
}

export interface IChatMessage extends Document {
  conversation: mongoose.Types.ObjectId;
  sender?: mongoose.Types.ObjectId;
  senderName: string;
  senderRole?: string;
  senderAvatar?: string;
  messageType: ChatMessageType;
  text: string;
  attachments?: IMessageAttachment[];
  taskEmbed?: IMessageTaskEmbed;
  clientEmbed?: IMessageClientEmbed;
  standupData?: IMessageStandupData;
  meetingCode?: string;
  callDurationSeconds?: number;
  isPinned: boolean;
  pinnedBy?: mongoose.Types.ObjectId;
  pinnedAt?: Date;
  readBy: { user: mongoose.Types.ObjectId; readAt: Date }[];
  reactions: IMessageReaction[];
  replyTo?: mongoose.Types.ObjectId;
  replyToSnapshot?: { id: string; senderName: string; text: string };
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const attachmentSchema = new Schema<IMessageAttachment>(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
    fileType: { type: String, default: 'file' },
    fileSize: { type: Number, default: 0 },
  },
  { _id: false }
);

const reactionSchema = new Schema<IMessageReaction>(
  {
    emoji: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, default: '' },
  },
  { _id: false }
);

const chatMessageSchema = new Schema<IChatMessage>(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'ChatConversation', required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    senderName: { type: String, required: true },
    senderRole: { type: String, default: 'EMPLOYEE' },
    senderAvatar: { type: String, default: '' },
    messageType: {
      type: String,
      enum: [
        'TEXT',
        'IMAGE',
        'VIDEO',
        'FILE',
        'TASK_EMBED',
        'CLIENT_EMBED',
        'STANDUP_UPDATE',
        'MEETING_LINK',
        'CALL_LOG',
        'SYSTEM',
      ],
      default: 'TEXT',
      required: true,
    },
    text: { type: String, default: '' },
    attachments: { type: [attachmentSchema], default: [] },
    taskEmbed: {
      id: { type: Schema.Types.Mixed },
      title: { type: String },
      status: { type: String },
      priority: { type: String },
      completedQuantity: { type: Number },
      assignedQuantity: { type: Number },
      unit: { type: String },
      employeeName: { type: String },
      clientName: { type: String },
    },
    clientEmbed: {
      id: { type: Schema.Types.Mixed },
      name: { type: String },
      industry: { type: String },
      contactPerson: { type: String },
    },
    standupData: {
      date: { type: String },
      completedTasks: [{ type: String }],
      inProgressTasks: [{ type: String }],
      blockers: [{ type: String }],
      note: { type: String },
    },
    meetingCode: { type: String, default: '' },
    callDurationSeconds: { type: Number, default: 0 },
    isPinned: { type: Boolean, default: false },
    pinnedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    pinnedAt: { type: Date, default: null },
    readBy: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        readAt: { type: Date, default: Date.now },
      },
    ],
    reactions: { type: [reactionSchema], default: [] },
    replyTo: { type: Schema.Types.ObjectId, ref: 'ChatMessage', default: null },
    replyToSnapshot: {
      id: { type: String },
      senderName: { type: String },
      text: { type: String },
    },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

chatMessageSchema.index({ conversation: 1, createdAt: 1 });

export const ChatMessage = mongoose.model<IChatMessage>('ChatMessage', chatMessageSchema);
