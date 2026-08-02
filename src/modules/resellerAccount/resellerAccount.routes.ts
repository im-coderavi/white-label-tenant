import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { getSubscriptionHandler, getStatsHandler, listOrdersHandler } from './resellerAccount.controller';

export const resellerAccountRouter = Router();

resellerAccountRouter.use(requireAuth, requireRole('reseller_admin', 'reseller_staff'));

resellerAccountRouter.get('/subscription', getSubscriptionHandler);
resellerAccountRouter.get('/stats', getStatsHandler);
resellerAccountRouter.get('/orders', listOrdersHandler);
