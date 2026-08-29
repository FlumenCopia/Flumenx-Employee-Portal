import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export type UserRoleType =
  | 'SUPER_ADMIN'
  | 'HR'
  | 'ADMIN'
  | 'ACCOUNTANT'
  | 'BDE'
  | 'TEAM_LEAD'
  | 'EMPLOYEE'
  | 'OPERATIONS'
  | 'OPERATIONS_HEAD';

export interface IUser extends Document {
  legacyId?: number;
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  isActive: boolean;
  isStaff: boolean;
  isSuperuser: boolean;
  role: UserRoleType;
  dynamicRole?: mongoose.Types.ObjectId | null;
  avatar?: string;
  dateJoined: Date;
  resetPasswordTokenHash?: string;
  resetPasswordExpires?: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  setPassword(password: string): Promise<void>;
}

const userSchema = new Schema<IUser>(
  {
    legacyId: { type: Number, unique: true, sparse: true, index: true },
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    avatar: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    isStaff: { type: Boolean, default: false },
    isSuperuser: { type: Boolean, default: false },
    role: {
      type: String,
      enum: [
        'SUPER_ADMIN',
        'HR',
        'ADMIN',
        'ACCOUNTANT',
        'BDE',
        'TEAM_LEAD',
        'EMPLOYEE',
        'OPERATIONS',
        'OPERATIONS_HEAD',
      ],
      default: 'EMPLOYEE',
    },
    dynamicRole: { type: Schema.Types.ObjectId, ref: 'DynamicRole', default: null },
    dateJoined: { type: Date, default: Date.now },
    resetPasswordTokenHash: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

userSchema.pre<IUser>('save', async function (next) {
  if (!this.isModified('password')) return next();
  if (
    this.password.startsWith('pbkdf2_sha256$') ||
    this.password.startsWith('$pbkdf2') ||
    this.password.startsWith('$2a$') ||
    this.password.startsWith('$2b$')
  ) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.setPassword = async function (newPassword: string): Promise<void> {
  this.password = newPassword;
};

userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  if (this.password.startsWith('$2a$') || this.password.startsWith('$2b$')) {
    return await bcrypt.compare(candidatePassword, this.password);
  }
  if (this.password.startsWith('pbkdf2_sha256$')) {
    const parts = this.password.split('$');
    if (parts.length === 4) {
      const iterations = parseInt(parts[1], 10);
      const salt = parts[2];
      const hash = parts[3];
      const derivedKey = crypto.pbkdf2Sync(candidatePassword, salt, iterations, 32, 'sha256');
      return derivedKey.toString('base64') === hash;
    }
  }
  return candidatePassword === this.password;
};

export const User = mongoose.model<IUser>('User', userSchema);
