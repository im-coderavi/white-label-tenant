import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { productsRouter } from '../../src/modules/products/products.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Product } from '../../src/models/Product';

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

describe('products module — sync-mode', () => {
  const app = buildTestApp();
  const masterToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });

  it('updates the sync mode', async () => {
    const product = await Product.create({ name: 'A', slug: 'a', type: 'software', basePrice: 10 });
    const res = await request(app)
      .patch(`/api/v1/admin/products/${product._id}/sync-mode`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ syncMode: 'exclusive' });
    expect(res.status).toBe(200);
    expect(res.body.product.syncMode).toBe('exclusive');
  });

  it('400s on an invalid sync mode', async () => {
    const product = await Product.create({ name: 'A', slug: 'a', type: 'software', basePrice: 10 });
    const res = await request(app)
      .patch(`/api/v1/admin/products/${product._id}/sync-mode`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ syncMode: 'not-a-mode' });
    expect(res.status).toBe(400);
  });
});
