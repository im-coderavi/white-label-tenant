import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('4000'),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  REFRESH_TOKEN_TTL_DAYS: z.string().default('30'),
  STORAGE_DRIVER: z.enum(['local', 'cloudinary']).default('local'),
  CLOUDINARY_URL: z.string().default(''),
  SMTP_HOST: z.string().min(1, 'SMTP_HOST is required'),
  SMTP_PORT: z.string().default('587'),
  SMTP_USER: z.string().default(''),
  SMTP_PASSWORD: z.string().default(''),
  SMTP_FROM: z.string().min(1, 'SMTP_FROM is required'),
  MOCK_WEBHOOK_SECRET: z.string().min(1, 'MOCK_WEBHOOK_SECRET is required'),
  SECRET_ENCRYPTION_KEY: z.string().min(32, 'SECRET_ENCRYPTION_KEY must be at least 32 characters'),
  RAZORPAY_KEY_ID: z.string().default(''),
  RAZORPAY_KEY_SECRET: z.string().default(''),
  PLATFORM_TARGET_IP: z.string().default(''),
  PLATFORM_CNAME_TARGET: z.string().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

if (parsed.data.STORAGE_DRIVER === 'cloudinary' && !parsed.data.CLOUDINARY_URL) {
  throw new Error('CLOUDINARY_URL is required when STORAGE_DRIVER=cloudinary');
}

export const env = {
  ...parsed.data,
  PORT: Number(parsed.data.PORT),
  REFRESH_TOKEN_TTL_DAYS: Number(parsed.data.REFRESH_TOKEN_TTL_DAYS),
  SMTP_PORT: Number(parsed.data.SMTP_PORT),
};
