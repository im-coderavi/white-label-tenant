import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { resolveTenant } from '../../src/middleware/tenantResolution.middleware';
import { requireAuth, requireMatchingTenantHost } from '../../src/middleware/auth.middleware';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Tenant } from '../../src/models/Tenant';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(resolveTenant);
  app.get('/api/v1/whoami', requireAuth, requireMatchingTenantHost, (req, res) => {
    res.status(200).json({ resolvedTenantId: req.resolvedTenantId, jwtTenantId: req.user?.tenantId });
  });
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

describe('tenant resolution middleware', () => {
  const app = buildTestApp();

  it('resolves tenant by subdomain query param and exposes it on req', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme' });
    const token = signAccessToken({ sub: 'u1', role: 'customer', tenantId: tenant._id.toString() });

    const res = await request(app)
      .get('/api/v1/whoami?domain=acme.toolzypro.in')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.resolvedTenantId).toBe(tenant._id.toString());
  });

  it('resolves tenant by custom domain', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme2', customDomain: 'shop.acme.com' });
    const token = signAccessToken({ sub: 'u1', role: 'customer', tenantId: tenant._id.toString() });

    const res = await request(app)
      .get('/api/v1/whoami?domain=www.shop.acme.com')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.resolvedTenantId).toBe(tenant._id.toString());
  });

  it('rejects when JWT tenant does not match the resolved host tenant', async () => {
    const tenantA = await Tenant.create({ name: 'Acme', subdomain: 'acme3' });
    const tenantB = await Tenant.create({ name: 'Beta', subdomain: 'beta3' });
    const token = signAccessToken({ sub: 'u1', role: 'customer', tenantId: tenantA._id.toString() });

    const res = await request(app)
      .get(`/api/v1/whoami?domain=beta3.toolzypro.in`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    void tenantB;
  });

  it('allows master_admin through regardless of host tenant', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme4' });
    const token = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });

    const res = await request(app)
      .get('/api/v1/whoami?domain=acme4.toolzypro.in')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('passes through unresolved hosts without blocking the request', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme5' });
    const token = signAccessToken({ sub: 'u1', role: 'customer', tenantId: tenant._id.toString() });

    const res = await request(app)
      .get('/api/v1/whoami?domain=localhost')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.resolvedTenantId).toBeNull();
  });
});
