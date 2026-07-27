import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../common/jwt';
import { UnauthorizedError } from '../common/errors';

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
