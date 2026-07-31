import { Request, Response, NextFunction } from 'express';
import * as plansService from './plans.service';

export async function listPlansHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const plans = await plansService.listPlans();
    res.status(200).json({ plans });
  } catch (err) {
    next(err);
  }
}

export async function createPlanHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const plan = await plansService.createPlan(req.body);
    res.status(201).json({ plan });
  } catch (err) {
    next(err);
  }
}

export async function updatePlanHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const plan = await plansService.updatePlan(req.params.id, req.body);
    res.status(200).json({ plan });
  } catch (err) {
    next(err);
  }
}

export async function archivePlanHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const plan = await plansService.archivePlan(req.params.id);
    res.status(200).json({ plan });
  } catch (err) {
    next(err);
  }
}

export async function listActiveResellerPlansHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const plans = await plansService.listActiveResellerPlans();
    res.status(200).json({ plans });
  } catch (err) {
    next(err);
  }
}
