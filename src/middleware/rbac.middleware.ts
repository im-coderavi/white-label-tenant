import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ForbiddenError, UnauthorizedError } from '../common/errors';

export function requireRole(...roles: string[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError(`Requires role: ${roles.join(' or ')}`));
      return;
    }
    next();
  };
}
