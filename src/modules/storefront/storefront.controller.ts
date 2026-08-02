import { Request, Response, NextFunction } from 'express';
import * as storefrontService from './storefront.service';

export async function listStorefrontHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const items = await storefrontService.listStorefront(req.tenantId as string);
    res.status(200).json({ items });
  } catch (err) {
    next(err);
  }
}

export async function getStorefrontProductHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const product = await storefrontService.getStorefrontProduct(req.tenantId as string, req.params.id);
    res.status(200).json({ product });
  } catch (err) {
    next(err);
  }
}
