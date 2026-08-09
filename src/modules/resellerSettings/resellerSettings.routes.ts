import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { loadEntitlements, requireEntitlement } from '../../middleware/entitlements.middleware';
import {
  updateBrandingSchema,
  updatePaymentGatewaySchema,
  updateSmtpConfigSchema,
  sendTestEmailSchema,
} from './resellerSettings.validators';
import {
  getStoreSettingsHandler,
  updateStoreSettingsHandler,
  verifyDomainDnsHandler,
  updatePaymentGatewayHandler,
  updateSmtpConfigHandler,
  sendTestEmailHandler,
} from './resellerSettings.controller';

export const resellerSettingsRouter = Router();

resellerSettingsRouter.use(requireAuth, requireRole('reseller_admin', 'reseller_staff'), loadEntitlements);

resellerSettingsRouter.get('/branding', getStoreSettingsHandler);
resellerSettingsRouter.patch('/branding', validateBody(updateBrandingSchema), updateStoreSettingsHandler);
resellerSettingsRouter.get('/settings', getStoreSettingsHandler);
resellerSettingsRouter.patch('/settings', validateBody(updateBrandingSchema), updateStoreSettingsHandler);
resellerSettingsRouter.post('/verify-domain', requireEntitlement('canUseCustomDomain'), verifyDomainDnsHandler);
resellerSettingsRouter.patch(
  '/payment-gateway',
  requireEntitlement('canConfigurePaymentGateway'),
  validateBody(updatePaymentGatewaySchema),
  updatePaymentGatewayHandler
);
resellerSettingsRouter.patch(
  '/smtp',
  requireEntitlement('canConfigureSmtp'),
  validateBody(updateSmtpConfigSchema),
  updateSmtpConfigHandler
);
resellerSettingsRouter.post('/smtp/test', requireEntitlement('canConfigureSmtp'), validateBody(sendTestEmailSchema), sendTestEmailHandler);
