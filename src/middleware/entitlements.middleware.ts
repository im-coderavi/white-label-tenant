import { Request, Response, NextFunction } from 'express';
import { getResellerEntitlements, ResolvedEntitlements } from '../common/planEntitlements';
import { ForbiddenError } from '../common/errors';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      entitlements?: ResolvedEntitlements;
    }
  }
}

/** Loads the caller's plan entitlements onto req.entitlements. Master admin requests skip this (no tenant to gate). */
export async function loadEntitlements(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.tenantId) {
    next();
    return;
  }
  try {
    req.entitlements = await getResellerEntitlements(req.tenantId);
    next();
  } catch (err) {
    next(err);
  }
}

/** Blocks the request unless the loaded entitlements have the given flag set — mount after loadEntitlements. */
export function requireEntitlement(flag: keyof ResolvedEntitlements, message?: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.entitlements || !req.entitlements[flag]) {
      next(new ForbiddenError(message ?? `Your plan does not include this feature (${String(flag)})`));
      return;
    }
    next();
  };
}
