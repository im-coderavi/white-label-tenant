import express, { Express } from 'express';
import { authRouter } from './modules/auth/auth.routes';
import { tenantsRouter } from './modules/tenants/tenants.routes';
import { usersRouter } from './modules/users/users.routes';
import { productsRouter } from './modules/products/products.routes';
import { adminLicensesRouter } from './modules/licenses/licenses.routes';
import { customerLicensesRouter } from './modules/licenses/customer.routes';
import { errorMiddleware } from './middleware/error.middleware';

export function createApp(): Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/tenants', tenantsRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/admin/products', productsRouter);
  app.use('/api/v1/admin/licenses', adminLicensesRouter);
  app.use('/api/v1/customer/licenses', customerLicensesRouter);

  app.use(errorMiddleware);
  return app;
}
