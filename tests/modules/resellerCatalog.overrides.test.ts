import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { grantAgencyPlan } from '../helpers/plans';
import { resellerCatalogRouter } from '../../src/modules/resellerCatalog/resellerCatalog.routes';
import { storefrontRouter } from '../../src/modules/storefront/storefront.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Tenant } from '../../src/models/Tenant';
import { Product } from '../../src/models/Product';
import { ResellerProduct } from '../../src/models/ResellerProduct';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/reseller/products', resellerCatalogRouter);
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

describe('resellerCatalog — display overrides (product lock/customize)', () => {
  const app = buildTestApp();

  it('lets a reseller override display name, description, and thumbnail without touching the master product', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-override-1' });
    await grantAgencyPlan(tenant._id);
    const product = await Product.create({
      name: 'Google Maps Scraper Pro',
      slug: 'google-maps-scraper-pro',
      type: 'script',
      description: 'Admin master description',
      basePrice: 999,
      status: 'published',
      syncMode: 'optional',
    });
    const row = await ResellerProduct.create({ tenantId: tenant._id, productId: product._id, enabled: true });

    const token = signAccessToken({ sub: 'reseller-1', role: 'reseller_admin', tenantId: tenant._id.toString() });
    const res = await request(app)
      .patch(`/api/v1/reseller/products/${row._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        overrides: {
          displayName: 'Google Maps Lead Extractor',
          shortDescription: 'Extract leads fast',
          description: 'My own storefront description',
          thumbnailUrl: 'https://cdn.example.com/my-banner.png',
        },
        pricingMode: 'custom',
        customPrice: 1499,
      });

    expect(res.status).toBe(200);
    expect(res.body.item.overrides.displayName).toBe('Google Maps Lead Extractor');
    expect(res.body.item.customPrice).toBe(1499);

    // Master product itself is untouched — the lock held.
    const masterProduct = await Product.findById(product._id);
    expect(masterProduct!.name).toBe('Google Maps Scraper Pro');
    expect(masterProduct!.description).toBe('Admin master description');
  });

  it('reflects the reseller override, not the master name, on the public storefront', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-override-2' });
    await grantAgencyPlan(tenant._id);
    const product = await Product.create({
      name: 'Google Maps Scraper Pro',
      slug: 'google-maps-scraper-pro-2',
      type: 'script',
      description: 'Admin master description',
      basePrice: 999,
      status: 'published',
      syncMode: 'optional',
    });
    await ResellerProduct.create({
      tenantId: tenant._id,
      productId: product._id,
      enabled: true,
      overrides: { displayName: 'Google Maps Lead Extractor', description: 'Reseller-facing copy' },
    });

    const customerToken = signAccessToken({ sub: 'cust-1', role: 'customer', tenantId: tenant._id.toString() });
    const res = await request(app)
      .get('/api/v1/customer/products')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items[0].name).toBe('Google Maps Lead Extractor');
    expect(res.body.items[0].description).toBe('Reseller-facing copy');
  });

  it('falls back to the master name/description when no override is set', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-override-3' });
    await grantAgencyPlan(tenant._id);
    const product = await Product.create({
      name: 'Original Name',
      slug: 'original-name',
      type: 'script',
      description: 'Original description',
      basePrice: 100,
      status: 'published',
      syncMode: 'optional',
    });
    await ResellerProduct.create({ tenantId: tenant._id, productId: product._id, enabled: true });

    const customerToken = signAccessToken({ sub: 'cust-1', role: 'customer', tenantId: tenant._id.toString() });
    const res = await request(app)
      .get('/api/v1/customer/products')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items[0].name).toBe('Original Name');
    expect(res.body.items[0].description).toBe('Original description');
  });

  it('rejects an override payload with an invalid thumbnail URL', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-override-4' });
    await grantAgencyPlan(tenant._id);
    const product = await Product.create({
      name: 'Tool',
      slug: 'tool-override-4',
      type: 'script',
      basePrice: 100,
      status: 'published',
      syncMode: 'optional',
    });
    const row = await ResellerProduct.create({ tenantId: tenant._id, productId: product._id, enabled: true });

    const token = signAccessToken({ sub: 'reseller-1', role: 'reseller_admin', tenantId: tenant._id.toString() });
    const res = await request(app)
      .patch(`/api/v1/reseller/products/${row._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ overrides: { thumbnailUrl: 'not-a-url' } });

    expect(res.status).toBe(400);
  });
});
