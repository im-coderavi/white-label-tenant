import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { tenantsRouter } from '../../src/modules/tenants/tenants.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Tenant } from '../../src/models/Tenant';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/tenants', tenantsRouter);
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

describe('tenants module — list', () => {
  const app = buildTestApp();
  const masterToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });
  const customerToken = signAccessToken({ sub: 'cust-1', role: 'customer', tenantId: 'tenant-x' });

  it('rejects non-master_admin roles', async () => {
    const res = await request(app)
      .get('/api/v1/tenants')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('lists all tenants', async () => {
    await Tenant.create({ name: 'A', subdomain: 'a' });
    await Tenant.create({ name: 'B', subdomain: 'b' });

    const res = await request(app)
      .get('/api/v1/tenants')
      .set('Authorization', `Bearer ${masterToken}`);
    expect(res.status).toBe(200);
    expect(res.body.tenants).toHaveLength(2);
  });
});
