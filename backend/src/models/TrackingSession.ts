import mongoose, { Schema, Document } from 'mongoose';

export type TrackingSessionStatus = 'ACTIVE' | 'COMPLETED' | 'INTERRUPTED';

export interface ITrackingLocationPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  timestamp?: Date;
}

export interface ITrackingSession extends Document {
  employee: mongoose.Types.ObjectId;
  user?: mongoose.Types.ObjectId | null;
  startedAt: Date;
  endedAt?: Date | null;
  startLocation?: ITrackingLocationPoint | null;
  endLocation?: ITrackingLocationPoint | null;
  totalDistance: number; // in kilometers
  totalDuration: number; // in seconds
  status: TrackingSessionStatus;
  interruptedReason?: string;
  deviceInfo?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const locationPointSchema = new Schema(
  {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: { type: Number, default: 0 },
    address: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const trackingSessionSchema = new Schema<ITrackingSession>(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    startedAt: { type: Date, required: true, default: Date.now, index: true },
    endedAt: { type: Date, default: null },
    startLocation: { type: locationPointSchema, default: null },
    endLocation: { type: locationPointSchema, default: null },
    totalDistance: { type: Number, default: 0 }, // in kilometers
    totalDuration: { type: Number, default: 0 }, // in seconds
    status: {
      type: String,
      enum: ['ACTIVE', 'COMPLETED', 'INTERRUPTED'],
      default: 'ACTIVE',
      index: true,
    },
    interruptedReason: { type: String, default: '' },
    deviceInfo: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  {
    timestamps: true,
  }
);

// High-efficiency compound indexes for date range and status queries
trackingSessionSchema.index({ employee: 1, startedAt: -1 });
trackingSessionSchema.index({ employee: 1, status: 1 });
trackingSessionSchema.index({ status: 1, startedAt: -1 });

export const TrackingSession = mongoose.model<ITrackingSession>(
  'TrackingSession',
  trackingSessionSchema
);
