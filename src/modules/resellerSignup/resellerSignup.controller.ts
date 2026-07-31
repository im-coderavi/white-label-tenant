import { Request, Response, NextFunction } from 'express';
import * as resellerSignupService from './resellerSignup.service';
import { mockPaymentGateway } from '../../common/paymentGateway';

export async function registerResellerHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await resellerSignupService.registerReseller(req.body);
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
    const subscription = await resellerSignupService.processResellerSignupWebhook(
      parsed.gatewayOrderId,
      parsed.success
    );
    res.status(200).json({ subscription });
  } catch (err) {
    next(err);
  }
}
