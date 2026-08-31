import mongoose, { Schema, Document } from 'mongoose';

export type ConversationType = 'DIRECT' | 'GROUP' | 'DEPARTMENT' | 'CLIENT';

export interface IConversationParticipant {
  user: mongoose.Types.ObjectId;
  employee?: mongoose.Types.ObjectId;
  role: 'ADMIN' | 'MEMBER';
  joinedAt: Date;
  lastReadAt?: Date;
}

export interface IChatConversation extends Document {
  type: ConversationType;
  name?: string;
  description?: string;
  avatar?: string;
  department?: string;
  client?: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  participants: IConversationParticipant[];
  pinnedMessages: mongoose.Types.ObjectId[];
  lastMessage?: mongoose.Types.ObjectId;
  lastMessageText?: string;
  lastMessageAt?: Date;
  lastMessageSenderName?: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const conversationParticipantSchema = new Schema<IConversationParticipant>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    role: { type: String, enum: ['ADMIN', 'MEMBER'], default: 'MEMBER' },
    joinedAt: { type: Date, default: Date.now },
    lastReadAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const chatConversationSchema = new Schema<IChatConversation>(
  {
    type: {
      type: String,
      enum: ['DIRECT', 'GROUP', 'DEPARTMENT', 'CLIENT'],
      default: 'DIRECT',
      required: true,
    },
    name: { type: String, default: '' },
    description: { type: String, default: '' },
    avatar: { type: String, default: '' },
    department: { type: String, default: '' },
    client: { type: Schema.Types.ObjectId, ref: 'Client', default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    participants: { type: [conversationParticipantSchema], default: [] },
    pinnedMessages: [{ type: Schema.Types.ObjectId, ref: 'ChatMessage' }],
    lastMessage: { type: Schema.Types.ObjectId, ref: 'ChatMessage', default: null },
    lastMessageText: { type: String, default: '' },
    lastMessageAt: { type: Date, default: Date.now },
    lastMessageSenderName: { type: String, default: '' },
    isArchived: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

chatConversationSchema.index({ 'participants.user': 1, updatedAt: -1 });

export const ChatConversation = mongoose.model<IChatConversation>('ChatConversation', chatConversationSchema);
