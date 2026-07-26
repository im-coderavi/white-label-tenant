import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';

export async function registerHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { user } = await authService.register(req.body);
    res.status(201).json({ user: { id: user._id, email: user.email, status: user.status } });
  } catch (err) {
    next(err);
  }
}

export async function loginHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { user, tokens } = await authService.login(req.body);
    res.status(200).json({
      user: { id: user._id, email: user.email, role: user.role, tenantId: user.tenantId },
      ...tokens,
    });
  } catch (err) {
    next(err);
  }
}
