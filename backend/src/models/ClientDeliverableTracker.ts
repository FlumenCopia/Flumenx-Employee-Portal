import mongoose, { Schema, Document } from 'mongoose';

export interface IDeliveredItem {
  id: string;
  deliverableType: 'poster' | 'video' | 'reel' | 'carousel' | 'story' | 'extra' | 'other';
  title: string;
  postUrl?: string;
  publishedDate?: Date;
  notes?: string;
  loggedBy?: mongoose.Types.ObjectId;
  sourceTaskId?: mongoose.Types.ObjectId;
  sourceTaskTitle?: string;
  autoSynced?: boolean;
  createdAt: Date;
}

export interface IDeliverableTypeCount {
  target: number;
  delivered: number;
  pending: number;
}

export interface IClientDeliverableTracker extends Document {
  client?: mongoose.Types.ObjectId;
  clientName: string;
  year: number;
  month: string; // e.g. "October", "September"
  cycleLabel?: string; // e.g. "SEPT-26 TO OCT 25"
  
  posters: IDeliverableTypeCount;
  videos: IDeliverableTypeCount;
  customDeliverables: Map<string, IDeliverableTypeCount>;
  
  yearlyTargetPosters: number;
  yearlyTargetVideos: number;
  
  extraWorksNotes?: string;
  deliveredItems: IDeliveredItem[];
  
  status: 'ACTIVE' | 'COMPLETED' | 'ON_HOLD';
  notes?: string;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const deliveredItemSchema = new Schema<IDeliveredItem>(
  {
    id: { type: String, required: true },
    deliverableType: {
      type: String,
      enum: ['poster', 'video', 'reel', 'carousel', 'story', 'extra', 'other'],
      default: 'poster',
    },
    title: { type: String, required: true, trim: true },
    postUrl: { type: String, default: '', trim: true },
    publishedDate: { type: Date, default: () => new Date() },
    notes: { type: String, default: '' },
    loggedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    sourceTaskId: { type: Schema.Types.ObjectId, ref: 'WorkAssignment', sparse: true },
    sourceTaskTitle: { type: String, default: '' },
    autoSynced: { type: Boolean, default: false },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const deliverableTypeCountSchema = new Schema<IDeliverableTypeCount>(
  {
    target: { type: Number, default: 0, min: 0 },
    delivered: { type: Number, default: 0, min: 0 },
    pending: { type: Number, default: 0 },
  },
  { _id: false }
);

const clientDeliverableTrackerSchema = new Schema<IClientDeliverableTracker>(
  {
    client: { type: Schema.Types.ObjectId, ref: 'Client', sparse: true },
    clientName: { type: String, required: true, trim: true, index: true },
    year: { type: Number, required: true, default: 2026, index: true },
    month: { type: String, required: true, trim: true, index: true },
    cycleLabel: { type: String, default: '', trim: true },

    posters: {
      type: deliverableTypeCountSchema,
      default: () => ({ target: 0, delivered: 0, pending: 0 }),
    },
    videos: {
      type: deliverableTypeCountSchema,
      default: () => ({ target: 0, delivered: 0, pending: 0 }),
    },
    customDeliverables: {
      type: Map,
      of: deliverableTypeCountSchema,
      default: () => new Map(),
    },

    yearlyTargetPosters: { type: Number, default: 0 },
    yearlyTargetVideos: { type: Number, default: 0 },

    extraWorksNotes: { type: String, default: '', trim: true },
    deliveredItems: [deliveredItemSchema],

    status: {
      type: String,
      enum: ['ACTIVE', 'COMPLETED', 'ON_HOLD'],
      default: 'ACTIVE',
      index: true,
    },
    notes: { type: String, default: '' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
  }
);

// Compound index to guarantee client uniqueness per month & year
clientDeliverableTrackerSchema.index({ clientName: 1, month: 1, year: 1 }, { unique: true });

// Pre-save hook to calculate pending counts automatically
clientDeliverableTrackerSchema.pre('save', function (next) {
  if (this.posters) {
    this.posters.pending = Math.max(0, (this.posters.target || 0) - (this.posters.delivered || 0));
  }
  if (this.videos) {
    this.videos.pending = Math.max(0, (this.videos.target || 0) - (this.videos.delivered || 0));
  }
  if (this.customDeliverables) {
    for (const [key, val] of this.customDeliverables.entries()) {
      if (val) {
        val.pending = Math.max(0, (val.target || 0) - (val.delivered || 0));
      }
    }
  }
  next();
});

export const ClientDeliverableTracker = mongoose.model<IClientDeliverableTracker>(
  'ClientDeliverableTracker',
  clientDeliverableTrackerSchema
);
