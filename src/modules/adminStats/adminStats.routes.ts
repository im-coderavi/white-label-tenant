import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { getPlatformStatsHandler } from './adminStats.controller';

export const adminStatsRouter = Router();

adminStatsRouter.use(requireAuth, requireRole('master_admin'));

adminStatsRouter.get('/', getPlatformStatsHandler);
