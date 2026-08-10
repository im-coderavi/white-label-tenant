import { Request, Response } from 'express';
import { mockPaymentGateway, getGatewayForTenant } from './paymentGateway';
import { Order, OrderDocument } from '../models/Order';

export interface WebhookOutcome {
  gatewayOrderId: string;
  success: boolean;
}

/**
 * Shared signature-verification front door for payment webhooks. Razorpay signs against the
 * whole raw body and only carries their own order id, so the order (and therefore which
 * tenant's secret to verify with) must be located before the signature can be checked; the
 * mock gateway path keeps the simpler single-shared-secret scheme used in tests/dev.
 * Returns the verified {gatewayOrderId, success} outcome, or null with the response already
 * written (400/404) when verification fails — callers should return immediately on null.
 */
export async function resolveWebhookOutcome(req: Request, res: Response): Promise<WebhookOutcome | null> {
  const rawBody = req.rawBody ? req.rawBody.toString('utf8') : '';
  const razorpaySignature = req.header('x-razorpay-signature');
  const mockSignature = req.header('x-webhook-signature');

  if (razorpaySignature) {
    let unverifiedOrderId: string | null = null;
    try {
      const body = JSON.parse(rawBody) as { payload?: { payment?: { entity?: { order_id?: string } } } };
      unverifiedOrderId = body.payload?.payment?.entity?.order_id ?? null;
    } catch {
      unverifiedOrderId = null;
    }
    if (!unverifiedOrderId) {
      res.status(400).json({ error: { message: 'Malformed webhook payload', code: 'INVALID_PAYLOAD' } });
      return null;
    }
    const order: OrderDocument | null = await Order.findOne({ paymentRef: unverifiedOrderId });
    if (!order) {
      res.status(404).json({ error: { message: 'Order not found for gateway reference', code: 'NOT_FOUND' } });
      return null;
    }
    const gateway = await getGatewayForTenant(order.tenantId.toString());
    const parsed = gateway.verifyAndParseWebhook(rawBody, razorpaySignature);
    if (!parsed) {
      res.status(400).json({ error: { message: 'Invalid webhook signature', code: 'INVALID_SIGNATURE' } });
      return null;
    }
    return parsed;
  }

  const parsed = mockPaymentGateway.verifyAndParseWebhook(rawBody, mockSignature ?? '');
  if (!parsed) {
    res.status(400).json({ error: { message: 'Invalid webhook signature', code: 'INVALID_SIGNATURE' } });
    return null;
  }
  return parsed;
}
