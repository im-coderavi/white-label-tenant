import crypto from 'crypto';
import { env } from '../config/env';

export interface PaymentGateway {
  createOrder(input: { amount: number; currency: string; receipt: string }): Promise<{ gatewayOrderId: string }>;
  verifyAndParseWebhook(
    rawBody: string,
    signature: string
  ): { gatewayOrderId: string; success: boolean } | null;
}

export const mockPaymentGateway: PaymentGateway = {
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
