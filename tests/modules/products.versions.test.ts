jest.mock('../../src/common/cloudinary', () => ({
  uploadBuffer: jest.fn().mockResolvedValue({
    secureUrl: 'https://res.cloudinary.com/mockfile.zip',
    publicId: 'toolzypro/mockfile',
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

describe('products module — versions', () => {
  const app = buildTestApp();
  const masterToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });

  it('adds a version and updates the product currentVersion/changelogJson', async () => {
    const product = await Product.create({ name: 'A', slug: 'a', type: 'software', basePrice: 10 });

    const res = await request(app)
      .post(`/api/v1/admin/products/${product._id}/versions`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ version: '1.0.0', changelog: 'Initial release' });
    expect(res.status).toBe(201);

    const updated = await Product.findById(product._id);
    expect(updated!.currentVersion).toBe('1.0.0');
    expect(updated!.changelogJson).toEqual({ version: '1.0.0', changelog: 'Initial release' });
  });

  it('lists versions newest first', async () => {
    const product = await Product.create({ name: 'A', slug: 'a', type: 'software', basePrice: 10 });
    await request(app)
      .post(`/api/v1/admin/products/${product._id}/versions`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ version: '1.0.0', changelog: 'First' });
    await request(app)
      .post(`/api/v1/admin/products/${product._id}/versions`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ version: '1.1.0', changelog: 'Second' });

    const res = await request(app)
      .get(`/api/v1/admin/products/${product._id}/versions`)
      .set('Authorization', `Bearer ${masterToken}`);
    expect(res.status).toBe(200);
    expect(res.body.versions).toHaveLength(2);
    expect(res.body.versions[0].version).toBe('1.1.0');
  });

  it('404s when adding a version to an unknown product', async () => {
    const res = await request(app)
      .post('/api/v1/admin/products/64b000000000000000000000/versions')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ version: '1.0.0' });
    expect(res.status).toBe(404);
  });
});
