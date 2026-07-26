import { z } from 'zod';

export const registerSchema = z.object({
  tenantSubdomain: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8),
});

export const loginSchema = z.object({
  tenantSubdomain: z.string().min(3).optional(),
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  tenantSubdomain: z.string().min(3),
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});
