import { Schema, model, Document, Types } from 'mongoose';

export interface ProductVersionDocument extends Document {
  productId: Types.ObjectId;
  version: string;
  changelog: string;
  fileUrl: string | null;
  filePublicId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const productVersionSchema = new Schema<ProductVersionDocument>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    version: { type: String, required: true },
    changelog: { type: String, default: '' },
    fileUrl: { type: String, default: null },
    filePublicId: { type: String, default: null },
  },
  { timestamps: true }
);

export const ProductVersion = model<ProductVersionDocument>('ProductVersion', productVersionSchema);
