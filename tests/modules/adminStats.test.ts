import mongoose, { Types } from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { adminStatsRouter } from '../../src/modules/adminStats/adminStats.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Tenant } from '../../src/models/Tenant';
import { Product } from '../../src/models/Product';
import { Order } from '../../src/models/Order';
import { Plan } from '../../src/models/Plan';
import { Subscription } from '../../src/models/Subscription';
import { License } from '../../src/models/License';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin/stats', adminStatsRouter);
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

describe('adminStats module', () => {
  const app = buildTestApp();

  it('rejects non-master_admin roles', async () => {
    const token = signAccessToken({ sub: 'r-1', role: 'reseller_admin', tenantId: 'tenant-x' });
    const res = await request(app).get('/api/v1/admin/stats').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('reports platform-wide totals across every tenant', async () => {
    const tenantA = await Tenant.create({ name: 'A', subdomain: 'a-stats', status: 'active' });
    const tenantB = await Tenant.create({ name: 'B', subdomain: 'b-stats', status: 'pending' });

    const published = await Product.create({
      name: 'P',
      slug: 'p-stats',
      type: 'software',
      basePrice: 100,
      status: 'published',
    });
    await Product.create({
      name: 'D',
      slug: 'd-stats',
      type: 'software',
      basePrice: 50,
      status: 'draft',
    });

    const plan = await Plan.create({
      scope: 'reseller',
      name: 'Premium',
      price: 4999,
      billingCycle: 'annual',
    });
    await Subscription.create({ tenantId: tenantA._id, planId: plan._id, status: 'active' });
    await Subscription.create({ tenantId: tenantB._id, planId: plan._id, status: 'pending' });

    const buyer = new Types.ObjectId();
    await Order.create({
      tenantId: tenantA._id,
      customerUserId: buyer,
      productId: published._id,
      orderType: 'single_product',
      amount: 100,
      status: 'paid',
    });
    await Order.create({
      tenantId: tenantB._id,
      customerUserId: buyer,
      productId: published._id,
      orderType: 'single_product',
      amount: 250,
      status: 'paid',
    });
    await Order.create({
      tenantId: tenantA._id,
      customerUserId: buyer,
      productId: published._id,
      orderType: 'single_product',
      amount: 999,
      status: 'failed',
    });

    await License.create({ productId: published._id, key: 'TZP-2026-ASSIGNED', status: 'assigned' });
    await License.create({ productId: published._id, key: 'TZP-2026-FREE0001', status: 'available' });

    const token = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });
    const res = await request(app).get('/api/v1/admin/stats').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.stats).toEqual({
      tenantsTotal: 2,
      tenantsActive: 1,
      productsTotal: 2,
      productsPublished: 1,
      subscriptionsActive: 1,
      ordersPaid: 2,
      revenue: 350,
      licensesIssued: 1,
    });
  });
});
