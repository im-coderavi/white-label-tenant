import { Request, Response, NextFunction } from 'express';
import * as checkoutService from './checkout.service';

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
