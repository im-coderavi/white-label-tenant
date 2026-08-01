import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { storefrontRouter } from '../../src/modules/storefront/storefront.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Tenant } from '../../src/models/Tenant';
import { Product } from '../../src/models/Product';
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

describe('storefront module — list', () => {
  const app = buildTestApp();

  it('rejects non-customer roles', async () => {
    const token = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });
    const res = await request(app)
      .get('/api/v1/customer/products')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('lists only published, enabled items for the caller tenant with computed price', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-storefront' });
    const otherTenant = await Tenant.create({ name: 'Other', subdomain: 'other-storefront' });

    const basePriced = await Product.create({
      name: 'Base Priced',
      slug: 'base-priced',
      type: 'software',
      basePrice: 100,
      status: 'published',
    });
    const discounted = await Product.create({
      name: 'Discounted',
      slug: 'discounted',
      type: 'software',
      basePrice: 200,
      status: 'published',
    });
    const draft = await Product.create({
      name: 'Draft',
      slug: 'draft-item',
      type: 'software',
      basePrice: 50,
      status: 'draft',
    });
    const disabled = await Product.create({
      name: 'Disabled',
      slug: 'disabled-item',
      type: 'software',
      basePrice: 75,
      status: 'published',
    });

    await ResellerProduct.create({ tenantId: tenant._id, productId: basePriced._id, enabled: true });
    await ResellerProduct.create({
      tenantId: tenant._id,
      productId: discounted._id,
      enabled: true,
      discountPercent: 10,
    });
    await ResellerProduct.create({ tenantId: tenant._id, productId: draft._id, enabled: true });
    await ResellerProduct.create({ tenantId: tenant._id, productId: disabled._id, enabled: false });
    await ResellerProduct.create({ tenantId: otherTenant._id, productId: basePriced._id, enabled: true });

    const token = signAccessToken({ sub: 'cust-1', role: 'customer', tenantId: tenant._id.toString() });
    const res = await request(app)
      .get('/api/v1/customer/products')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    const byName: Record<string, { price: number }> = Object.fromEntries(
      res.body.items.map((item: { name: string; price: number }) => [item.name, item])
    );
    expect(byName['Base Priced'].price).toBe(100);
    expect(byName['Discounted'].price).toBe(180);
  });
});
