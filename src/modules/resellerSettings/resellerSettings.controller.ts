import { Request, Response, NextFunction } from 'express';
import * as service from './resellerSettings.service';

export async function getStoreSettingsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const store = await service.getStoreSettings(req.tenantId as string);
    res.status(200).json({ store });
  } catch (err) {
    next(err);
  }
}

export async function updateStoreSettingsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const store = await service.updateStoreSettings(req.tenantId as string, req.body);
    res.status(200).json({ store });
  } catch (err) {
    next(err);
  }
}

export async function verifyDomainDnsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const store = await service.verifyDomainDns(req.tenantId as string);
    res.status(200).json({ store });
  } catch (err) {
    next(err);
  }
}

export async function updatePaymentGatewayHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const store = await service.updatePaymentGateway(req.tenantId as string, req.body);
    res.status(200).json({ store });
  } catch (err) {
    next(err);
  }
}

export async function updateSmtpConfigHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const store = await service.updateSmtpConfig(req.tenantId as string, req.body);
    res.status(200).json({ store });
  } catch (err) {
    next(err);
  }
}

export async function sendTestEmailHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await service.sendTestEmail(req.tenantId as string, req.body.to);
    res.status(200).json({ sent: true });
  } catch (err) {
    next(err);
  }
}
