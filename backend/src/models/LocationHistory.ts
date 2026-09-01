import mongoose, { Schema, Document } from 'mongoose';

export interface ILocationHistory extends Document {
  employee: mongoose.Types.ObjectId;
  user?: mongoose.Types.ObjectId | null;
  session: mongoose.Types.ObjectId;
  latitude: number;
  longitude: number;
  accuracy: number; // in meters
  speed: number; // in m/s
  heading: number; // 0 to 360 degrees
  timestamp: Date;
  batteryLevel?: number;
  isMoving?: boolean;
  rawJson?: any;
  createdAt: Date;
  updatedAt: Date;
}

const locationHistorySchema = new Schema<ILocationHistory>(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    session: { type: Schema.Types.ObjectId, ref: 'TrackingSession', required: true, index: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: { type: Number, default: 0 },
    speed: { type: Number, default: 0 },
    heading: { type: Number, default: 0 },
    timestamp: { type: Date, required: true, default: Date.now, index: true },
    batteryLevel: { type: Number, default: null },
    isMoving: { type: Boolean, default: false },
    rawJson: { type: Schema.Types.Mixed, default: null },
  },
  {
    timestamps: true,
  }
);

// High-performance compound indexes for date queries, session routes, and daily route aggregation
locationHistorySchema.index({ employee: 1, timestamp: 1 });
locationHistorySchema.index({ session: 1, timestamp: 1 });
locationHistorySchema.index({ employee: 1, session: 1, timestamp: 1 });

export const LocationHistory = mongoose.model<ILocationHistory>(
  'LocationHistory',
  locationHistorySchema
);
