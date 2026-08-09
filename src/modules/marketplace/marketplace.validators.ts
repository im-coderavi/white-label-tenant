import { z } from 'zod';

export const redeemLicenseKeySchema = z.object({
  key: z.string().trim().min(1),
});

export const marketplaceCheckoutSchema = z.object({
  productId: z.string().min(1),
});
