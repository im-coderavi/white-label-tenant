import express, { Express } from 'express';
import path from 'path';
import { authRouter } from './modules/auth/auth.routes';
import { tenantsRouter } from './modules/tenants/tenants.routes';
import { usersRouter } from './modules/users/users.routes';
import { productsRouter } from './modules/products/products.routes';
import { adminLicensesRouter } from './modules/licenses/licenses.routes';
import { customerLicensesRouter } from './modules/licenses/customer.routes';
import { resellerLicensesRouter } from './modules/licenses/reseller.routes';
import { checkoutRouter } from './modules/checkout/checkout.routes';
import { plansRouter } from './modules/plans/plans.routes';
import { publicPlansRouter } from './modules/plans/public.routes';
import { resellerSignupRouter } from './modules/resellerSignup/resellerSignup.routes';
import { resellerCatalogRouter } from './modules/resellerCatalog/resellerCatalog.routes';
import { storefrontRouter } from './modules/storefront/storefront.routes';
import { resellerAccountRouter } from './modules/resellerAccount/resellerAccount.routes';
import { adminStatsRouter } from './modules/adminStats/adminStats.routes';
import { resellerCustomersRouter } from './modules/resellerCustomers/resellerCustomers.routes';
import { resellerSettingsRouter } from './modules/resellerSettings/resellerSettings.routes';
import { adminResellersRouter } from './modules/adminResellers/adminResellers.routes';
import { categoriesRouter } from './modules/categories/categories.routes';
import { tutorialsRouter } from './modules/tutorials/tutorials.routes';
import { grantAccessRouter } from './modules/grantAccess/grantAccess.routes';
import { marketplaceRouter } from './modules/marketplace/marketplace.routes';
import { ownProductsRouter } from './modules/ownProducts/ownProducts.routes';
import { errorMiddleware } from './middleware/error.middleware';
import { resolveTenant } from './middleware/tenantResolution.middleware';

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

  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

  app.use(resolveTenant);

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
  app.use('/api/v1/reseller', resellerCustomersRouter);
  app.use('/api/v1/reseller', resellerSettingsRouter);
  app.use('/api/v1/reseller', resellerAccountRouter);
  app.use('/api/v1/admin/stats', adminStatsRouter);
  app.use('/api/v1/admin/resellers', adminResellersRouter);
  app.use('/api/v1/categories', categoriesRouter);
  app.use('/api/v1/tutorials', tutorialsRouter);
  app.use('/api/v1/reseller/grant-access', grantAccessRouter);
  app.use('/api/v1/reseller/marketplace', marketplaceRouter);
  app.use('/api/v1/reseller/own-products', ownProductsRouter);
  app.use('/api/v1/reseller/licenses', resellerLicensesRouter);

  app.use(errorMiddleware);
  return app;
}
