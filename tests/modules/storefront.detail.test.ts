import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { storefrontRouter } from '../../src/modules/storefront/storefront.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Tenant } from '../../src/models/Tenant';
import { Product } from '../../src/models/Product';
import { ProductVersion } from '../../src/models/ProductVersion';
import { ResellerProduct } from '../../src/models/ResellerProduct';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/customer/products', storefrontRouter);
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

describe('storefront module — product detail', () => {
  const app = buildTestApp();

  it('returns the product with its discounted price and latest version', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-detail' });
    const product = await Product.create({
      name: 'Chatbot Builder',
      slug: 'chatbot-builder',
      type: 'ai_tool',
      description: 'Drag-and-drop chatbot flows.',
      basePrice: 4000,
      status: 'published',
      currentVersion: '2.1.0',
    });
    await ProductVersion.create({
      productId: product._id,
      version: '2.1.0',
      changelog: 'Adds WhatsApp delivery.',
    });
    await ResellerProduct.create({
      tenantId: tenant._id,
      productId: product._id,
      enabled: true,
      discountPercent: 25,
    });

    const token = signAccessToken({ sub: 'c-1', role: 'customer', tenantId: tenant._id.toString() });
    const res = await request(app)
      .get(`/api/v1/customer/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.product).toMatchObject({
      name: 'Chatbot Builder',
      description: 'Drag-and-drop chatbot flows.',
      price: 3000,
      currency: 'INR',
      currentVersion: '2.1.0',
    });
    expect(res.body.product.latestChangelog).toBe('Adds WhatsApp delivery.');
  });

  it('404s for a product this store does not sell', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-detail-2' });
    const product = await Product.create({
      name: 'Hidden',
      slug: 'hidden-detail',
      type: 'software',
      basePrice: 100,
      status: 'published',
    });
    // No entitlement for this tenant.

    const token = signAccessToken({ sub: 'c-2', role: 'customer', tenantId: tenant._id.toString() });
    const res = await request(app)
      .get(`/api/v1/customer/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('404s for a product that is not published', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-detail-3' });
    const product = await Product.create({
      name: 'Draft',
      slug: 'draft-detail',
      type: 'software',
      basePrice: 100,
      status: 'draft',
    });
    await ResellerProduct.create({ tenantId: tenant._id, productId: product._id, enabled: true });

    const token = signAccessToken({ sub: 'c-3', role: 'customer', tenantId: tenant._id.toString() });
    const res = await request(app)
      .get(`/api/v1/customer/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
