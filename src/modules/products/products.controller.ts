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

export async function getProductHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await productsService.getProductById(req.params.id);
    res.status(200).json({ product });
  } catch (err) {
    next(err);
  }
}

export async function updateProductHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await productsService.updateProduct(req.params.id, req.body, req.file);
    res.status(200).json({ product });
  } catch (err) {
    next(err);
  }
}

export async function archiveProductHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await productsService.archiveProduct(req.params.id);
    res.status(200).json({ product });
  } catch (err) {
    next(err);
  }
}

export async function publishProductHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await productsService.publishProduct(req.params.id);
    res.status(200).json({ product });
  } catch (err) {
    next(err);
  }
}

export async function addVersionHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const version = await productsService.addVersion(req.params.id, req.body, req.file);
    res.status(201).json({ version });
  } catch (err) {
    next(err);
  }
}

export async function listVersionsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const versions = await productsService.listVersions(req.params.id);
    res.status(200).json({ versions });
  } catch (err) {
    next(err);
  }
}

export async function updateSyncModeHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await productsService.updateSyncMode(req.params.id, req.body.syncMode);
    res.status(200).json({ product });
  } catch (err) {
    next(err);
  }
}
