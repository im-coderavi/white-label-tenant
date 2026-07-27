import { Schema, model, Document, Types } from 'mongoose';

export type LicenseStatus =
  | 'draft'
  | 'available'
  | 'reserved'
  | 'assigned'
  | 'activated'
  | 'suspended'
  | 'expired'
  | 'revoked';

export interface LicenseDocument extends Document {
  productId: Types.ObjectId;
  tenantId: Types.ObjectId | null;
  orderId: Types.ObjectId | null;
  assignedUserId: Types.ObjectId | null;
  key: string;
  status: LicenseStatus;
  activationLimit: number;
  activationsUsed: number;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const licenseSchema = new Schema<LicenseDocument>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null },
    orderId: { type: Schema.Types.ObjectId, default: null },
    assignedUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    key: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ['draft', 'available', 'reserved', 'assigned', 'activated', 'suspended', 'expired', 'revoked'],
      default: 'available',
    },
    activationLimit: { type: Number, default: 1 },
    activationsUsed: { type: Number, default: 0 },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const License = model<LicenseDocument>('License', licenseSchema);
