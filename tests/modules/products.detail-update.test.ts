jest.mock('../../src/common/cloudinary', () => ({
  uploadBuffer: jest.fn().mockResolvedValue({
    secureUrl: 'https://res.cloudinary.com/mock2.png',
    publicId: 'toolzypro/mock2',
  }),
}));

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

describe('products module — get & update', () => {
  const app = buildTestApp();
  const masterToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });

  it('404s for an unknown product id', async () => {
    const res = await request(app)
      .get('/api/v1/admin/products/64b000000000000000000000')
      .set('Authorization', `Bearer ${masterToken}`);
    expect(res.status).toBe(404);
  });

  it('fetches and updates a product', async () => {
    const product = await Product.create({ name: 'A', slug: 'a', type: 'software', basePrice: 10 });

    const getRes = await request(app)
      .get(`/api/v1/admin/products/${product._id}`)
      .set('Authorization', `Bearer ${masterToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.product.name).toBe('A');

    const updateRes = await request(app)
      .patch(`/api/v1/admin/products/${product._id}`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ basePrice: 25 });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.product.basePrice).toBe(25);
  });
});
