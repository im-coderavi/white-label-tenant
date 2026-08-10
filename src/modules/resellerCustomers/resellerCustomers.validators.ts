import { z } from 'zod';

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  phone: z.string().trim().min(3).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const updateCustomerSchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().min(3).nullable().optional(),
  notes: z.string().trim().max(1000).optional(),
  status: z.enum(['active', 'blocked']).optional(),
});

export const createAccessCodeSchema = z.object({
  productId: z.string().trim().min(1),
  expiresAt: z.coerce.date().nullable().optional(),
});
