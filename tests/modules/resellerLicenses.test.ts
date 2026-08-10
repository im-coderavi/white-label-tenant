import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { resellerLicensesRouter } from '../../src/modules/licenses/reseller.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Tenant } from '../../src/models/Tenant';
import { Product } from '../../src/models/Product';
import { License } from '../../src/models/License';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/reseller/licenses', resellerLicensesRouter);
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

describe('reseller licenses module', () => {
  const app = buildTestApp();

  it('lists only licenses bound to the caller tenant', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-lic-1' });
    const otherTenant = await Tenant.create({ name: 'Other', subdomain: 'other-lic-1' });
    const product = await Product.create({
      name: 'Licensed Tool',
      slug: 'licensed-tool',
      type: 'software',
      basePrice: 100,
      status: 'published',
    });
    await License.create({ productId: product._id, key: 'TZP-2026-MINE0001', status: 'assigned', tenantId: tenant._id });
    await License.create({ productId: product._id, key: 'TZP-2026-THEIRS001', status: 'assigned', tenantId: otherTenant._id });

    const token = signAccessToken({ sub: 'r1', role: 'reseller_admin', tenantId: tenant._id.toString() });
    const res = await request(app).get('/api/v1/reseller/licenses').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].key).toBe('TZP-2026-MINE0001');
  });

  it('ignores a client-supplied tenantId query param and always scopes to the caller', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-lic-2' });
    const otherTenant = await Tenant.create({ name: 'Other', subdomain: 'other-lic-2' });
    const product = await Product.create({
      name: 'Licensed Tool 2',
      slug: 'licensed-tool-2',
      type: 'software',
      basePrice: 100,
      status: 'published',
    });
    await License.create({ productId: product._id, key: 'TZP-2026-THEIRS002', status: 'assigned', tenantId: otherTenant._id });

    const token = signAccessToken({ sub: 'r1', role: 'reseller_admin', tenantId: tenant._id.toString() });
    const res = await request(app)
      .get(`/api/v1/reseller/licenses?tenantId=${otherTenant._id.toString()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/v1/reseller/licenses');
    expect(res.status).toBe(401);
  });
});
