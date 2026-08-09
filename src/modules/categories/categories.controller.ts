import { Request, Response, NextFunction } from 'express';
import * as categoriesService from './categories.service';

export async function listCategoriesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.user?.role === 'master_admin' ? null : (req.user?.tenantId ?? null);
    const categories = await categoriesService.listCategories(tenantId);
    res.status(200).json({ categories });
  } catch (err) {
    next(err);
  }
}

export async function createCategoryHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.user?.role === 'master_admin' ? null : (req.user?.tenantId ?? null);
    const category = await categoriesService.createCategory(tenantId, req.body);
    res.status(201).json({ category });
  } catch (err) {
    next(err);
  }
}

export async function updateCategoryHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.user?.role === 'master_admin' ? null : (req.user?.tenantId ?? null);
    const category = await categoriesService.updateCategory(req.params.id, tenantId, req.body);
    res.status(200).json({ category });
  } catch (err) {
    next(err);
  }
}

export async function deleteCategoryHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.user?.role === 'master_admin' ? null : (req.user?.tenantId ?? null);
    await categoriesService.deleteCategory(req.params.id, tenantId);
    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (err) {
    next(err);
  }
}
