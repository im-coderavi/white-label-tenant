import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import {
  listCategoriesHandler,
  createCategoryHandler,
  updateCategoryHandler,
  deleteCategoryHandler,
} from './categories.controller';

export const categoriesRouter = Router();

categoriesRouter.get('/', listCategoriesHandler);

categoriesRouter.post(
  '/',
  requireAuth,
  requireRole('master_admin', 'reseller_admin'),
  createCategoryHandler
);

categoriesRouter.patch(
  '/:id',
  requireAuth,
  requireRole('master_admin', 'reseller_admin'),
  updateCategoryHandler
);

categoriesRouter.delete(
  '/:id',
  requireAuth,
  requireRole('master_admin', 'reseller_admin'),
  deleteCategoryHandler
);
