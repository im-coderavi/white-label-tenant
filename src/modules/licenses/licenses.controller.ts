import { Request, Response, NextFunction } from 'express';
import * as licensesService from './licenses.service';

export async function listLicensesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await licensesService.listLicenses(
      req.query as unknown as licensesService.ListLicensesQuery
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function generateLicensesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const licenses = await licensesService.generateLicenses(req.body);
    res.status(201).json({ licenses });
  } catch (err) {
    next(err);
  }
}

export async function importLicensesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const licenses = await licensesService.importLicenses(req.body);
    res.status(201).json({ licenses });
  } catch (err) {
    next(err);
  }
}

export async function revokeLicenseHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const license = await licensesService.revokeLicense(req.params.id);
    res.status(200).json({ license });
  } catch (err) {
    next(err);
  }
}

export async function assignLicenseHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const license = await licensesService.assignLicense(req.params.id, req.body.userId);
    res.status(200).json({ license });
  } catch (err) {
    next(err);
  }
}
