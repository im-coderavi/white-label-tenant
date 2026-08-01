import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { createCheckoutSchema } from './checkout.validators';
import {
  createCheckoutHandler,
  webhookHandler,
  listOrdersHandler,
  generateDownloadTokenHandler,
  confirmPaymentHandler,
} from './checkout.controller';

export const checkoutRouter = Router();

checkoutRouter.post(
  '/checkout',
  requireAuth,
  requireRole('customer'),
  validateBody(createCheckoutSchema),
  createCheckoutHandler
);
checkoutRouter.post('/checkout/webhook', webhookHandler);
checkoutRouter.get('/orders', requireAuth, requireRole('customer'), listOrdersHandler);
checkoutRouter.post(
  '/orders/:id/confirm-payment',
  requireAuth,
  requireRole('customer'),
  confirmPaymentHandler
);
checkoutRouter.get(
  '/downloads/:orderId',
  requireAuth,
  requireRole('customer'),
  generateDownloadTokenHandler
);
