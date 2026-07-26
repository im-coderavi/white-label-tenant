import { Request, Response, NextFunction } from 'express';
import { AppError } from '../common/errors';
import { logger } from '../common/logger';

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { message: err.message, code: err.code, details: err.details } });
    return;
  }
  logger.error('Unhandled error', { error: err instanceof Error ? err.stack : err });
  res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
}
