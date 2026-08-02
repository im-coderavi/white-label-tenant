import { Request, Response, NextFunction } from 'express';
import * as adminStatsService from './adminStats.service';

export async function getPlatformStatsHandler(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const stats = await adminStatsService.getPlatformStats();
    res.status(200).json({ stats });
  } catch (err) {
    next(err);
  }
}
