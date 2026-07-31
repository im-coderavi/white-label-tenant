import { Router } from 'express';
import { listActiveResellerPlansHandler } from './plans.controller';

export const publicPlansRouter = Router();

publicPlansRouter.get('/plans', listActiveResellerPlansHandler);
