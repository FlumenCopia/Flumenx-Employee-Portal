import mongoose, { Schema, Document } from 'mongoose';

export type AttendanceStatus =
  | 'Present'
  | 'Present (Late)'
  | 'Present (Early Exit)'
  | 'Present (Late + Early Exit)'
  | 'Absent'
  | 'Half Day'
  | 'Leave';

export type CheckInStatus = 'On Time' | 'Grace Period' | 'Late' | '';
export type AttendanceSource = 'Manual' | 'QR' | 'QR + Location' | 'Admin';

export interface IAttendanceRecord extends Document {
  legacyId?: number;
  employee?: mongoose.Types.ObjectId | null;
  attendanceDate: Date;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  checkInStatus?: CheckInStatus;
  attendanceStatus: AttendanceStatus;
  isLate: boolean;
  lateMinutes: number;
  isEarlyExit: boolean;
  earlyExitMinutes: number;
  workingHours: number;
  source: AttendanceSource;
  qrReference?: string;
  latitude?: number | null;
  longitude?: number | null;
  checkInDistanceMeters?: number | null;
  checkOutLatitude?: number | null;
  checkOutLongitude?: number | null;
  checkOutDistanceMeters?: number | null;
  photo?: string;
  locationVerified: boolean;
  notes?: string;
}

const attendanceRecordSchema = new Schema<IAttendanceRecord>(
  {
    legacyId: { type: Number, unique: true, sparse: true, index: true },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    attendanceDate: { type: Date, required: true },
    checkInTime: { type: String, default: null },
    checkOutTime: { type: String, default: null },
    checkInStatus: { type: String, default: '' },
    attendanceStatus: {
      type: String,
      enum: [
        'Present',
        'Present (Late)',
        'Present (Early Exit)',
        'Present (Late + Early Exit)',
        'Absent',
        'Half Day',
        'Leave',
      ],
      default: 'Absent',
    },
    isLate: { type: Boolean, default: false },
    lateMinutes: { type: Number, default: 0 },
    isEarlyExit: { type: Boolean, default: false },
    earlyExitMinutes: { type: Number, default: 0 },
    workingHours: { type: Number, default: 0 },
    source: { type: String, enum: ['Manual', 'QR', 'QR + Location', 'Admin'], default: 'Manual' },
    qrReference: { type: String, default: '' },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    checkInDistanceMeters: { type: Number, default: null },
    checkOutLatitude: { type: Number, default: null },
    checkOutLongitude: { type: Number, default: null },
    checkOutDistanceMeters: { type: Number, default: null },
    photo: { type: String, default: '' },
    locationVerified: { type: Boolean, default: false },
    notes: { type: String, default: '' },
  },
  {
    timestamps: true,
  }
);

attendanceRecordSchema.index({ attendanceDate: 1 });
attendanceRecordSchema.index({ attendanceStatus: 1 });
attendanceRecordSchema.index({ employee: 1, attendanceDate: 1 }, { unique: true });

export const AttendanceRecord = mongoose.model<IAttendanceRecord>('AttendanceRecord', attendanceRecordSchema);
