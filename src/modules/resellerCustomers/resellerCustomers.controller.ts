import { Request, Response, NextFunction } from 'express';
import * as service from './resellerCustomers.service';

export async function listCustomersHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const customers = await service.listCustomers(req.tenantId as string);
    res.status(200).json({ customers });
  } catch (err) {
    next(err);
  }
}

export async function createCustomerHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const customer = await service.createCustomer(req.tenantId as string, req.body);
    res.status(201).json({ customer });
  } catch (err) {
    next(err);
  }
}

export async function updateCustomerHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const customer = await service.updateCustomer(req.tenantId as string, req.params.id, req.body);
    res.status(200).json({ customer });
  } catch (err) {
    next(err);
  }
}

export async function createAccessCodeHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const accessCode = await service.createAccessCode(req.tenantId as string, req.params.id, req.body);
    res.status(201).json({ accessCode });
  } catch (err) {
    next(err);
  }
}

export async function listAccessCodesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const accessCodes = await service.listAccessCodes(req.tenantId as string);
    res.status(200).json({ accessCodes });
  } catch (err) {
    next(err);
  }
}

export async function revokeAccessCodeHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const accessCode = await service.revokeAccessCode(req.tenantId as string, req.params.id);
    res.status(200).json({ accessCode });
  } catch (err) {
    next(err);
  }
}
