import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { adminLicensesRouter } from '../../src/modules/licenses/licenses.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Product } from '../../src/models/Product';
import { License } from '../../src/models/License';
import { Tenant } from '../../src/models/Tenant';
import { User } from '../../src/models/User';

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

describe('licenses module — assign', () => {
  const app = buildTestApp();
  const masterToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });

  it('assigns an available license to a user and copies the tenantId', async () => {
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    const tenant = await Tenant.create({ name: 'A', subdomain: 'a' });
    const user = await User.create({
      tenantId: tenant._id,
      role: 'customer',
      email: 'buyer@example.com',
      passwordHash: 'x',
      status: 'active',
    });
    const license = await License.create({ productId: product._id, key: 'TZP-2026-ASSIGNME' });

    const res = await request(app)
      .post(`/api/v1/admin/licenses/${license._id}/assign`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ userId: user._id.toString() });
    expect(res.status).toBe(200);
    expect(res.body.license.status).toBe('assigned');
    expect(res.body.license.assignedUserId).toBe(user._id.toString());
    expect(res.body.license.tenantId).toBe(tenant._id.toString());
  });

  it('409s when the license is not available', async () => {
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    const tenant = await Tenant.create({ name: 'A', subdomain: 'a' });
    const user = await User.create({
      tenantId: tenant._id,
      role: 'customer',
      email: 'buyer@example.com',
      passwordHash: 'x',
      status: 'active',
    });
    const license = await License.create({
      productId: product._id,
      key: 'TZP-2026-TAKEN001',
      status: 'revoked',
    });

    const res = await request(app)
      .post(`/api/v1/admin/licenses/${license._id}/assign`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ userId: user._id.toString() });
    expect(res.status).toBe(409);
  });
});
