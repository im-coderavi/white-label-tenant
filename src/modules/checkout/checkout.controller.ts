import { Request, Response, NextFunction } from 'express';
import * as checkoutService from './checkout.service';
import { resolveWebhookOutcome } from '../../common/webhookRouter';

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
    const outcome = await resolveWebhookOutcome(req, res);
    if (!outcome) return;
    const order = await checkoutService.processWebhook(outcome.gatewayOrderId, outcome.success);
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

export async function confirmPaymentHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const order = await checkoutService.confirmPayment(req.params.id, req.user!.id);
    res.status(200).json({ order });
  } catch (err) {
    next(err);
  }
}
