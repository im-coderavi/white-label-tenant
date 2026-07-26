import { Request, Response, NextFunction } from 'express';
import * as usersService from './users.service';
import { ForbiddenError } from '../../common/errors';

export async function listUsersHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.tenantId) {
      throw new ForbiddenError('No tenant context');
    }
    const users = await usersService.listUsersForTenant(req.tenantId);
    res.status(200).json({ users });
  } catch (err) {
    next(err);
  }
}
