import { Request, Response, NextFunction } from 'express';
import * as resellerAccountService from './resellerAccount.service';

export async function getSubscriptionHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const subscription = await resellerAccountService.getSubscriptionForTenant(req.tenantId as string);
    res.status(200).json({ subscription });
  } catch (err) {
    next(err);
  }
}

export async function getStatsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const stats = await resellerAccountService.getStatsForTenant(req.tenantId as string);
    res.status(200).json({ stats });
  } catch (err) {
    next(err);
  }
}

export async function listOrdersHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orders = await resellerAccountService.listOrdersForTenant(req.tenantId as string);
    res.status(200).json({ orders });
  } catch (err) {
    next(err);
  }
}
