import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { resellerAccountRouter } from '../../src/modules/resellerAccount/resellerAccount.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Tenant } from '../../src/models/Tenant';
import { Plan } from '../../src/models/Plan';
import { Subscription } from '../../src/models/Subscription';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/reseller', resellerAccountRouter);
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

async function seedActiveSubscription(subdomain: string, daysLeft: number) {
  const tenant = await Tenant.create({ name: 'Acme', subdomain, status: 'active' });
  const plan = await Plan.create({
    scope: 'reseller',
    name: 'Premium',
    price: 4999,
    billingCycle: 'annual',
  });
  const periodEnd = new Date(Date.now() + daysLeft * 24 * 60 * 60 * 1000);
  const subscription = await Subscription.create({
    tenantId: tenant._id,
    planId: plan._id,
    status: 'active',
    currentPeriodEnd: periodEnd,
    licenseKey: 'TZP-RS-2026-ABCD1234',
  });
  return { tenant, plan, subscription };
}

describe('resellerAccount module — subscription', () => {
  const app = buildTestApp();

  it('rejects non-reseller roles', async () => {
    const token = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });
    const res = await request(app)
      .get('/api/v1/reseller/subscription')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns the plan, licence key, and days remaining', async () => {
    const { tenant } = await seedActiveSubscription('acme-sub-1', 30);

    const token = signAccessToken({
      sub: 'reseller-1',
      role: 'reseller_admin',
      tenantId: tenant._id.toString(),
    });
    const res = await request(app)
      .get('/api/v1/reseller/subscription')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.subscription).toMatchObject({
      status: 'active',
      licenseKey: 'TZP-RS-2026-ABCD1234',
      plan: { name: 'Premium', price: 4999, billingCycle: 'annual' },
    });
    expect(res.body.subscription.daysRemaining).toBe(30);
  });

  it('reports no subscription rather than failing when the tenant has none', async () => {
    const tenant = await Tenant.create({ name: 'Bare', subdomain: 'bare-sub' });

    const token = signAccessToken({
      sub: 'reseller-2',
      role: 'reseller_admin',
      tenantId: tenant._id.toString(),
    });
    const res = await request(app)
      .get('/api/v1/reseller/subscription')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.subscription).toBeNull();
  });

  it('reports zero days remaining for a lapsed period rather than a negative number', async () => {
    const { tenant } = await seedActiveSubscription('acme-sub-2', -5);

    const token = signAccessToken({
      sub: 'reseller-3',
      role: 'reseller_admin',
      tenantId: tenant._id.toString(),
    });
    const res = await request(app)
      .get('/api/v1/reseller/subscription')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.subscription.daysRemaining).toBe(0);
  });
});
