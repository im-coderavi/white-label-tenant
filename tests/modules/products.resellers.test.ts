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

describe('products module — list entitled resellers', () => {
  const app = buildTestApp();
  const masterToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });

  it('lists only tenants with an enabled entitlement', async () => {
    const tenantA = await Tenant.create({ name: 'A', subdomain: 'a' });
    const tenantB = await Tenant.create({ name: 'B', subdomain: 'b' });
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    await ResellerProduct.create({ tenantId: tenantA._id, productId: product._id, enabled: true });
    await ResellerProduct.create({ tenantId: tenantB._id, productId: product._id, enabled: false });

    const res = await request(app)
      .get(`/api/v1/admin/products/${product._id}/resellers`)
      .set('Authorization', `Bearer ${masterToken}`);
    expect(res.status).toBe(200);
    expect(res.body.tenants).toHaveLength(1);
    expect(res.body.tenants[0].subdomain).toBe('a');
  });

  it('404s for an unknown product', async () => {
    const res = await request(app)
      .get('/api/v1/admin/products/64b000000000000000000000/resellers')
      .set('Authorization', `Bearer ${masterToken}`);
    expect(res.status).toBe(404);
  });
});
