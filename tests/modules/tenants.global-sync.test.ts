import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { tenantsRouter } from '../../src/modules/tenants/tenants.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Product } from '../../src/models/Product';
import { ResellerProduct } from '../../src/models/ResellerProduct';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/tenants', tenantsRouter);
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

describe('tenant creation — global product auto-sync', () => {
  const app = buildTestApp();
  const masterToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });

  it('auto-enables existing global products for a newly created tenant', async () => {
    const product = await Product.create({
      name: 'P',
      slug: 'p',
      type: 'software',
      basePrice: 10,
      syncMode: 'global',
    });

    const res = await request(app)
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'New Reseller', subdomain: 'new-reseller' });
    expect(res.status).toBe(201);

    const row = await ResellerProduct.findOne({ tenantId: res.body.tenant._id, productId: product._id });
    expect(row).not.toBeNull();
    expect(row!.enabled).toBe(true);
  });

  it('creates a disabled row for existing optional products for a new tenant', async () => {
    const product = await Product.create({
      name: 'Opt',
      slug: 'opt',
      type: 'software',
      basePrice: 10,
      syncMode: 'optional',
    });

    const res = await request(app)
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'Another Reseller', subdomain: 'another-reseller' });
    expect(res.status).toBe(201);

    const row = await ResellerProduct.findOne({ tenantId: res.body.tenant._id, productId: product._id });
    expect(row).not.toBeNull();
    expect(row!.enabled).toBe(false);
  });
});
