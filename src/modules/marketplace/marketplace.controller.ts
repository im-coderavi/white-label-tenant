import { Request, Response, NextFunction } from 'express';
import * as marketplaceService from './marketplace.service';
import { resolveWebhookOutcome } from '../../common/webhookRouter';

export async function listMarketplaceHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined;
    const categoryIds = categoryId ? await marketplaceService.resolveCategoryIds(categoryId) : undefined;
    const items = await marketplaceService.listMarketplace(req.tenantId as string, categoryIds);
    res.status(200).json({ items });
  } catch (err) {
    next(err);
  }
}

export async function redeemLicenseKeyHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await marketplaceService.redeemLicenseKey(req.tenantId as string, req.body.key);
    res.status(200).json({ result });
  } catch (err) {
    next(err);
  }
}

export async function createMarketplaceCheckoutHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await marketplaceService.createMarketplaceCheckout({
      productId: req.body.productId,
      tenantId: req.tenantId as string,
      buyerUserId: req.user!.id,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function confirmMarketplacePurchaseHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const order = await marketplaceService.confirmMarketplacePurchase(req.params.id, req.tenantId as string);
    res.status(200).json({ order });
  } catch (err) {
    next(err);
  }
}

export async function marketplaceWebhookHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const outcome = await resolveWebhookOutcome(req, res);
    if (!outcome) return;
    const order = await marketplaceService.processMarketplaceWebhook(outcome.gatewayOrderId, outcome.success);
    res.status(200).json({ order });
  } catch (err) {
    next(err);
  }
}
