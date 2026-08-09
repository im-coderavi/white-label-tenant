import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { loadEntitlements, requireEntitlement } from '../../middleware/entitlements.middleware';
import { redeemLicenseKeySchema, marketplaceCheckoutSchema } from './marketplace.validators';
import {
  listMarketplaceHandler,
  redeemLicenseKeyHandler,
  createMarketplaceCheckoutHandler,
  confirmMarketplacePurchaseHandler,
  marketplaceWebhookHandler,
} from './marketplace.controller';

export const marketplaceRouter = Router();

marketplaceRouter.post('/webhook', marketplaceWebhookHandler);

marketplaceRouter.use(requireAuth, requireRole('reseller_admin', 'reseller_staff'), loadEntitlements);
marketplaceRouter.get('/', listMarketplaceHandler);
marketplaceRouter.post(
  '/redeem',
  requireEntitlement('canBuyFromMarketplace'),
  validateBody(redeemLicenseKeySchema),
  redeemLicenseKeyHandler
);
marketplaceRouter.post(
  '/checkout',
  requireEntitlement('canBuyFromMarketplace'),
  validateBody(marketplaceCheckoutSchema),
  createMarketplaceCheckoutHandler
);
marketplaceRouter.post('/orders/:id/confirm-payment', confirmMarketplacePurchaseHandler);
