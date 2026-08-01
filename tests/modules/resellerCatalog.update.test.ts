import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { resellerCatalogRouter } from '../../src/modules/resellerCatalog/resellerCatalog.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Tenant } from '../../src/models/Tenant';
import { Product } from '../../src/models/Product';
import { ResellerProduct } from '../../src/models/ResellerProduct';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/reseller/products', resellerCatalogRouter);
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

describe('resellerCatalog module — update', () => {
  const app = buildTestApp();

  it('404s for a catalog row belonging to another tenant', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-update-1' });
    const otherTenant = await Tenant.create({ name: 'Other', subdomain: 'other-update-1' });
    const product = await Product.create({
      name: 'Tool',
      slug: 'tool-update-1',
      type: 'software',
      basePrice: 100,
      status: 'published',
      syncMode: 'optional',
    });
    const row = await ResellerProduct.create({ tenantId: otherTenant._id, productId: product._id, enabled: false });

    const token = signAccessToken({
      sub: 'reseller-1',
      role: 'reseller_admin',
      tenantId: tenant._id.toString(),
    });
    const res = await request(app)
      .patch(`/api/v1/reseller/products/${row._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: true });
    expect(res.status).toBe(404);
  });

  it('rejects disabling a global product', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-update-2' });
    const product = await Product.create({
      name: 'Global Tool',
      slug: 'global-tool-update-2',
      type: 'software',
      basePrice: 100,
      status: 'published',
      syncMode: 'global',
    });
    const row = await ResellerProduct.create({ tenantId: tenant._id, productId: product._id, enabled: true });

    const token = signAccessToken({
      sub: 'reseller-1',
      role: 'reseller_admin',
      tenantId: tenant._id.toString(),
    });
    const res = await request(app)
      .patch(`/api/v1/reseller/products/${row._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: false });
    expect(res.status).toBe(400);
  });

  it('enables an optional product', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-update-3' });
    const product = await Product.create({
      name: 'Optional Tool',
      slug: 'optional-tool-update-3',
      type: 'software',
      basePrice: 100,
      status: 'published',
      syncMode: 'optional',
    });
    const row = await ResellerProduct.create({ tenantId: tenant._id, productId: product._id, enabled: false });

    const token = signAccessToken({
      sub: 'reseller-1',
      role: 'reseller_admin',
      tenantId: tenant._id.toString(),
    });
    const res = await request(app)
      .patch(`/api/v1/reseller/products/${row._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: true });
    expect(res.status).toBe(200);
    expect(res.body.item.enabled).toBe(true);
  });

  it('sets a custom price and nulls any existing discount', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-update-4' });
    const product = await Product.create({
      name: 'Priced Tool',
      slug: 'priced-tool-update-4',
      type: 'software',
      basePrice: 100,
      status: 'published',
      syncMode: 'optional',
    });
    const row = await ResellerProduct.create({
      tenantId: tenant._id,
      productId: product._id,
      enabled: true,
      discountPercent: 10,
    });

    const token = signAccessToken({
      sub: 'reseller-1',
      role: 'reseller_admin',
      tenantId: tenant._id.toString(),
    });
    const res = await request(app)
      .patch(`/api/v1/reseller/products/${row._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ pricingMode: 'custom', customPrice: 75 });
    expect(res.status).toBe(200);
    expect(res.body.item.customPrice).toBe(75);
    expect(res.body.item.discountPercent).toBeNull();
  });

  it('rejects pricingMode custom without a customPrice', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-update-5' });
    const product = await Product.create({
      name: 'Tool',
      slug: 'tool-update-5',
      type: 'software',
      basePrice: 100,
      status: 'published',
      syncMode: 'optional',
    });
    const row = await ResellerProduct.create({ tenantId: tenant._id, productId: product._id, enabled: true });

    const token = signAccessToken({
      sub: 'reseller-1',
      role: 'reseller_admin',
      tenantId: tenant._id.toString(),
    });
    const res = await request(app)
      .patch(`/api/v1/reseller/products/${row._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ pricingMode: 'custom' });
    expect(res.status).toBe(400);
  });

  it('toggles isFeatured independently of pricing', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-update-6' });
    const product = await Product.create({
      name: 'Tool',
      slug: 'tool-update-6',
      type: 'software',
      basePrice: 100,
      status: 'published',
      syncMode: 'optional',
    });
    const row = await ResellerProduct.create({ tenantId: tenant._id, productId: product._id, enabled: true });

    const token = signAccessToken({
      sub: 'reseller-1',
      role: 'reseller_admin',
      tenantId: tenant._id.toString(),
    });
    const res = await request(app)
      .patch(`/api/v1/reseller/products/${row._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isFeatured: true });
    expect(res.status).toBe(200);
    expect(res.body.item.isFeatured).toBe(true);
  });
});
