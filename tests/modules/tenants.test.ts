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

describe('tenants module', () => {
  const app = buildTestApp();
  const masterToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });
  const customerToken = signAccessToken({ sub: 'cust-1', role: 'customer', tenantId: 'tenant-x' });

  it('rejects tenant creation from a non-master_admin role', async () => {
    const res = await request(app)
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'Acme', subdomain: 'acme' });
    expect(res.status).toBe(403);
  });

  it('creates a tenant as master_admin and fetches it by id', async () => {
    const createRes = await request(app)
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'Acme', subdomain: 'acme' });
    expect(createRes.status).toBe(201);
    expect(createRes.body.tenant.subdomain).toBe('acme');

    const getRes = await request(app)
      .get(`/api/v1/tenants/${createRes.body.tenant._id}`)
      .set('Authorization', `Bearer ${masterToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.tenant.name).toBe('Acme');
  });

  it('rejects a duplicate subdomain with 409', async () => {
    await Tenant.create({ name: 'Existing', subdomain: 'dup' });
    const res = await request(app)
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'New', subdomain: 'dup' });
    expect(res.status).toBe(409);
  });
});
