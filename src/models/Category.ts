import { Schema, model, Document, Types } from 'mongoose';

export interface CategoryDocument extends Document {
  tenantId: Types.ObjectId | null; // null = Master Admin category
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  parentId?: Types.ObjectId | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<CategoryDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    description: { type: String, default: '' },
    icon: { type: String, default: 'folder' },
    parentId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

categorySchema.index({ tenantId: 1, slug: 1 }, { unique: true });

export const Category = model<CategoryDocument>('Category', categorySchema);
