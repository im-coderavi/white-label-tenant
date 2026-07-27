import { Schema, model, Document, Types } from 'mongoose';

export interface DownloadTokenDocument extends Document {
  orderId: Types.ObjectId;
  fileUrl: string;
  expiresAt: Date;
  used: boolean;
  ipAddress: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const downloadTokenSchema = new Schema<DownloadTokenDocument>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    fileUrl: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false },
    ipAddress: { type: String, default: null },
  },
  { timestamps: true }
);

export const DownloadToken = model<DownloadTokenDocument>('DownloadToken', downloadTokenSchema);
