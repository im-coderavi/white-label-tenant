import { Schema, model, Document } from 'mongoose';

export type TutorialCategory = 'getting_started' | 'store_setup' | 'domains' | 'access_codes' | 'payments' | 'marketing';

export interface TutorialDocument extends Document {
  title: string;
  slug: string;
  category: TutorialCategory;
  description: string;
  videoUrl?: string;
  contentMarkdown: string;
  sortOrder: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const tutorialSchema = new Schema<TutorialDocument>(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    category: {
      type: String,
      enum: ['getting_started', 'store_setup', 'domains', 'access_codes', 'payments', 'marketing'],
      required: true,
    },
    description: { type: String, default: '' },
    videoUrl: { type: String, default: '' },
    contentMarkdown: { type: String, required: true },
    sortOrder: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Tutorial = model<TutorialDocument>('Tutorial', tutorialSchema);
