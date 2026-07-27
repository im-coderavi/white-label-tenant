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

describe('licenses module — revoke', () => {
  const app = buildTestApp();
  const masterToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });

  it('revokes a license regardless of current status', async () => {
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    const license = await License.create({ productId: product._id, key: 'TZP-2026-REVOKEME', status: 'assigned' });

    const res = await request(app)
      .patch(`/api/v1/admin/licenses/${license._id}/revoke`)
      .set('Authorization', `Bearer ${masterToken}`);
    expect(res.status).toBe(200);
    expect(res.body.license.status).toBe('revoked');
  });

  it('404s for an unknown license', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/licenses/64b000000000000000000000/revoke')
      .set('Authorization', `Bearer ${masterToken}`);
    expect(res.status).toBe(404);
  });
});
