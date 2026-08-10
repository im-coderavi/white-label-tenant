import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import {
  listStorefrontHandler,
  getStorefrontProductHandler,
  redeemCodeHandler,
  getStorePublicConfigHandler,
} from './storefront.controller';

export const storefrontRouter = Router();

// Public routes for domain resolution and code redemption
storefrontRouter.get('/public-config', getStorePublicConfigHandler);
storefrontRouter.post('/redeem-code', redeemCodeHandler);

// Customer catalog routes
storefrontRouter.get('/', requireAuth, requireRole('customer'), listStorefrontHandler);
storefrontRouter.get('/:id', requireAuth, requireRole('customer'), getStorefrontProductHandler);
