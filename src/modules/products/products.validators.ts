import { z } from 'zod';

export const PRODUCT_TYPES = [
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
] as const;

export const createProductSchema = z.object({
  name: z.string().min(1),
  type: z.enum(PRODUCT_TYPES),
  description: z.string().optional().default(''),
  basePrice: z.coerce.number().min(0),
  currency: z.string().optional(),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  basePrice: z.coerce.number().min(0).optional(),
  currency: z.string().optional(),
});

export const addVersionSchema = z.object({
  version: z.string().min(1),
  changelog: z.string().optional().default(''),
});

export const syncModeSchema = z
  .object({
    syncMode: z.enum(['global', 'optional', 'private', 'exclusive']),
    tenantId: z.string().optional(),
  })
  .refine((data) => !(['private', 'exclusive'].includes(data.syncMode) && !data.tenantId), {
    message: 'tenantId is required when syncMode is private or exclusive',
    path: ['tenantId'],
  });

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  type: z.enum(PRODUCT_TYPES).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  search: z.string().optional(),
});
