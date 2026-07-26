import { Router } from 'express';
import { validateBody } from '../../middleware/validate.middleware';
import { authRateLimiter } from '../../middleware/rateLimit.middleware';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from './auth.validators';
import {
  registerHandler,
  loginHandler,
  refreshHandler,
  logoutHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  verifyEmailHandler,
} from './auth.controller';

export const authRouter = Router();

authRouter.post('/register', authRateLimiter, validateBody(registerSchema), registerHandler);
authRouter.post('/login', authRateLimiter, validateBody(loginSchema), loginHandler);
authRouter.post('/refresh', validateBody(refreshSchema), refreshHandler);
authRouter.post('/logout', validateBody(logoutSchema), logoutHandler);
authRouter.post(
  '/forgot-password',
  authRateLimiter,
  validateBody(forgotPasswordSchema),
  forgotPasswordHandler
);
authRouter.post('/reset-password', validateBody(resetPasswordSchema), resetPasswordHandler);
authRouter.post('/verify-email', validateBody(verifyEmailSchema), verifyEmailHandler);
