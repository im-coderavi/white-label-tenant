import { Schema, model, Document, Types } from 'mongoose';

export type OrderType = 'single_product' | 'subscription';
export type OrderStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partial_refund';

export interface OrderDocument extends Document {
  tenantId: Types.ObjectId;
  customerUserId: Types.ObjectId;
  productId: Types.ObjectId;
  orderType: OrderType;
  amount: number;
  currency: string;
  status: OrderStatus;
  paymentGateway: string;
  paymentRef: string | null;
  licenseId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<OrderDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    customerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    orderType: { type: String, enum: ['single_product', 'subscription'], required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded', 'partial_refund'],
      default: 'pending',
    },
    paymentGateway: { type: String, default: 'mock' },
    paymentRef: { type: String, default: null },
    licenseId: { type: Schema.Types.ObjectId, ref: 'License', default: null },
  },
  { timestamps: true }
);

export const Order = model<OrderDocument>('Order', orderSchema);
