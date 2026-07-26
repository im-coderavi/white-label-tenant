import { Schema, model, Document } from 'mongoose';

export type TenantPlan = 'starter' | 'premium' | 'enterprise';
export type TenantStatus = 'pending' | 'active' | 'suspended';

export interface TenantDocument extends Document {
  name: string;
  subdomain: string;
  customDomain?: string;
  plan: TenantPlan;
  status: TenantStatus;
  brandingJson: Record<string, unknown>;
  smtpConfigJson: Record<string, unknown>;
  paymentGatewayJson: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const tenantSchema = new Schema<TenantDocument>(
  {
    name: { type: String, required: true },
    subdomain: { type: String, required: true, unique: true, lowercase: true, trim: true },
    customDomain: { type: String, unique: true, sparse: true },
    plan: { type: String, enum: ['starter', 'premium', 'enterprise'], default: 'starter' },
    status: { type: String, enum: ['pending', 'active', 'suspended'], default: 'pending' },
    brandingJson: { type: Schema.Types.Mixed, default: {} },
    smtpConfigJson: { type: Schema.Types.Mixed, default: {} },
    paymentGatewayJson: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const Tenant = model<TenantDocument>('Tenant', tenantSchema);
