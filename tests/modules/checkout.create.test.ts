import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { checkoutRouter } from '../../src/modules/checkout/checkout.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Tenant } from '../../src/models/Tenant';
import { Product } from '../../src/models/Product';
import { ResellerProduct } from '../../src/models/ResellerProduct';

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

describe('checkout module — create checkout', () => {
  const app = buildTestApp();

  it('creates a pending order with a gateway reference', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-checkout' });
    const product = await Product.create({
      name: 'P',
      slug: 'p',
      type: 'software',
      basePrice: 500,
      status: 'published',
    });
    await ResellerProduct.create({ tenantId: tenant._id, productId: product._id, enabled: true });

    const token = signAccessToken({
      sub: new mongoose.Types.ObjectId().toString(),
      role: 'customer',
      tenantId: tenant._id.toString(),
    });
    const res = await request(app)
      .post('/api/v1/customer/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString() });
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(500);
    expect(res.body.gatewayOrderId).toMatch(/^mock_order_/);
  });

  it('403s if the product is not entitled to the tenant', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-checkout-2' });
    const product = await Product.create({
      name: 'P',
      slug: 'p2',
      type: 'software',
      basePrice: 500,
      status: 'published',
    });
    // No ResellerProduct entitlement created.

    const token = signAccessToken({
      sub: new mongoose.Types.ObjectId().toString(),
      role: 'customer',
      tenantId: tenant._id.toString(),
    });
    const res = await request(app)
      .post('/api/v1/customer/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString() });
    expect(res.status).toBe(403);
  });

  it('404s for an unpublished product', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-checkout-3' });
    const product = await Product.create({
      name: 'P',
      slug: 'p3',
      type: 'software',
      basePrice: 500,
      status: 'draft',
    });
    await ResellerProduct.create({ tenantId: tenant._id, productId: product._id, enabled: true });

    const token = signAccessToken({
      sub: new mongoose.Types.ObjectId().toString(),
      role: 'customer',
      tenantId: tenant._id.toString(),
    });
    const res = await request(app)
      .post('/api/v1/customer/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString() });
    expect(res.status).toBe(404);
  });
});
