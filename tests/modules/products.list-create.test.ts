jest.mock('../../src/common/cloudinary', () => ({
  uploadBuffer: jest.fn().mockResolvedValue({
    secureUrl: 'https://res.cloudinary.com/mock.png',
    publicId: 'toolzypro/mock',
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

describe('products module — list & create', () => {
  const app = buildTestApp();
  const masterToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });
  const customerToken = signAccessToken({ sub: 'cust-1', role: 'customer', tenantId: 'tenant-x' });

  it('rejects non-master_admin roles', async () => {
    const res = await request(app)
      .get('/api/v1/admin/products')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('creates a product in draft status with a generated slug', async () => {
    const res = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'Super Tool', type: 'software', basePrice: 999 });
    expect(res.status).toBe(201);
    expect(res.body.product.slug).toBe('super-tool');
    expect(res.body.product.status).toBe('draft');
  });

  it('generates a unique slug on name collision', async () => {
    await Product.create({ name: 'Super Tool', slug: 'super-tool', type: 'software', basePrice: 1 });
    const res = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'Super Tool', type: 'software', basePrice: 999 });
    expect(res.status).toBe(201);
    expect(res.body.product.slug).toBe('super-tool-2');
  });

  it('lists products with pagination and filters', async () => {
    await Product.create({ name: 'Alpha', slug: 'alpha', type: 'software', basePrice: 10, status: 'draft' });
    await Product.create({ name: 'Beta', slug: 'beta', type: 'theme', basePrice: 20, status: 'published' });

    const res = await request(app)
      .get('/api/v1/admin/products?type=theme')
      .set('Authorization', `Bearer ${masterToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].name).toBe('Beta');
    expect(res.body.total).toBe(1);
  });

  it('400s on an invalid body', async () => {
    const res = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: '', type: 'not-a-real-type', basePrice: -5 });
    expect(res.status).toBe(400);
  });
});
