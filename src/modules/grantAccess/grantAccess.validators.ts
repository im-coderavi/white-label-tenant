import { z } from 'zod';

export const grantAccessSchema = z.object({
  customerId: z.string().min(1),
  productId: z.string().min(1),
  expiresAt: z.string().datetime().nullable().optional(),
});
