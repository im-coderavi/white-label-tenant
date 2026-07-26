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

export async function refreshHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tokens = await authService.refresh(req.body.refreshToken);
    res.status(200).json(tokens);
  } catch (err) {
    next(err);
  }
}

export async function logoutHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.logout(req.body.refreshToken);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function forgotPasswordHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.forgotPassword(req.body);
    res.status(200).json({ message: 'If the account exists, a reset email has been sent' });
  } catch (err) {
    next(err);
  }
}

export async function resetPasswordHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.resetPassword(req.body);
    res.status(200).json({ message: 'Password reset successful' });
  } catch (err) {
    next(err);
  }
}

export async function verifyEmailHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.verifyEmail(req.body.token);
    res.status(200).json({ message: 'Email verified' });
  } catch (err) {
    next(err);
  }
}
