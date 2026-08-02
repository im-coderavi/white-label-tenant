import { Request, Response, NextFunction } from 'express';
import * as publicStoreService from './publicStore.service';

export async function getStoreHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const subdomain = typeof req.query.subdomain === 'string' ? req.query.subdomain : undefined;
    const store = await publicStoreService.findStoreBySubdomain(subdomain);
    res.status(200).json({ store });
  } catch (err) {
    next(err);
  }
}
