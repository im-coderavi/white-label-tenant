import { Router } from 'express';
import { validateBody } from '../../middleware/validate.middleware';
import { authRateLimiter } from '../../middleware/rateLimit.middleware';
import { registerSchema, loginSchema, refreshSchema, logoutSchema } from './auth.validators';
import { registerHandler, loginHandler, refreshHandler, logoutHandler } from './auth.controller';

export const authRouter = Router();

authRouter.post('/register', authRateLimiter, validateBody(registerSchema), registerHandler);
authRouter.post('/login', authRateLimiter, validateBody(loginSchema), loginHandler);
authRouter.post('/refresh', validateBody(refreshSchema), refreshHandler);
authRouter.post('/logout', validateBody(logoutSchema), logoutHandler);
