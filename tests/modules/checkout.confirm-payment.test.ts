jest.mock('../../src/common/smtpEmail', () => ({
  smtpEmailService: { sendEmail: jest.fn().mockResolvedValue(undefined) },
}));

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
import { License } from '../../src/models/License';

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

describe('checkout module — confirm payment', () => {
  const app = buildTestApp();

  it("404s for another customer's order", async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-confirm-1' });
    const product = await Product.create({ name: 'P', slug: 'p-confirm-1', type: 'software', basePrice: 10 });
    const order = await Order.create({
      tenantId: tenant._id,
      customerUserId: new Types.ObjectId(),
      productId: product._id,
      orderType: 'single_product',
      amount: 10,
    });

    const token = signAccessToken({
      sub: new Types.ObjectId().toString(),
      role: 'customer',
      tenantId: tenant._id.toString(),
    });
    const res = await request(app)
      .post(`/api/v1/customer/orders/${order._id.toString()}/confirm-payment`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('409s for an order that is not pending', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-confirm-2' });
    const product = await Product.create({ name: 'P', slug: 'p-confirm-2', type: 'software', basePrice: 10 });
    const userId = new Types.ObjectId();
    const order = await Order.create({
      tenantId: tenant._id,
      customerUserId: userId,
      productId: product._id,
      orderType: 'single_product',
      amount: 10,
      status: 'paid',
    });

    const token = signAccessToken({ sub: userId.toString(), role: 'customer', tenantId: tenant._id.toString() });
    const res = await request(app)
      .post(`/api/v1/customer/orders/${order._id.toString()}/confirm-payment`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
  });

  it('marks a pending order paid and assigns an available license', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-confirm-3' });
    const product = await Product.create({ name: 'P', slug: 'p-confirm-3', type: 'software', basePrice: 10 });
    const userId = new Types.ObjectId();
    const order = await Order.create({
      tenantId: tenant._id,
      customerUserId: userId,
      productId: product._id,
      orderType: 'single_product',
      amount: 10,
    });
    await License.create({ productId: product._id, key: 'TZP-2026-CONFIRM01', status: 'available' });

    const token = signAccessToken({ sub: userId.toString(), role: 'customer', tenantId: tenant._id.toString() });
    const res = await request(app)
      .post(`/api/v1/customer/orders/${order._id.toString()}/confirm-payment`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('paid');
    expect(res.body.order.licenseId).not.toBeNull();
  });
});
