import { Schema, model, Document, Types } from 'mongoose';

export type ProductType =
  | 'software'
  | 'ai_tool'
  | 'theme'
  | 'plugin'
  | 'script'
  | 'template'
  | 'landing_page'
  | 'bundle'
  | 'course'
  | 'digital_download'
  | 'subscription';

export type ProductStatus = 'draft' | 'published' | 'archived';
export type ProductSyncMode = 'global' | 'optional' | 'private' | 'exclusive';

export interface ProductDocument extends Document {
  name: string;
  slug: string;
  type: ProductType;
  description: string;
  basePrice: number;
  currency: string;
  currentVersion: string | null;
  changelogJson: Record<string, unknown> | null;
  status: ProductStatus;
  thumbnailUrl: string | null;
  thumbnailPublicId: string | null;
  syncMode: ProductSyncMode;
  tenantId: Types.ObjectId | null;
  /** Master-catalog category (a Category with tenantId: null) — drives marketplace browsing/filtering. */
  categoryId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const PRODUCT_TYPES: ProductType[] = [
  'software',
  'ai_tool',
  'theme',
  'plugin',
  'script',
  'template',
  'landing_page',
  'bundle',
  'course',
  'digital_download',
  'subscription',
];

const productSchema = new Schema<ProductDocument>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    type: { type: String, enum: PRODUCT_TYPES, required: true },
    description: { type: String, default: '' },
    basePrice: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    currentVersion: { type: String, default: null },
    changelogJson: { type: Schema.Types.Mixed, default: null },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
    thumbnailUrl: { type: String, default: null },
    thumbnailPublicId: { type: String, default: null },
    syncMode: { type: String, enum: ['global', 'optional', 'private', 'exclusive'], default: 'optional' },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
  },
  { timestamps: true }
);

export const Product = model<ProductDocument>('Product', productSchema);
