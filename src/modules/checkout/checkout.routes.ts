import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { createCheckoutSchema } from './checkout.validators';
import { createCheckoutHandler, webhookHandler } from './checkout.controller';

export const checkoutRouter = Router();

checkoutRouter.post(
  '/checkout',
  requireAuth,
  requireRole('customer'),
  validateBody(createCheckoutSchema),
  createCheckoutHandler
);
checkoutRouter.post('/checkout/webhook', webhookHandler);
