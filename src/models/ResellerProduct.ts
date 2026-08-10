import { Schema, model, Document, Types } from 'mongoose';

/**
 * Reseller-owned overrides layered on top of a locked master Product — the reseller cannot touch
 * name/category/type/license system/files (those stay admin-controlled on the Product itself),
 * only how the product is presented and priced on their own storefront.
 */
export interface ResellerProductOverrides {
  displayName?: string;
  shortDescription?: string;
  description?: string;
  thumbnailUrl?: string;
}

export interface ResellerProductDocument extends Document {
  tenantId: Types.ObjectId;
  productId: Types.ObjectId;
  enabled: boolean;
  customPrice: number | null;
  discountPercent: number | null;
  isFeatured: boolean;
  categoryId: Types.ObjectId | null;
  sortOrder: number;
  overrides: ResellerProductOverrides;
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
    sortOrder: { type: Number, default: 0 },
    overrides: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

resellerProductSchema.index({ tenantId: 1, productId: 1 }, { unique: true });

export const ResellerProduct = model<ResellerProductDocument>('ResellerProduct', resellerProductSchema);
