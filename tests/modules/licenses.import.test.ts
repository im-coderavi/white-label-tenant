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

describe('licenses module — import', () => {
  const app = buildTestApp();
  const masterToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });

  it('imports externally-supplied keys', async () => {
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    const res = await request(app)
      .post('/api/v1/admin/licenses/import')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ productId: product._id.toString(), keys: ['TZP-2026-EXT00001', 'TZP-2026-EXT00002'] });
    expect(res.status).toBe(201);
    expect(res.body.licenses).toHaveLength(2);
  });

  it('409s if a supplied key already exists', async () => {
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    await License.create({ productId: product._id, key: 'TZP-2026-EXISTING' });

    const res = await request(app)
      .post('/api/v1/admin/licenses/import')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ productId: product._id.toString(), keys: ['TZP-2026-EXISTING'] });
    expect(res.status).toBe(409);
  });
});
