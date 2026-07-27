jest.mock('../../src/common/smtpEmail', () => ({
  smtpEmailService: { sendEmail: jest.fn().mockResolvedValue(undefined) },
}));

import crypto from 'crypto';
import mongoose from 'mongoose';
import express, { Request } from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { checkoutRouter } from '../../src/modules/checkout/checkout.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { Tenant } from '../../src/models/Tenant';
import { User } from '../../src/models/User';
import { Product } from '../../src/models/Product';
import { Order } from '../../src/models/Order';
import { License } from '../../src/models/License';

function buildTestApp() {
  const app = express();
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as Request).rawBody = buf;
      },
    })
  );
  app.use('/api/v1/customer', checkoutRouter);
  app.use(errorMiddleware);
  return app;
}

function sign(rawBody: string): string {
  return crypto.createHmac('sha256', 'test-webhook-secret-please-ignore').update(rawBody).digest('hex');
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

describe('checkout module — webhook', () => {
  const app = buildTestApp();

  it('400s on an invalid signature', async () => {
    const body = JSON.stringify({ gatewayOrderId: 'mock_order_x', success: true });
    const res = await request(app)
      .post('/api/v1/customer/checkout/webhook')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', 'wrong-signature')
      .send(body);
    expect(res.status).toBe(400);
  });

  it('marks the order paid and auto-assigns an available license', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-webhook' });
    const user = await User.create({
      tenantId: tenant._id,
      role: 'customer',
      email: 'buyer@example.com',
      passwordHash: 'x',
    });
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    const order = await Order.create({
      tenantId: tenant._id,
      customerUserId: user._id,
      productId: product._id,
      orderType: 'single_product',
      amount: 10,
      paymentRef: 'mock_order_paidtest',
    });
    await License.create({ productId: product._id, key: 'TZP-2026-WEBHOOK1', status: 'available' });

    const body = JSON.stringify({ gatewayOrderId: 'mock_order_paidtest', success: true });
    const res = await request(app)
      .post('/api/v1/customer/checkout/webhook')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sign(body))
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('paid');
    expect(res.body.order.licenseId).not.toBeNull();

    const updatedOrder = await Order.findById(order._id);
    expect(updatedOrder!.status).toBe('paid');
    const license = await License.findOne({ productId: product._id });
    expect(license!.status).toBe('assigned');
    expect(license!.assignedUserId!.toString()).toBe(user._id.toString());
  });

  it('leaves licenseId null when no license is available', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-webhook-2' });
    const user = await User.create({
      tenantId: tenant._id,
      role: 'customer',
      email: 'buyer2@example.com',
      passwordHash: 'x',
    });
    const product = await Product.create({ name: 'P', slug: 'p2', type: 'software', basePrice: 10 });
    await Order.create({
      tenantId: tenant._id,
      customerUserId: user._id,
      productId: product._id,
      orderType: 'single_product',
      amount: 10,
      paymentRef: 'mock_order_nolicense',
    });

    const body = JSON.stringify({ gatewayOrderId: 'mock_order_nolicense', success: true });
    const res = await request(app)
      .post('/api/v1/customer/checkout/webhook')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sign(body))
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('paid');
    expect(res.body.order.licenseId).toBeNull();
  });
});
