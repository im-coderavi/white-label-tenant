import mongoose, { Types } from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { checkoutRouter } from '../../src/modules/checkout/checkout.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Tenant } from '../../src/models/Tenant';
import { Product } from '../../src/models/Product';
import { ProductVersion } from '../../src/models/ProductVersion';
import { Order } from '../../src/models/Order';
import { DownloadToken } from '../../src/models/DownloadToken';

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

describe('checkout module — downloads', () => {
  const app = buildTestApp();

  it('issues a download token for a paid own order', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-downloads' });
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    await ProductVersion.create({
      productId: product._id,
      version: '1.0.0',
      fileUrl: 'https://res.cloudinary.com/file.zip',
    });
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
      .get(`/api/v1/customer/downloads/${order._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.fileUrl).toBe('https://res.cloudinary.com/file.zip');
    expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(Date.now());

    const stored = await DownloadToken.findOne({ orderId: order._id });
    expect(stored).not.toBeNull();
  });

  it("404s for another customer's order", async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-downloads-2' });
    const product = await Product.create({ name: 'P', slug: 'p2', type: 'software', basePrice: 10 });
    const ownerId = new Types.ObjectId();
    const order = await Order.create({
      tenantId: tenant._id,
      customerUserId: ownerId,
      productId: product._id,
      orderType: 'single_product',
      amount: 10,
      status: 'paid',
    });

    const token = signAccessToken({
      sub: new Types.ObjectId().toString(),
      role: 'customer',
      tenantId: tenant._id.toString(),
    });
    const res = await request(app)
      .get(`/api/v1/customer/downloads/${order._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('404s for an unpaid order', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-downloads-3' });
    const product = await Product.create({ name: 'P', slug: 'p3', type: 'software', basePrice: 10 });
    const userId = new Types.ObjectId();
    const order = await Order.create({
      tenantId: tenant._id,
      customerUserId: userId,
      productId: product._id,
      orderType: 'single_product',
      amount: 10,
      status: 'pending',
    });

    const token = signAccessToken({ sub: userId.toString(), role: 'customer', tenantId: tenant._id.toString() });
    const res = await request(app)
      .get(`/api/v1/customer/downloads/${order._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
