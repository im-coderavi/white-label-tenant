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

describe('resellerCatalog module — list', () => {
  const app = buildTestApp();

  it('rejects non-reseller roles', async () => {
    const token = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });
    const res = await request(app)
      .get('/api/v1/reseller/products')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('lists only the caller tenant published catalog rows', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-catalog' });
    const otherTenant = await Tenant.create({ name: 'Other', subdomain: 'other-catalog' });
    const published = await Product.create({
      name: 'Published Tool',
      slug: 'published-tool',
      type: 'software',
      basePrice: 100,
      status: 'published',
      syncMode: 'optional',
    });
    const draft = await Product.create({
      name: 'Draft Tool',
      slug: 'draft-tool',
      type: 'software',
      basePrice: 50,
      status: 'draft',
      syncMode: 'optional',
    });
    await ResellerProduct.create({ tenantId: tenant._id, productId: published._id, enabled: true });
    await ResellerProduct.create({ tenantId: tenant._id, productId: draft._id, enabled: false });
    await ResellerProduct.create({ tenantId: otherTenant._id, productId: published._id, enabled: true });

    const token = signAccessToken({
      sub: 'reseller-1',
      role: 'reseller_admin',
      tenantId: tenant._id.toString(),
    });
    const res = await request(app)
      .get('/api/v1/reseller/products')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].product.name).toBe('Published Tool');
    expect(res.body.items[0].syncMode).toBe('optional');
  });
});
