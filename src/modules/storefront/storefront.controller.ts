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

export async function redeemCodeHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code } = req.body;
    if (!code) {
      res.status(400).json({ message: 'Access code is required' });
      return;
    }
    const result = await storefrontService.redeemAccessCode(req.tenantId as string, code);
    res.status(200).json({ result });
  } catch (err) {
    next(err);
  }
}

export async function getStorePublicConfigHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.resolvedTenantId) {
      const store = await storefrontService.getStorePublicConfigById(req.resolvedTenantId);
      res.status(200).json({ store });
      return;
    }
    const domain = (req.query.domain as string) || req.hostname;
    const store = await storefrontService.getStorePublicConfig(domain);
    res.status(200).json({ store });
  } catch (err) {
    next(err);
  }
}
