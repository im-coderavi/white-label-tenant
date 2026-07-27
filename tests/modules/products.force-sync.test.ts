import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { productsRouter } from '../../src/modules/products/products.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Product } from '../../src/models/Product';
import { Tenant } from '../../src/models/Tenant';
import { ResellerProduct } from '../../src/models/ResellerProduct';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin/products', productsRouter);
  app.use(errorMiddleware);
  return app;
}

beforeAll(async () => {
  const uri = await startTestDb();
  await mongoose.connect(uri);
});

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await stopTestDb();
});

describe('products module — force sync', () => {
  const app = buildTestApp();
  const masterToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });

  it('re-derives reseller_products for a global product with no existing rows', async () => {
    const tenant = await Tenant.create({ name: 'A', subdomain: 'a' });
    const product = await Product.create({
      name: 'P',
      slug: 'p',
      type: 'software',
      basePrice: 10,
      syncMode: 'global',
    });
    // No ResellerProduct row exists yet — simulates drift (e.g. a tenant added before this feature).

    const res = await request(app)
      .post(`/api/v1/admin/products/${product._id}/sync`)
      .set('Authorization', `Bearer ${masterToken}`);
    expect(res.status).toBe(200);

    const row = await ResellerProduct.findOne({ tenantId: tenant._id, productId: product._id });
    expect(row).not.toBeNull();
    expect(row!.enabled).toBe(true);
  });

  it('404s for an unknown product', async () => {
    const res = await request(app)
      .post('/api/v1/admin/products/64b000000000000000000000/sync')
      .set('Authorization', `Bearer ${masterToken}`);
    expect(res.status).toBe(404);
  });
});
