import { z } from 'zod';

const overridesSchema = z.object({
  displayName: z.string().trim().min(1).max(160).optional(),
  shortDescription: z.string().trim().max(240).optional(),
  description: z.string().trim().max(5000).optional(),
  thumbnailUrl: z.string().trim().url().optional(),
});

export const updateCatalogItemSchema = z
  .object({
    enabled: z.boolean().optional(),
    pricingMode: z.enum(['default', 'custom', 'discount']).optional(),
    customPrice: z.coerce.number().min(0).optional(),
    discountPercent: z.coerce.number().min(0).max(100).optional(),
    isFeatured: z.boolean().optional(),
    sortOrder: z.coerce.number().int().optional(),
    overrides: overridesSchema.optional(),
  })
  .refine((data) => data.pricingMode !== 'custom' || data.customPrice !== undefined, {
    message: 'customPrice is required when pricingMode is custom',
    path: ['customPrice'],
  })
  .refine((data) => data.pricingMode !== 'discount' || data.discountPercent !== undefined, {
    message: 'discountPercent is required when pricingMode is discount',
    path: ['discountPercent'],
  });
