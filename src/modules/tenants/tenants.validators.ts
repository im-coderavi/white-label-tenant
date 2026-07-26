import { z } from 'zod';

export const createTenantSchema = z.object({
  name: z.string().min(1),
  subdomain: z
    .string()
    .min(3)
    .regex(/^[a-z0-9-]+$/, 'Subdomain must be lowercase alphanumeric with hyphens'),
});
