import { Schema, model, Document, Types } from 'mongoose';

export type AccessCodeStatus = 'unused' | 'active' | 'revoked';

export interface AccessCodeDocument extends Document {
  tenantId: Types.ObjectId;
  customerId: Types.ObjectId;
  productId: Types.ObjectId;
  licenseId: Types.ObjectId | null;
  code: string;
  status: AccessCodeStatus;
  expiresAt: Date | null;
  redeemedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const accessCodeSchema = new Schema<AccessCodeDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'ResellerCustomer', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    licenseId: { type: Schema.Types.ObjectId, ref: 'License', default: null },
    code: { type: String, required: true, unique: true },
    status: { type: String, enum: ['unused', 'active', 'revoked'], default: 'unused' },
    expiresAt: { type: Date, default: null },
    redeemedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

accessCodeSchema.index({ tenantId: 1, customerId: 1 });
accessCodeSchema.index({ tenantId: 1, productId: 1 });

export const AccessCode = model<AccessCodeDocument>('AccessCode', accessCodeSchema);
