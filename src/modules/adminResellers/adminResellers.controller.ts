import { Request, Response, NextFunction } from 'express';
import * as service from './adminResellers.service';

export async function listResellersHandler(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resellers = await service.listResellers();
    res.status(200).json({ resellers });
  } catch (err) {
    next(err);
  }
}

export async function getResellerHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const reseller = await service.getReseller(req.params.id);
    res.status(200).json({ reseller });
  } catch (err) {
    next(err);
  }
}

export async function suspendResellerHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const reseller = await service.setResellerStatus(req.params.id, 'suspended');
    res.status(200).json({ reseller });
  } catch (err) {
    next(err);
  }
}

export async function activateResellerHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const reseller = await service.setResellerStatus(req.params.id, 'active');
    res.status(200).json({ reseller });
  } catch (err) {
    next(err);
  }
}

export async function assignPlanHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const reseller = await service.assignResellerPlan(req.params.id, req.body.planId);
    res.status(200).json({ reseller });
  } catch (err) {
    next(err);
  }
}

export async function listEntitlementsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const entitlements = await service.listResellerEntitlements(req.params.id);
    res.status(200).json({ entitlements });
  } catch (err) {
    next(err);
  }
}

export async function setEntitlementHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const entitlement = await service.setResellerProductEntitlement(
      req.params.id,
      req.body.productId,
      req.body.enabled
    );
    res.status(200).json({ entitlement });
  } catch (err) {
    next(err);
  }
}
