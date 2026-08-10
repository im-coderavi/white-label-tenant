import { z } from 'zod';

export const updateBrandingSchema = z
  .object({
    storeName: z.string().trim().min(2).max(80).optional(),
    tagline: z.string().trim().max(160).optional(),
    logoUrl: z.string().trim().url().nullable().optional(),
    primaryColor: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    accentColor: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    heroTitle: z.string().trim().max(100).optional(),
    heroSubtitle: z.string().trim().max(240).optional(),
    supportEmail: z.string().trim().email().nullable().optional(),
    whatsappUrl: z.string().trim().url().nullable().optional(),
    customDomain: z.string().trim().min(3).max(120).nullable().optional(),
  })
  // Historically this endpoint also accepted arbitrary extra branding keys merged straight into
  // brandingJson (see resellerSettings.service.ts updateStoreSettings) — kept permissive so those
  // still pass through instead of getting rejected now that this schema is actually enforced.
  .passthrough();

export const updatePaymentGatewaySchema = z.object({
  provider: z.literal('razorpay'),
  keyId: z.string().trim().min(1).max(200),
  keySecret: z.string().trim().min(1).max(500).optional(),
});

export const updateSmtpConfigSchema = z.object({
  host: z.string().trim().min(1).max(200),
  port: z.coerce.number().int().min(1).max(65535),
  user: z.string().trim().max(200).optional(),
  password: z.string().trim().max(500).optional(),
  fromName: z.string().trim().max(120).optional(),
  fromEmail: z.string().trim().email().optional(),
});

export const sendTestEmailSchema = z.object({
  to: z.string().trim().email(),
});
