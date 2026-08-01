import { Request, Response, NextFunction } from 'express';
import * as tenantsService from './tenants.service';

export async function createTenantHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenant = await tenantsService.createTenant(req.body);
    res.status(201).json({ tenant });
  } catch (err) {
    next(err);
  }
}

export async function getTenantHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenant = await tenantsService.getTenantById(req.params.id);
    res.status(200).json({ tenant });
  } catch (err) {
    next(err);
  }
}

export async function listTenantsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenants = await tenantsService.listTenants();
    res.status(200).json({ tenants });
  } catch (err) {
    next(err);
  }
}
