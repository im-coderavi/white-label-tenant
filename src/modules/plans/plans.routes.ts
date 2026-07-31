import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { createPlanSchema, updatePlanSchema } from './plans.validators';
import {
  listPlansHandler,
  createPlanHandler,
  updatePlanHandler,
  archivePlanHandler,
} from './plans.controller';

export const plansRouter = Router();

plansRouter.use(requireAuth, requireRole('master_admin'));

plansRouter.get('/', listPlansHandler);
plansRouter.post('/', validateBody(createPlanSchema), createPlanHandler);
plansRouter.patch('/:id', validateBody(updatePlanSchema), updatePlanHandler);
plansRouter.delete('/:id', archivePlanHandler);
