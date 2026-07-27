import { Request, Response, NextFunction } from 'express';
import * as productsService from './products.service';

export async function listProductsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await productsService.listProducts(
      req.query as unknown as productsService.ListProductsQuery
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function createProductHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await productsService.createProduct(req.body, req.file);
    res.status(201).json({ product });
  } catch (err) {
    next(err);
  }
}
