import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { loadEntitlements, requireEntitlement } from '../../middleware/entitlements.middleware';
import { updateCatalogItemSchema } from './resellerCatalog.validators';
import { listCatalogHandler, updateCatalogItemHandler } from './resellerCatalog.controller';

export const resellerCatalogRouter = Router();

resellerCatalogRouter.use(requireAuth, requireRole('reseller_admin', 'reseller_staff'), loadEntitlements);

resellerCatalogRouter.get('/', listCatalogHandler);
resellerCatalogRouter.patch(
  '/:id',
  requireEntitlement('canManageCatalog', 'Your plan does not allow customizing the catalog. Upgrade to Premium or Agency.'),
  validateBody(updateCatalogItemSchema),
  updateCatalogItemHandler
);
