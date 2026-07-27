import { z } from 'zod';

export const createCheckoutSchema = z.object({
  productId: z.string().min(1),
});

export const webhookPayloadSchema = z.object({
  gatewayOrderId: z.string().min(1),
  success: z.boolean(),
});
