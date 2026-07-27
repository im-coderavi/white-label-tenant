import { Request, Response, NextFunction } from 'express';
import * as checkoutService from './checkout.service';
import { mockPaymentGateway } from '../../common/paymentGateway';

export async function createCheckoutHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await checkoutService.createCheckout({
      productId: req.body.productId,
      tenantId: req.tenantId!,
      customerUserId: req.user!.id,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function webhookHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const signature = req.header('x-webhook-signature') ?? '';
    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : '';
    const parsed = mockPaymentGateway.verifyAndParseWebhook(rawBody, signature);
    if (!parsed) {
      res.status(400).json({ error: { message: 'Invalid webhook signature', code: 'INVALID_SIGNATURE' } });
      return;
    }
    const order = await checkoutService.processWebhook(parsed.gatewayOrderId, parsed.success);
    res.status(200).json({ order });
  } catch (err) {
    next(err);
  }
}

export async function listOrdersHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orders = await checkoutService.listOrdersForUser(req.user!.id);
    res.status(200).json({ orders });
  } catch (err) {
    next(err);
  }
}

export async function generateDownloadTokenHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await checkoutService.generateDownloadToken(req.params.orderId, req.user!.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
