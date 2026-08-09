import { Request, Response, NextFunction } from 'express';
import { resolveTenantByHost } from '../common/tenantResolver';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      resolvedTenantId?: string | null;
    }
  }
}

/**
 * Resolves which tenant owns the domain/subdomain this request arrived on and attaches
 * `req.resolvedTenantId`. Runs on every request (cheap single lookup) so public storefront
 * routes can trust the domain instead of only a JWT claim, and authenticated routes can be
 * cross-checked against it in `requireAuth` to stop a token issued on one tenant's domain
 * from being replayed against a different reseller's domain.
 */
export async function resolveTenant(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const host = (req.query.domain as string) || req.hostname;
    const tenant = await resolveTenantByHost(host);
    req.resolvedTenantId = tenant ? tenant._id.toString() : null;
  } catch {
    req.resolvedTenantId = null;
  }
  next();
}
