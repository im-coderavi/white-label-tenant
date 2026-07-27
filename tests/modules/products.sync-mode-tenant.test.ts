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

describe('products module — sync-mode tenant assignment', () => {
  const app = buildTestApp();
  const masterToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });

  it('400s when switching to private without a tenantId', async () => {
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    const res = await request(app)
      .patch(`/api/v1/admin/products/${product._id}/sync-mode`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ syncMode: 'private' });
    expect(res.status).toBe(400);
  });

  it('assigns to a tenant and propagates entitlement', async () => {
    const tenant = await Tenant.create({ name: 'A', subdomain: 'a' });
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });

    const res = await request(app)
      .patch(`/api/v1/admin/products/${product._id}/sync-mode`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ syncMode: 'private', tenantId: tenant._id.toString() });
    expect(res.status).toBe(200);
    expect(res.body.product.syncMode).toBe('private');

    const row = await ResellerProduct.findOne({ tenantId: tenant._id, productId: product._id });
    expect(row).not.toBeNull();
    expect(row!.enabled).toBe(true);
  });
});
