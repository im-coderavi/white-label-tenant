import { Request, Response, NextFunction } from 'express';
import * as resellerSignupService from './resellerSignup.service';

export async function registerResellerHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await resellerSignupService.registerReseller(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}
