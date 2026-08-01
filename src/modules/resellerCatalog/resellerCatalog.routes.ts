import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { updateCatalogItemSchema } from './resellerCatalog.validators';
import { listCatalogHandler, updateCatalogItemHandler } from './resellerCatalog.controller';

export const resellerCatalogRouter = Router();

resellerCatalogRouter.use(requireAuth, requireRole('reseller_admin', 'reseller_staff'));

resellerCatalogRouter.get('/', listCatalogHandler);
resellerCatalogRouter.patch('/:id', validateBody(updateCatalogItemSchema), updateCatalogItemHandler);
