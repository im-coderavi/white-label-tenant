import { z } from 'zod';

export const createPlanSchema = z.object({
  scope: z.enum(['reseller', 'customer']),
  name: z.string().min(1),
  price: z.coerce.number().min(0),
  currency: z.string().optional(),
  billingCycle: z.enum(['monthly', 'annual', 'lifetime']),
  featureFlagsJson: z.record(z.unknown()).optional(),
  limitsJson: z.record(z.unknown()).optional(),
});

export const updatePlanSchema = z.object({
  name: z.string().min(1).optional(),
  price: z.coerce.number().min(0).optional(),
  currency: z.string().optional(),
  billingCycle: z.enum(['monthly', 'annual', 'lifetime']).optional(),
  featureFlagsJson: z.record(z.unknown()).optional(),
  limitsJson: z.record(z.unknown()).optional(),
});
