import crypto from 'crypto';
import Razorpay from 'razorpay';
import { env } from '../config/env';
import { Tenant } from '../models/Tenant';
import { decryptSecret, encryptSecret, isEncryptedSecret } from './cryptoSecrets';
import { logger } from './logger';

export interface PaymentGateway {
  provider: 'mock' | 'razorpay';
  createOrder(input: { amount: number; currency: string; receipt: string }): Promise<{ gatewayOrderId: string }>;
  verifyAndParseWebhook(
    rawBody: string,
    signature: string
  ): { gatewayOrderId: string; success: boolean } | null;
}

export const mockPaymentGateway: PaymentGateway = {
  provider: 'mock',
  async createOrder() {
    const gatewayOrderId = `mock_order_${crypto.randomBytes(8).toString('hex')}`;
    return { gatewayOrderId };
  },

  verifyAndParseWebhook(rawBody, signature) {
    const expected = crypto.createHmac('sha256', env.MOCK_WEBHOOK_SECRET).update(rawBody).digest('hex');
    if (expected !== signature) {
      return null;
    }
    return JSON.parse(rawBody) as { gatewayOrderId: string; success: boolean };
  },
};

/** Real Razorpay orders + the actual `hmac_sha256(order_id|payment_id, key_secret)` webhook signature scheme. */
export function createRazorpayGateway(keyId: string, keySecret: string): PaymentGateway {
  const client = new Razorpay({ key_id: keyId, key_secret: keySecret });

  return {
    provider: 'razorpay',
    async createOrder({ amount, currency, receipt }) {
      const order = await client.orders.create({
        amount: Math.round(amount * 100), // Razorpay expects paise/cents
        currency,
        receipt,
      });
      return { gatewayOrderId: order.id };
    },

    verifyAndParseWebhook(rawBody, signature) {
      const expected = crypto.createHmac('sha256', keySecret).update(rawBody).digest('hex');
      const expectedBuf = Buffer.from(expected, 'hex');
      const signatureBuf = Buffer.from(signature, 'hex');
      if (
        expectedBuf.length !== signatureBuf.length ||
        !crypto.timingSafeEqual(expectedBuf, signatureBuf)
      ) {
        return null;
      }
      const payload = JSON.parse(rawBody) as {
        event: string;
        payload: { payment: { entity: { order_id: string; status: string } } };
      };
      const entity = payload.payload?.payment?.entity;
      if (!entity) return null;
      return { gatewayOrderId: entity.order_id, success: entity.status === 'captured' };
    },
  };
}

export interface TenantGatewayCredentials {
  provider?: 'razorpay';
  keyId?: string;
  keySecretEncrypted?: string;
}

/** Encrypts a plaintext key secret before it's persisted onto `Tenant.paymentGatewayJson`. */
export function encryptGatewayCredentials(input: {
  provider: 'razorpay';
  keyId: string;
  keySecret: string;
}): TenantGatewayCredentials {
  return {
    provider: input.provider,
    keyId: input.keyId,
    keySecretEncrypted: input.keySecret ? encryptSecret(input.keySecret) : undefined,
  };
}

/**
 * Resolves the right gateway instance for a tenant: their own Razorpay sandbox/live keys if
 * configured, else the platform-level Razorpay keys if set, else the mock gateway (used in
 * tests and for brand-new resellers who haven't finished onboarding yet).
 */
export async function getGatewayForTenant(tenantId: string | null): Promise<PaymentGateway> {
  if (tenantId) {
    const tenant = await Tenant.findById(tenantId);
    const creds = tenant?.paymentGatewayJson as TenantGatewayCredentials | undefined;
    if (creds?.provider === 'razorpay' && creds.keyId && creds.keySecretEncrypted) {
      try {
        const keySecret = isEncryptedSecret(creds.keySecretEncrypted)
          ? decryptSecret(creds.keySecretEncrypted)
          : creds.keySecretEncrypted;
        return createRazorpayGateway(creds.keyId, keySecret);
      } catch (err) {
        logger.error('Failed to decrypt tenant gateway credentials, falling back', {
          tenantId,
          error: err instanceof Error ? err.stack : err,
        });
      }
    }
  }

  if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
    return createRazorpayGateway(env.RAZORPAY_KEY_ID, env.RAZORPAY_KEY_SECRET);
  }

  return mockPaymentGateway;
}
