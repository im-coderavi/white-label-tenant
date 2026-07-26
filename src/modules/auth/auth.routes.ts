import { Router } from 'express';
import { validateBody } from '../../middleware/validate.middleware';
import { authRateLimiter } from '../../middleware/rateLimit.middleware';
import { registerSchema } from './auth.validators';
import { registerHandler } from './auth.controller';

export const authRouter = Router();

authRouter.post('/register', authRateLimiter, validateBody(registerSchema), registerHandler);
