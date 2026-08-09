import { Schema, model, Document, Types } from 'mongoose';

export type ResellerCustomerStatus = 'active' | 'blocked';

export interface ResellerCustomerDocument extends Document {
  tenantId: Types.ObjectId;
  name: string;
  email: string;
  phone: string | null;
  notes: string;
  status: ResellerCustomerStatus;
  createdAt: Date;
  updatedAt: Date;
}

const resellerCustomerSchema = new Schema<ResellerCustomerDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: null, trim: true },
    notes: { type: String, default: '' },
    status: { type: String, enum: ['active', 'blocked'], default: 'active' },
  },
  { timestamps: true }
);

resellerCustomerSchema.index({ tenantId: 1, email: 1 }, { unique: true });

export const ResellerCustomer = model<ResellerCustomerDocument>(
  'ResellerCustomer',
  resellerCustomerSchema
);
