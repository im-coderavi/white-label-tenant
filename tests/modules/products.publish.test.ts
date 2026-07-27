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

describe('products module — publish', () => {
  const app = buildTestApp();
  const masterToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });

  it('409s when publishing a product with no version', async () => {
    const product = await Product.create({ name: 'A', slug: 'a', type: 'software', basePrice: 10 });
    const res = await request(app)
      .post(`/api/v1/admin/products/${product._id}/publish`)
      .set('Authorization', `Bearer ${masterToken}`);
    expect(res.status).toBe(409);
  });

  it('publishes a product that has a version', async () => {
    const product = await Product.create({
      name: 'A',
      slug: 'a',
      type: 'software',
      basePrice: 10,
      currentVersion: '1.0.0',
    });
    const res = await request(app)
      .post(`/api/v1/admin/products/${product._id}/publish`)
      .set('Authorization', `Bearer ${masterToken}`);
    expect(res.status).toBe(200);
    expect(res.body.product.status).toBe('published');
  });
});
