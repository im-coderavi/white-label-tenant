import { z } from 'zod';

export const registerResellerSchema = z.object({
  businessName: z.string().min(1),
  subdomain: z
    .string()
    .min(3)
    .regex(/^[a-z0-9-]+$/, 'Subdomain must be lowercase alphanumeric with hyphens'),
  email: z.string().email(),
  password: z.string().min(8),
  planId: z.string().min(1),
});

export const resellerWebhookPayloadSchema = z.object({
  gatewayOrderId: z.string().min(1),
  success: z.boolean(),
});



