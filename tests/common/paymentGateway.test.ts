import crypto from 'crypto';
import { mockPaymentGateway } from '../../src/common/paymentGateway';

describe('mockPaymentGateway', () => {
  it('creates an order with a mock_order_ prefixed id', async () => {
    const { gatewayOrderId } = await mockPaymentGateway.createOrder({
      amount: 100,
      currency: 'INR',
      receipt: 'order-1',
    });
    expect(gatewayOrderId).toMatch(/^mock_order_[a-f0-9]+$/);
  });

  it('returns null for an invalid signature', () => {
    const rawBody = JSON.stringify({ gatewayOrderId: 'mock_order_abc', success: true });
    const result = mockPaymentGateway.verifyAndParseWebhook(rawBody, 'not-the-real-signature');
    expect(result).toBeNull();
  });

  it('parses the payload for a valid signature', () => {
    const rawBody = JSON.stringify({ gatewayOrderId: 'mock_order_abc', success: true });
    const signature = crypto
      .createHmac('sha256', 'test-webhook-secret-please-ignore')
      .update(rawBody)
      .digest('hex');
    const result = mockPaymentGateway.verifyAndParseWebhook(rawBody, signature);
    expect(result).toEqual({ gatewayOrderId: 'mock_order_abc', success: true });
  });
});
