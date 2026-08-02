import mongoose, { Types } from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { resellerAccountRouter } from '../../src/modules/resellerAccount/resellerAccount.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Tenant } from '../../src/models/Tenant';
import { Product } from '../../src/models/Product';
import { ResellerProduct } from '../../src/models/ResellerProduct';
import { Order } from '../../src/models/Order';
import { User } from '../../src/models/User';

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

describe('resellerAccount module — stats', () => {
  const app = buildTestApp();

  it('counts only this tenant catalog, orders, and paid revenue', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-stats' });
    const other = await Tenant.create({ name: 'Other', subdomain: 'other-stats' });
    const productA = await Product.create({ name: 'A', slug: 'a', type: 'software', basePrice: 100 });
    const productB = await Product.create({ name: 'B', slug: 'b', type: 'software', basePrice: 200 });

    await ResellerProduct.create({ tenantId: tenant._id, productId: productA._id, enabled: true });
    await ResellerProduct.create({ tenantId: tenant._id, productId: productB._id, enabled: false });
    await ResellerProduct.create({ tenantId: other._id, productId: productA._id, enabled: true });

    const buyer = new Types.ObjectId();
    await Order.create({
      tenantId: tenant._id,
      customerUserId: buyer,
      productId: productA._id,
      orderType: 'single_product',
      amount: 100,
      status: 'paid',
    });
    await Order.create({
      tenantId: tenant._id,
      customerUserId: buyer,
      productId: productB._id,
      orderType: 'single_product',
      amount: 200,
      status: 'paid',
    });
    // Pending must not count toward revenue.
    await Order.create({
      tenantId: tenant._id,
      customerUserId: buyer,
      productId: productA._id,
      orderType: 'single_product',
      amount: 999,
      status: 'pending',
    });
    // Another tenant's paid order must not leak in.
    await Order.create({
      tenantId: other._id,
      customerUserId: buyer,
      productId: productA._id,
      orderType: 'single_product',
      amount: 500,
      status: 'paid',
    });

    const token = signAccessToken({
      sub: 'reseller-1',
      role: 'reseller_admin',
      tenantId: tenant._id.toString(),
    });
    const res = await request(app).get('/api/v1/reseller/stats').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.stats).toEqual({
      catalogTotal: 2,
      catalogLive: 1,
      ordersTotal: 3,
      ordersPaid: 2,
      revenue: 300,
      customers: 1,
    });
  });

  it('returns zeroes for a store with no activity', async () => {
    const tenant = await Tenant.create({ name: 'Bare', subdomain: 'bare-stats' });
    const token = signAccessToken({
      sub: 'reseller-2',
      role: 'reseller_admin',
      tenantId: tenant._id.toString(),
    });
    const res = await request(app).get('/api/v1/reseller/stats').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.stats.revenue).toBe(0);
    expect(res.body.stats.ordersTotal).toBe(0);
  });
});

describe('resellerAccount module — orders', () => {
  const app = buildTestApp();

  it('lists this tenant orders with product and buyer, newest first', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-rorders' });
    const other = await Tenant.create({ name: 'Other', subdomain: 'other-rorders' });
    const product = await Product.create({
      name: 'Nova Theme',
      slug: 'nova-theme',
      type: 'theme',
      basePrice: 999,
    });
    const buyer = await User.create({
      tenantId: tenant._id,
      role: 'customer',
      email: 'buyer@example.com',
      passwordHash: 'x',
    });

    await Order.create({
      tenantId: tenant._id,
      customerUserId: buyer._id,
      productId: product._id,
      orderType: 'single_product',
      amount: 999,
      status: 'paid',
    });
    await Order.create({
      tenantId: other._id,
      customerUserId: buyer._id,
      productId: product._id,
      orderType: 'single_product',
      amount: 999,
      status: 'paid',
    });

    const token = signAccessToken({
      sub: 'reseller-1',
      role: 'reseller_admin',
      tenantId: tenant._id.toString(),
    });
    const res = await request(app).get('/api/v1/reseller/orders').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(1);
    expect(res.body.orders[0]).toMatchObject({
      amount: 999,
      status: 'paid',
      product: { name: 'Nova Theme', type: 'theme' },
      customerEmail: 'buyer@example.com',
    });
  });
});
