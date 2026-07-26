import { Schema, model, Document, Types } from 'mongoose';

export type UserRole = 'master_admin' | 'reseller_admin' | 'reseller_staff' | 'customer';
export type UserStatus = 'pending' | 'active' | 'suspended';

export interface UserDocument extends Document {
  tenantId: Types.ObjectId | null;
  role: UserRole;
  email: string;
  passwordHash: string;
  status: UserStatus;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null },
    role: {
      type: String,
      enum: ['master_admin', 'reseller_admin', 'reseller_staff', 'customer'],
      required: true,
    },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    status: { type: String, enum: ['pending', 'active', 'suspended'], default: 'pending' },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ tenantId: 1, email: 1 }, { unique: true });

export const User = model<UserDocument>('User', userSchema);
