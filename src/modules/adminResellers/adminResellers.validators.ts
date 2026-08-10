import { z } from 'zod';

export const assignPlanSchema = z.object({
  planId: z.string().min(1),
});

export const setEntitlementSchema = z.object({
  productId: z.string().min(1),
  enabled: z.boolean(),
});
