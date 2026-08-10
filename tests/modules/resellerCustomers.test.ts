import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { resellerCustomersRouter } from '../../src/modules/resellerCustomers/resellerCustomers.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Tenant } from '../../src/models/Tenant';
import { Product } from '../../src/models/Product';
import { ResellerProduct } from '../../src/models/ResellerProduct';
import { License } from '../../src/models/License';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/reseller', resellerCustomersRouter);
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

describe('resellerCustomers module', () => {
  const app = buildTestApp();

  it('creates and lists reseller-owned customers', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-customers' });
    const token = signAccessToken({
      sub: 'reseller-1',
      role: 'reseller_admin',
      tenantId: tenant._id.toString(),
    });

    const createRes = await request(app)
      .post('/api/v1/reseller/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Jane Buyer', email: 'Jane@Example.com', phone: '+919999999999' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.customer.email).toBe('jane@example.com');

    const listRes = await request(app)
      .get('/api/v1/reseller/customers')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.customers).toHaveLength(1);
    expect(listRes.body.customers[0].accessCodes).toBe(0);
  });

  it('generates an access code and reserves an available license', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-access' });
    const product = await Product.create({
      name: 'Pro Toolkit',
      slug: 'pro-toolkit',
      type: 'software',
      basePrice: 999,
      status: 'published',
    });
    await ResellerProduct.create({ tenantId: tenant._id, productId: product._id, enabled: true });
    const license = await License.create({ productId: product._id, key: 'TZP-2026-ABCDEFGH' });
    const token = signAccessToken({
      sub: 'reseller-1',
      role: 'reseller_admin',
      tenantId: tenant._id.toString(),
    });
    const customerRes = await request(app)
      .post('/api/v1/reseller/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Jane Buyer', email: 'jane@example.com' });

    const codeRes = await request(app)
      .post(`/api/v1/reseller/customers/${customerRes.body.customer._id}/access-codes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString() });

    expect(codeRes.status).toBe(201);
    expect(codeRes.body.accessCode.code).toMatch(/^TZP-2026-[A-F0-9]{8}$/);
    expect(codeRes.body.accessCode.licenseKey).toBe('TZP-2026-ABCDEFGH');

    const updatedLicense = await License.findById(license._id);
    expect(updatedLicense?.status).toBe('reserved');
    expect(updatedLicense?.tenantId?.toString()).toBe(tenant._id.toString());
  });
});
