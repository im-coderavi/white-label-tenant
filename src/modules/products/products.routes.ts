import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { validateBody, validateQuery } from '../../middleware/validate.middleware';
import { upload } from '../../middleware/upload.middleware';
import { createProductSchema, listProductsQuerySchema } from './products.validators';
import { listProductsHandler, createProductHandler } from './products.controller';

export const productsRouter = Router();

productsRouter.use(requireAuth, requireRole('master_admin'));

productsRouter.get('/', validateQuery(listProductsQuerySchema), listProductsHandler);
productsRouter.post('/', upload.single('thumbnail'), validateBody(createProductSchema), createProductHandler);
