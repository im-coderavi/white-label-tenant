import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../common/jwt';
import { UnauthorizedError, ForbiddenError } from '../common/errors';
import { logger } from '../common/logger';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: string; tenantId: string | null };
      tenantId?: string | null;
      rawBody?: Buffer;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(new UnauthorizedError('Missing or invalid Authorization header'));
    return;
  }
  const token = header.slice('Bearer '.length);
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, tenantId: payload.tenantId };
    req.tenantId = payload.tenantId;
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
  }
}

/**
 * Rejects requests where the JWT was issued for one reseller's tenant but arrives on a
 * different reseller's resolved domain — stops a stolen/leaked customer or reseller token
 * from being replayed on another storefront. Only enforced for tenant-scoped, non-master-admin
 * users, and only when the host actually resolved to a known tenant (unresolved hosts, e.g.
 * local dev IPs or the bare platform domain, are allowed through unchecked).
 */
export function requireMatchingTenantHost(req: Request, _res: Response, next: NextFunction): void {
  const resolved = req.resolvedTenantId;
  const jwtTenant = req.user?.tenantId ?? null;
  if (req.user?.role !== 'master_admin' && resolved && jwtTenant && resolved !== jwtTenant) {
    logger.warn('Tenant/host mismatch on authenticated request', {
      userId: req.user?.id,
      jwtTenant,
      resolvedTenant: resolved,
      host: req.hostname,
    });
    next(new ForbiddenError('Session does not match this store'));
    return;
  }
  next();
}
