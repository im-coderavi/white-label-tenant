import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { adminLicensesRouter } from '../../src/modules/licenses/licenses.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Product } from '../../src/models/Product';
import { License } from '../../src/models/License';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin/licenses', adminLicensesRouter);
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

describe('licenses module — generate & list', () => {
  const app = buildTestApp();
  const masterToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });
  const customerToken = signAccessToken({ sub: 'cust-1', role: 'customer', tenantId: 'tenant-x' });

  it('rejects non-master_admin roles', async () => {
    const res = await request(app)
      .get('/api/v1/admin/licenses')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('bulk-generates unique license keys', async () => {
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    const res = await request(app)
      .post('/api/v1/admin/licenses/generate')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ productId: product._id.toString(), quantity: 5 });
    expect(res.status).toBe(201);
    expect(res.body.licenses).toHaveLength(5);
    const keys = res.body.licenses.map((l: { key: string }) => l.key);
    expect(new Set(keys).size).toBe(5);
    expect(res.body.licenses.every((l: { status: string }) => l.status === 'available')).toBe(true);
  });

  it('lists licenses with pagination and filters', async () => {
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    await License.create({ productId: product._id, key: 'TZP-2026-AAAAAAAA', status: 'available' });
    await License.create({ productId: product._id, key: 'TZP-2026-BBBBBBBB', status: 'revoked' });

    const res = await request(app)
      .get('/api/v1/admin/licenses?status=revoked')
      .set('Authorization', `Bearer ${masterToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].key).toBe('TZP-2026-BBBBBBBB');
    expect(res.body.total).toBe(1);
  });
});
