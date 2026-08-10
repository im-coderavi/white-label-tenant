import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { grantAccessSchema } from './grantAccess.validators';
import { grantProductAccessHandler, listGrantedAccessHandler } from './grantAccess.controller';

export const grantAccessRouter = Router();

grantAccessRouter.use(requireAuth, requireRole('reseller_admin', 'reseller_staff'));

grantAccessRouter.get('/', listGrantedAccessHandler);
grantAccessRouter.post('/', validateBody(grantAccessSchema), grantProductAccessHandler);
