import { Request, Response, NextFunction } from 'express';
import * as grantAccessService from './grantAccess.service';

export async function grantProductAccessHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const grant = await grantAccessService.grantProductAccess(req.tenantId as string, req.body);
    res.status(201).json({ grant });
  } catch (err) {
    next(err);
  }
}

export async function listGrantedAccessHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const grants = await grantAccessService.listGrantedAccess(req.tenantId as string);
    res.status(200).json({ grants });
  } catch (err) {
    next(err);
  }
}
