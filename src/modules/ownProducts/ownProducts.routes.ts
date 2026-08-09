import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { loadEntitlements, requireEntitlement } from '../../middleware/entitlements.middleware';
import { createOwnProductSchema, updateOwnProductSchema } from './ownProducts.validators';
import {
  listOwnProductsHandler,
  createOwnProductHandler,
  updateOwnProductHandler,
  deleteOwnProductHandler,
} from './ownProducts.controller';

export const ownProductsRouter = Router();

ownProductsRouter.use(requireAuth, requireRole('reseller_admin', 'reseller_staff'), loadEntitlements);

ownProductsRouter.get('/', listOwnProductsHandler);
ownProductsRouter.post(
  '/',
  requireEntitlement('canAddOwnProducts', 'Your plan does not allow adding your own products.'),
  validateBody(createOwnProductSchema),
  createOwnProductHandler
);
ownProductsRouter.patch(
  '/:id',
  requireEntitlement('canAddOwnProducts', 'Your plan does not allow managing your own products.'),
  validateBody(updateOwnProductSchema),
  updateOwnProductHandler
);
ownProductsRouter.delete(
  '/:id',
  requireEntitlement('canAddOwnProducts', 'Your plan does not allow managing your own products.'),
  deleteOwnProductHandler
);
