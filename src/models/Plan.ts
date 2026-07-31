import { Schema, model, Document } from 'mongoose';

export type PlanScope = 'reseller' | 'customer';
export type PlanBillingCycle = 'monthly' | 'annual' | 'lifetime';
export type PlanStatus = 'active' | 'archived';

export interface PlanDocument extends Document {
  scope: PlanScope;
  name: string;
  price: number;
  currency: string;
  billingCycle: PlanBillingCycle;
  featureFlagsJson: Record<string, unknown>;
  limitsJson: Record<string, unknown>;
  status: PlanStatus;
  createdAt: Date;
  updatedAt: Date;
}

const planSchema = new Schema<PlanDocument>(
  {
    scope: { type: String, enum: ['reseller', 'customer'], required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    billingCycle: { type: String, enum: ['monthly', 'annual', 'lifetime'], required: true },
    featureFlagsJson: { type: Schema.Types.Mixed, default: {} },
    limitsJson: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
  },
  { timestamps: true }
);

export const Plan = model<PlanDocument>('Plan', planSchema);
