import { Request, Response, NextFunction } from 'express';
import * as resellerCatalogService from './resellerCatalog.service';

export async function listCatalogHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const items = await resellerCatalogService.listCatalog(req.tenantId as string);
    res.status(200).json({ items });
  } catch (err) {
    next(err);
  }
}

export async function updateCatalogItemHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await resellerCatalogService.updateCatalogItem(
      req.tenantId as string,
      req.params.id,
      req.body
    );
    res.status(200).json({ item });
  } catch (err) {
    next(err);
  }
}
