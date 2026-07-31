import { Schema, model, Document, Types } from 'mongoose';

export type SubscriptionStatus = 'pending' | 'active' | 'grace' | 'expired' | 'cancelled';

export interface SubscriptionDocument extends Document {
  tenantId: Types.ObjectId;
  planId: Types.ObjectId;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  paymentRef: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<SubscriptionDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true },
    status: {
      type: String,
      enum: ['pending', 'active', 'grace', 'expired', 'cancelled'],
      default: 'pending',
    },
    currentPeriodEnd: { type: Date, default: null },
    paymentRef: { type: String, default: null },
  },
  { timestamps: true }
);

export const Subscription = model<SubscriptionDocument>('Subscription', subscriptionSchema);
