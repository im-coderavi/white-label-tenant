import { z } from 'zod';

export const createOwnProductSchema = z.object({
  name: z.string().trim().min(1).max(160),
  categoryId: z.string().min(1).nullable().optional(),
  shortDescription: z.string().trim().max(240).optional(),
  description: z.string().trim().max(5000).optional(),
  price: z.coerce.number().min(0),
  currency: z.string().trim().optional(),
  thumbnailUrl: z.string().trim().url().nullable().optional(),
  fileUrl: z.string().trim().url().nullable().optional(),
});

export const updateOwnProductSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  categoryId: z.string().min(1).nullable().optional(),
  shortDescription: z.string().trim().max(240).optional(),
  description: z.string().trim().max(5000).optional(),
  price: z.coerce.number().min(0).optional(),
  currency: z.string().trim().optional(),
  thumbnailUrl: z.string().trim().url().nullable().optional(),
  fileUrl: z.string().trim().url().nullable().optional(),
  isFeatured: z.boolean().optional(),
  status: z.enum(['draft', 'published']).optional(),
});
