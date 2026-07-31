import { Router } from 'express';
import { validateBody } from '../../middleware/validate.middleware';
import { registerResellerSchema } from './resellerSignup.validators';
import { registerResellerHandler, webhookHandler } from './resellerSignup.controller';

export const resellerSignupRouter = Router();

resellerSignupRouter.post(
  '/register-reseller',
  validateBody(registerResellerSchema),
  registerResellerHandler
);
resellerSignupRouter.post('/register-reseller/webhook', webhookHandler);
