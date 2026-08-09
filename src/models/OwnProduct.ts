import { Schema, model, Document, Types } from 'mongoose';

export type OwnProductStatus = 'draft' | 'published';

/**
 * A reseller's own product, fully owned and managed by them — distinct from the master
 * Product catalog (which is admin-controlled and locked). No sync modes, no master license
 * pool, no cross-tenant visibility: this exists only on the reseller's own storefront.
 */
export interface OwnProductDocument extends Document {
  tenantId: Types.ObjectId;
  name: string;
  slug: string;
  categoryId: Types.ObjectId | null;
  shortDescription: string;
  description: string;
  price: number;
  currency: string;
  thumbnailUrl: string | null;
  fileUrl: string | null;
  status: OwnProductStatus;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ownProductSchema = new Schema<OwnProductDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    shortDescription: { type: String, default: '' },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    thumbnailUrl: { type: String, default: null },
    fileUrl: { type: String, default: null },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    isFeatured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ownProductSchema.index({ tenantId: 1, slug: 1 }, { unique: true });

export const OwnProduct = model<OwnProductDocument>('OwnProduct', ownProductSchema);
