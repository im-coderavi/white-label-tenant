import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { createTenantSchema } from './tenants.validators';
import { createTenantHandler, getTenantHandler, listTenantsHandler } from './tenants.controller';

export const tenantsRouter = Router();

tenantsRouter.get('/', requireAuth, requireRole('master_admin'), listTenantsHandler);
tenantsRouter.post(
  '/',
  requireAuth,
  requireRole('master_admin'),
  validateBody(createTenantSchema),
  createTenantHandler
);
tenantsRouter.get('/:id', requireAuth, requireRole('master_admin'), getTenantHandler);
