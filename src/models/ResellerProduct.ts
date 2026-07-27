import { Schema, model, Document, Types } from 'mongoose';

export interface ResellerProductDocument extends Document {
  tenantId: Types.ObjectId;
  productId: Types.ObjectId;
  enabled: boolean;
  customPrice: number | null;
  discountPercent: number | null;
  isFeatured: boolean;
  categoryId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const resellerProductSchema = new Schema<ResellerProductDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    enabled: { type: Boolean, default: false },
    customPrice: { type: Number, default: null },
    discountPercent: { type: Number, default: null },
    isFeatured: { type: Boolean, default: false },
    categoryId: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

resellerProductSchema.index({ tenantId: 1, productId: 1 }, { unique: true });

export const ResellerProduct = model<ResellerProductDocument>('ResellerProduct', resellerProductSchema);
