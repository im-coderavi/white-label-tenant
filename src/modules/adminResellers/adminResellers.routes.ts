import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { assignPlanSchema, setEntitlementSchema } from './adminResellers.validators';
import {
  activateResellerHandler,
  assignPlanHandler,
  getResellerHandler,
  listEntitlementsHandler,
  listResellersHandler,
  setEntitlementHandler,
  suspendResellerHandler,
} from './adminResellers.controller';

export const adminResellersRouter = Router();

adminResellersRouter.use(requireAuth, requireRole('master_admin'));

adminResellersRouter.get('/', listResellersHandler);
adminResellersRouter.get('/:id', getResellerHandler);
adminResellersRouter.patch('/:id/suspend', suspendResellerHandler);
adminResellersRouter.patch('/:id/activate', activateResellerHandler);
adminResellersRouter.patch('/:id/plan', validateBody(assignPlanSchema), assignPlanHandler);
adminResellersRouter.get('/:id/entitlements', listEntitlementsHandler);
adminResellersRouter.patch('/:id/entitlements', validateBody(setEntitlementSchema), setEntitlementHandler);
