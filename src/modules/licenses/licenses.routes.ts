import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { validateBody, validateQuery } from '../../middleware/validate.middleware';
import {
  generateLicensesSchema,
  listLicensesQuerySchema,
  importLicensesSchema,
  assignLicenseSchema,
} from './licenses.validators';
import {
  listLicensesHandler,
  generateLicensesHandler,
  importLicensesHandler,
  revokeLicenseHandler,
  assignLicenseHandler,
} from './licenses.controller';

export const adminLicensesRouter = Router();

adminLicensesRouter.use(requireAuth, requireRole('master_admin'));

adminLicensesRouter.get('/', validateQuery(listLicensesQuerySchema), listLicensesHandler);
adminLicensesRouter.post('/generate', validateBody(generateLicensesSchema), generateLicensesHandler);
adminLicensesRouter.post('/import', validateBody(importLicensesSchema), importLicensesHandler);
adminLicensesRouter.patch('/:id/revoke', revokeLicenseHandler);
adminLicensesRouter.post('/:id/assign', validateBody(assignLicenseSchema), assignLicenseHandler);
