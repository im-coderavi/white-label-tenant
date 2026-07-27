import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { validateBody, validateQuery } from '../../middleware/validate.middleware';
import { upload } from '../../middleware/upload.middleware';
import {
  createProductSchema,
  listProductsQuerySchema,
  updateProductSchema,
  addVersionSchema,
  syncModeSchema,
} from './products.validators';
import {
  listProductsHandler,
  createProductHandler,
  getProductHandler,
  updateProductHandler,
  archiveProductHandler,
  publishProductHandler,
  addVersionHandler,
  listVersionsHandler,
  updateSyncModeHandler,
  forceSyncHandler,
  listResellersHandler,
} from './products.controller';

export const productsRouter = Router();

productsRouter.use(requireAuth, requireRole('master_admin'));

productsRouter.get('/', validateQuery(listProductsQuerySchema), listProductsHandler);
productsRouter.post('/', upload.single('thumbnail'), validateBody(createProductSchema), createProductHandler);
productsRouter.get('/:id', getProductHandler);
productsRouter.patch('/:id', upload.single('thumbnail'), validateBody(updateProductSchema), updateProductHandler);
productsRouter.delete('/:id', archiveProductHandler);
productsRouter.post('/:id/publish', publishProductHandler);
productsRouter.post(
  '/:id/versions',
  upload.single('file'),
  validateBody(addVersionSchema),
  addVersionHandler
);
productsRouter.get('/:id/versions', listVersionsHandler);
productsRouter.patch(
  '/:id/sync-mode',
  validateBody(syncModeSchema),
  updateSyncModeHandler
);
productsRouter.post('/:id/sync', forceSyncHandler);
productsRouter.get('/:id/resellers', listResellersHandler);
