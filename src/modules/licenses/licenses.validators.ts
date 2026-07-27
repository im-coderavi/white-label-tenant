import { z } from 'zod';

export const generateLicensesSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(1000),
  expiresAt: z.string().datetime().optional(),
});

export const importLicensesSchema = z.object({
  productId: z.string().min(1),
  keys: z.array(z.string().min(1)).min(1),
});

export const assignLicenseSchema = z.object({
  userId: z.string().min(1),
});

export const listLicensesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  productId: z.string().optional(),
  tenantId: z.string().optional(),
  status: z
    .enum(['draft', 'available', 'reserved', 'assigned', 'activated', 'suspended', 'expired', 'revoked'])
    .optional(),
});
