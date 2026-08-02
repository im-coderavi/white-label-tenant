import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { listStorefrontHandler, getStorefrontProductHandler } from './storefront.controller';

export const storefrontRouter = Router();

storefrontRouter.use(requireAuth, requireRole('customer'));
storefrontRouter.get('/', listStorefrontHandler);
storefrontRouter.get('/:id', getStorefrontProductHandler);
