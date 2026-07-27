import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { listMyLicensesHandler, activateLicenseHandler } from './licenses.controller';

export const customerLicensesRouter = Router();

customerLicensesRouter.use(requireAuth, requireRole('customer'));

customerLicensesRouter.get('/', listMyLicensesHandler);
customerLicensesRouter.post('/:id/activate', activateLicenseHandler);
