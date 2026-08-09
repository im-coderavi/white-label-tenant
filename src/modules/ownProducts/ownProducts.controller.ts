import { Request, Response, NextFunction } from 'express';
import * as ownProductsService from './ownProducts.service';

export async function listOwnProductsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const products = await ownProductsService.listOwnProducts(req.tenantId as string);
    res.status(200).json({ products });
  } catch (err) {
    next(err);
  }
}

export async function createOwnProductHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await ownProductsService.createOwnProduct(req.tenantId as string, req.body);
    res.status(201).json({ product });
  } catch (err) {
    next(err);
  }
}

export async function updateOwnProductHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await ownProductsService.updateOwnProduct(req.tenantId as string, req.params.id, req.body);
    res.status(200).json({ product });
  } catch (err) {
    next(err);
  }
}

export async function deleteOwnProductHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await ownProductsService.deleteOwnProduct(req.tenantId as string, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
