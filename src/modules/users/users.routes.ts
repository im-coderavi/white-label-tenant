import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { listUsersHandler } from './users.controller';

export const usersRouter = Router();

usersRouter.get('/', requireAuth, requireRole('reseller_admin'), listUsersHandler);
