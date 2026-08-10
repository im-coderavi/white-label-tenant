import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { adminResellersRouter } from '../../src/modules/adminResellers/adminResellers.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Tenant } from '../../src/models/Tenant';
import { User } from '../../src/models/User';
import { Plan } from '../../src/models/Plan';
import { Product } from '../../src/models/Product';
import { Subscription } from '../../src/models/Subscription';
import { ResellerProduct } from '../../src/models/ResellerProduct';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin/resellers', adminResellersRouter);
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

describe('adminResellers module', () => {
  const app = buildTestApp();
  const adminToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });

  it('lists resellers and lets master admin suspend one', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-admin', status: 'active' });
    await User.create({
      tenantId: tenant._id,
      email: 'owner@acme.test',
      passwordHash: 'hash',
      role: 'reseller_admin',
      status: 'active',
    });

    const listRes = await request(app)
      .get('/api/v1/admin/resellers')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.resellers[0].adminEmail).toBe('owner@acme.test');

    const suspendRes = await request(app)
      .patch(`/api/v1/admin/resellers/${tenant._id}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(suspendRes.status).toBe(200);
    expect(suspendRes.body.reseller.status).toBe('suspended');

    const user = await User.findOne({ tenantId: tenant._id });
    expect(user?.status).toBe('suspended');
  });

  it('assigns a reseller plan, creating a new subscription and activating a pending tenant', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-plan-1', status: 'pending' });
    const plan = await Plan.create({
      scope: 'reseller',
      name: 'Premium',
      price: 1999,
      billingCycle: 'annual',
    });

    const res = await request(app)
      .patch(`/api/v1/admin/resellers/${tenant._id}/plan`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ planId: plan._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.reseller.planName).toBe('Premium');
    expect(res.body.reseller.subscriptionStatus).toBe('active');

    const tenantAfter = await Tenant.findById(tenant._id);
    expect(tenantAfter!.status).toBe('active');
    const subscription = await Subscription.findOne({ tenantId: tenant._id });
    expect(subscription!.currentPeriodEnd).not.toBeNull();
  });

  it('rejects assigning a customer-scope plan to a reseller', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-plan-2' });
    const customerPlan = await Plan.create({
      scope: 'customer',
      name: 'Basic',
      price: 99,
      billingCycle: 'monthly',
    });

    const res = await request(app)
      .patch(`/api/v1/admin/resellers/${tenant._id}/plan`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ planId: customerPlan._id.toString() });

    expect(res.status).toBe(404);
  });

  it('lists and sets a reseller product entitlement directly', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-ent-1' });
    const product = await Product.create({
      name: 'Direct Grant Tool',
      slug: 'direct-grant-tool',
      type: 'software',
      basePrice: 100,
      status: 'published',
      syncMode: 'optional',
    });

    const setRes = await request(app)
      .patch(`/api/v1/admin/resellers/${tenant._id}/entitlements`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId: product._id.toString(), enabled: true });

    expect(setRes.status).toBe(200);
    expect(setRes.body.entitlement.enabled).toBe(true);

    const listRes = await request(app)
      .get(`/api/v1/admin/resellers/${tenant._id}/entitlements`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.entitlements).toHaveLength(1);
    expect(listRes.body.entitlements[0].productName).toBe('Direct Grant Tool');

    const row = await ResellerProduct.findOne({ tenantId: tenant._id, productId: product._id });
    expect(row!.enabled).toBe(true);
  });

  it('rejects disabling a global product for an individual reseller', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-ent-2' });
    const product = await Product.create({
      name: 'Global Tool',
      slug: 'global-tool-ent',
      type: 'software',
      basePrice: 100,
      status: 'published',
      syncMode: 'global',
    });

    const res = await request(app)
      .patch(`/api/v1/admin/resellers/${tenant._id}/entitlements`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId: product._id.toString(), enabled: false });

    expect(res.status).toBe(409);
  });
});
