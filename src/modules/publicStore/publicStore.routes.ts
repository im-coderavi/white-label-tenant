import { Router } from 'express';
import { getStoreHandler } from './publicStore.controller';

export const publicStoreRouter = Router();

// Public on purpose: a visitor needs the store's identity before they can sign in.
publicStoreRouter.get('/store', getStoreHandler);
