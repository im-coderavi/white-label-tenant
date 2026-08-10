import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import {
  createAccessCodeSchema,
  createCustomerSchema,
  updateCustomerSchema,
} from './resellerCustomers.validators';
import {
  createAccessCodeHandler,
  createCustomerHandler,
  listAccessCodesHandler,
  listCustomersHandler,
  revokeAccessCodeHandler,
  updateCustomerHandler,
} from './resellerCustomers.controller';

export const resellerCustomersRouter = Router();

resellerCustomersRouter.use(requireAuth, requireRole('reseller_admin', 'reseller_staff'));

resellerCustomersRouter.get('/customers', listCustomersHandler);
resellerCustomersRouter.post('/customers', validateBody(createCustomerSchema), createCustomerHandler);
resellerCustomersRouter.patch('/customers/:id', validateBody(updateCustomerSchema), updateCustomerHandler);
resellerCustomersRouter.post(
  '/customers/:id/access-codes',
  validateBody(createAccessCodeSchema),
  createAccessCodeHandler
);
resellerCustomersRouter.get('/access-codes', listAccessCodesHandler);
resellerCustomersRouter.patch('/access-codes/:id/revoke', revokeAccessCodeHandler);
