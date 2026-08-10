jest.mock('../../src/common/smtpEmail', () => ({
  smtpEmailService: { sendEmail: jest.fn().mockResolvedValue(undefined) },
}));

import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { grantAccessRouter } from '../../src/modules/grantAccess/grantAccess.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { smtpEmailService } from '../../src/common/smtpEmail';
import { Tenant } from '../../src/models/Tenant';
import { Product } from '../../src/models/Product';
import { ResellerProduct } from '../../src/models/ResellerProduct';
import { ResellerCustomer } from '../../src/models/ResellerCustomer';
import { License } from '../../src/models/License';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/reseller/grant-access', grantAccessRouter);
  app.use(errorMiddleware);
  return app;
}

beforeAll(async () => {
  const uri = await startTestDb();
  await mongoose.connect(uri);
});

afterEach(async () => {
  await clearTestDb();
  jest.clearAllMocks();
});

afterAll(async () => {
  await stopTestDb();
});

describe('grantAccess module', () => {
  const app = buildTestApp();

  async function seed() {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-grant' });
    const product = await Product.create({
      name: 'Design Kit',
      slug: 'design-kit',
      type: 'software',
      basePrice: 99,
      status: 'published',
    });
    await ResellerProduct.create({ tenantId: tenant._id, productId: product._id, enabled: true });
    const customer = await ResellerCustomer.create({
      tenantId: tenant._id,
      name: 'Jane Buyer',
      email: 'jane@example.com',
    });
    await License.create({ productId: product._id, key: 'TZP-2026-GRANTED1', status: 'available' });
    const token = signAccessToken({ sub: 'reseller-1', role: 'reseller_admin', tenantId: tenant._id.toString() });
    return { tenant, product, customer, token };
  }

  it('grants a customer direct access to a product, bypassing checkout', async () => {
    const { product, customer, token } = await seed();

    const res = await request(app)
      .post('/api/v1/reseller/grant-access')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerId: customer._id.toString(), productId: product._id.toString() });

    expect(res.status).toBe(201);
    expect(res.body.grant.licenseKey).toBe('TZP-2026-GRANTED1');
    expect(res.body.grant.status).toBe('assigned');
    expect(res.body.grant.customer.email).toBe('jane@example.com');

    const license = await License.findOne({ key: 'TZP-2026-GRANTED1' });
    expect(license!.status).toBe('assigned');
    expect(license!.grantedCustomerId!.toString()).toBe(customer._id.toString());
    expect(smtpEmailService.sendEmail).toHaveBeenCalledWith(
      'jane@example.com',
      'grant-access',
      expect.objectContaining({ licenseKey: 'TZP-2026-GRANTED1' }),
      expect.any(String)
    );
  });

  it('sets an expiry date when provided', async () => {
    const { product, customer, token } = await seed();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .post('/api/v1/reseller/grant-access')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerId: customer._id.toString(), productId: product._id.toString(), expiresAt });

    expect(res.status).toBe(201);
    expect(new Date(res.body.grant.expiresAt).toISOString()).toBe(expiresAt);
  });

  it('404s for a customer that does not belong to this tenant', async () => {
    const { product, token } = await seed();
    const otherTenant = await Tenant.create({ name: 'Other', subdomain: 'other-grant' });
    const otherCustomer = await ResellerCustomer.create({
      tenantId: otherTenant._id,
      name: 'Not Mine',
      email: 'notmine@example.com',
    });

    const res = await request(app)
      .post('/api/v1/reseller/grant-access')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerId: otherCustomer._id.toString(), productId: product._id.toString() });

    expect(res.status).toBe(404);
  });

  it('403s when the product is not enabled for this tenant', async () => {
    const { customer, token } = await seed();
    const otherProduct = await Product.create({
      name: 'Not Enabled',
      slug: 'not-enabled',
      type: 'software',
      basePrice: 50,
      status: 'published',
    });

    const res = await request(app)
      .post('/api/v1/reseller/grant-access')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerId: customer._id.toString(), productId: otherProduct._id.toString() });

    expect(res.status).toBe(403);
  });

  it('409s when no license is available', async () => {
    const { product, customer, token } = await seed();
    await License.deleteMany({ productId: product._id });

    const res = await request(app)
      .post('/api/v1/reseller/grant-access')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerId: customer._id.toString(), productId: product._id.toString() });

    expect(res.status).toBe(409);
  });

  it('lists previously granted access for the tenant', async () => {
    const { product, customer, token } = await seed();
    await request(app)
      .post('/api/v1/reseller/grant-access')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerId: customer._id.toString(), productId: product._id.toString() });

    const res = await request(app).get('/api/v1/reseller/grant-access').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.grants).toHaveLength(1);
    expect(res.body.grants[0].customer.email).toBe('jane@example.com');
    expect(res.body.grants[0].product.name).toBe('Design Kit');
  });
});
