import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { validateQuery } from '../../middleware/validate.middleware';
import { listLicensesQuerySchema } from './licenses.validators';
import { listResellerLicensesHandler } from './licenses.controller';

export const resellerLicensesRouter = Router();

resellerLicensesRouter.use(requireAuth, requireRole('reseller_admin', 'reseller_staff'));
resellerLicensesRouter.get('/', validateQuery(listLicensesQuerySchema), listResellerLicensesHandler);
