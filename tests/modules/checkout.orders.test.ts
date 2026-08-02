import mongoose, { Types } from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { checkoutRouter } from '../../src/modules/checkout/checkout.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Tenant } from '../../src/models/Tenant';
import { Product } from '../../src/models/Product';
import { Order } from '../../src/models/Order';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/customer', checkoutRouter);
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

describe('checkout module — list orders', () => {
  const app = buildTestApp();

  it("lists only the caller's own orders", async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-orders' });
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    const myUserId = new Types.ObjectId();
    const otherUserId = new Types.ObjectId();
    await Order.create({
      tenantId: tenant._id,
      customerUserId: myUserId,
      productId: product._id,
      orderType: 'single_product',
      amount: 10,
    });
    await Order.create({
      tenantId: tenant._id,
      customerUserId: otherUserId,
      productId: product._id,
      orderType: 'single_product',
      amount: 10,
    });

    const token = signAccessToken({ sub: myUserId.toString(), role: 'customer', tenantId: tenant._id.toString() });
    const res = await request(app)
      .get('/api/v1/customer/orders')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(1);
  });

  it('includes the product each order is for', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-orders-product' });
    const product = await Product.create({
      name: 'SaaS Boilerplate',
      slug: 'saas-boilerplate',
      type: 'digital_download',
      basePrice: 5999,
    });
    const userId = new Types.ObjectId();
    await Order.create({
      tenantId: tenant._id,
      customerUserId: userId,
      productId: product._id,
      orderType: 'single_product',
      amount: 5999,
      status: 'paid',
    });

    const token = signAccessToken({
      sub: userId.toString(),
      role: 'customer',
      tenantId: tenant._id.toString(),
    });
    const res = await request(app).get('/api/v1/customer/orders').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.orders[0].product).toEqual({
      _id: product._id.toString(),
      name: 'SaaS Boilerplate',
      type: 'digital_download',
    });
    expect(res.body.orders[0].status).toBe('paid');
  });
});
