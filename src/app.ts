import express, { Express } from 'express';
import { authRouter } from './modules/auth/auth.routes';
import { tenantsRouter } from './modules/tenants/tenants.routes';
import { usersRouter } from './modules/users/users.routes';
import { productsRouter } from './modules/products/products.routes';
import { adminLicensesRouter } from './modules/licenses/licenses.routes';
import { customerLicensesRouter } from './modules/licenses/customer.routes';
import { checkoutRouter } from './modules/checkout/checkout.routes';
import { plansRouter } from './modules/plans/plans.routes';
import { publicPlansRouter } from './modules/plans/public.routes';
import { resellerSignupRouter } from './modules/resellerSignup/resellerSignup.routes';
import { resellerCatalogRouter } from './modules/resellerCatalog/resellerCatalog.routes';
import { storefrontRouter } from './modules/storefront/storefront.routes';
import { resellerAccountRouter } from './modules/resellerAccount/resellerAccount.routes';
import { adminStatsRouter } from './modules/adminStats/adminStats.routes';
import { errorMiddleware } from './middleware/error.middleware';

export function createApp(): Express {
  const app = express();
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as express.Request).rawBody = buf;
      },
    })
  );

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/tenants', tenantsRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/admin/products', productsRouter);
  app.use('/api/v1/admin/licenses', adminLicensesRouter);
  app.use('/api/v1/customer/licenses', customerLicensesRouter);
  app.use('/api/v1/customer', checkoutRouter);
  app.use('/api/v1/admin/plans', plansRouter);
  app.use('/api/v1', publicPlansRouter);
  app.use('/api/v1/auth', resellerSignupRouter);
  app.use('/api/v1/reseller/products', resellerCatalogRouter);
  app.use('/api/v1/customer/products', storefrontRouter);
  // Mounted after the catalog router so /reseller/products keeps resolving there.
  app.use('/api/v1/reseller', resellerAccountRouter);
  app.use('/api/v1/admin/stats', adminStatsRouter);

  app.use(errorMiddleware);
  return app;
}
