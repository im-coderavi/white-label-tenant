jest.mock('../../src/common/smtpEmail', () => ({
  smtpEmailService: { sendEmail: jest.fn().mockResolvedValue(undefined) },
}));

import crypto from 'crypto';
import mongoose from 'mongoose';
import express, { Request } from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { grantAgencyPlan } from '../helpers/plans';
import { marketplaceRouter } from '../../src/modules/marketplace/marketplace.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Tenant } from '../../src/models/Tenant';
import { Product } from '../../src/models/Product';
import { ResellerProduct } from '../../src/models/ResellerProduct';
import { License } from '../../src/models/License';
import { User } from '../../src/models/User';
import { Category } from '../../src/models/Category';

function buildTestApp() {
  const app = express();
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as Request).rawBody = buf;
      },
    })
  );
  app.use('/api/v1/reseller/marketplace', marketplaceRouter);
  app.use(errorMiddleware);
  return app;
}

function sign(rawBody: string): string {
  return crypto.createHmac('sha256', 'test-webhook-secret-please-ignore').update(rawBody).digest('hex');
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

describe('marketplace module', () => {
  const app = buildTestApp();

  it('lists published master products with unlocked status for the reseller tenant', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-mkt-1' });
    const globalProduct = await Product.create({
      name: 'Global Tool',
      slug: 'global-tool',
      type: 'software',
      basePrice: 100,
      status: 'published',
      syncMode: 'global',
    });
    const optionalProduct = await Product.create({
      name: 'Optional Tool',
      slug: 'optional-tool',
      type: 'software',
      basePrice: 200,
      status: 'published',
      syncMode: 'optional',
    });
    await ResellerProduct.create({ tenantId: tenant._id, productId: optionalProduct._id, enabled: true });
    const notEntitledProduct = await Product.create({
      name: 'Locked Tool',
      slug: 'locked-tool',
      type: 'software',
      basePrice: 300,
      status: 'published',
      syncMode: 'optional',
    });
    void globalProduct;
    void notEntitledProduct;

    const token = signAccessToken({ sub: 'r1', role: 'reseller_admin', tenantId: tenant._id.toString() });
    const res = await request(app).get('/api/v1/reseller/marketplace').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const byName: Record<string, { unlocked: boolean }> = Object.fromEntries(
      res.body.items.map((i: { name: string; unlocked: boolean }) => [i.name, i])
    );
    expect(byName['Global Tool'].unlocked).toBe(true);
    expect(byName['Optional Tool'].unlocked).toBe(true);
    expect(byName['Locked Tool'].unlocked).toBe(false);
  });

  it('excludes private/exclusive products entitled to a different tenant', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-mkt-2' });
    const otherTenant = await Tenant.create({ name: 'Beta', subdomain: 'beta-mkt-2' });
    await Product.create({
      name: 'Exclusive For Beta',
      slug: 'exclusive-for-beta',
      type: 'software',
      basePrice: 100,
      status: 'published',
      syncMode: 'exclusive',
      tenantId: otherTenant._id,
    });

    const token = signAccessToken({ sub: 'r1', role: 'reseller_admin', tenantId: tenant._id.toString() });
    const res = await request(app).get('/api/v1/reseller/marketplace').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items.find((i: { name: string }) => i.name === 'Exclusive For Beta')).toBeUndefined();
  });

  it('redeems a license key and unlocks the product for the tenant', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-mkt-3' });
    await grantAgencyPlan(tenant._id);
    const product = await Product.create({
      name: 'Redeemable Tool',
      slug: 'redeemable-tool',
      type: 'software',
      basePrice: 150,
      status: 'published',
      syncMode: 'optional',
    });
    await License.create({ productId: product._id, key: 'TZP-2026-MKTREDEEM', status: 'available' });

    const token = signAccessToken({ sub: 'r1', role: 'reseller_admin', tenantId: tenant._id.toString() });
    const res = await request(app)
      .post('/api/v1/reseller/marketplace/redeem')
      .set('Authorization', `Bearer ${token}`)
      .send({ key: 'TZP-2026-MKTREDEEM' });

    expect(res.status).toBe(200);
    expect(res.body.result.unlocked).toBe(true);
    expect(res.body.result.productName).toBe('Redeemable Tool');

    const entitlement = await ResellerProduct.findOne({ tenantId: tenant._id, productId: product._id });
    expect(entitlement!.enabled).toBe(true);
    const license = await License.findOne({ key: 'TZP-2026-MKTREDEEM' });
    expect(license!.status).toBe('assigned');
    expect(license!.tenantId!.toString()).toBe(tenant._id.toString());
  });

  it('rejects redeeming a license key already bound to a different tenant', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-mkt-4' });
    const otherTenant = await Tenant.create({ name: 'Beta', subdomain: 'beta-mkt-4' });
    const product = await Product.create({
      name: 'Someone Elses Tool',
      slug: 'someone-elses-tool',
      type: 'software',
      basePrice: 150,
      status: 'published',
      syncMode: 'optional',
    });
    await License.create({
      productId: product._id,
      key: 'TZP-2026-NOTYOURS1',
      status: 'assigned',
      tenantId: otherTenant._id,
    });

    const token = signAccessToken({ sub: 'r1', role: 'reseller_admin', tenantId: tenant._id.toString() });
    const res = await request(app)
      .post('/api/v1/reseller/marketplace/redeem')
      .set('Authorization', `Bearer ${token}`)
      .send({ key: 'TZP-2026-NOTYOURS1' });

    expect(res.status).toBe(403);
  });

  it('runs checkout -> webhook -> unlocked catalog entry for a direct marketplace purchase', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-mkt-5' });
    await grantAgencyPlan(tenant._id);
    const product = await Product.create({
      name: 'Buyable Tool',
      slug: 'buyable-tool',
      type: 'software',
      basePrice: 250,
      status: 'published',
      syncMode: 'optional',
    });
    await License.create({ productId: product._id, key: 'TZP-2026-MKTBUY1', status: 'available' });
    const resellerAdmin = await User.create({
      tenantId: tenant._id,
      role: 'reseller_admin',
      email: 'admin@acme-mkt-5.example.com',
      passwordHash: 'x',
    });

    const token = signAccessToken({
      sub: resellerAdmin._id.toString(),
      role: 'reseller_admin',
      tenantId: tenant._id.toString(),
    });
    const checkoutRes = await request(app)
      .post('/api/v1/reseller/marketplace/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString() });

    expect(checkoutRes.status).toBe(201);
    const { gatewayOrderId } = checkoutRes.body;

    const webhookBody = JSON.stringify({ gatewayOrderId, success: true });
    const webhookRes = await request(app)
      .post('/api/v1/reseller/marketplace/webhook')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sign(webhookBody))
      .send(webhookBody);

    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body.order.status).toBe('paid');

    const entitlement = await ResellerProduct.findOne({ tenantId: tenant._id, productId: product._id });
    expect(entitlement!.enabled).toBe(true);
  });

  it('blocks direct purchase of an already-global product', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-mkt-6' });
    await grantAgencyPlan(tenant._id);
    const product = await Product.create({
      name: 'Already Global',
      slug: 'already-global',
      type: 'software',
      basePrice: 100,
      status: 'published',
      syncMode: 'global',
    });

    const token = signAccessToken({ sub: 'r1', role: 'reseller_admin', tenantId: tenant._id.toString() });
    const res = await request(app)
      .post('/api/v1/reseller/marketplace/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString() });

    expect(res.status).toBe(409);
  });

  it('blocks marketplace checkout and redeem for a tenant with no active plan (Starter-shaped defaults)', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-mkt-7' });
    const product = await Product.create({
      name: 'Gated Tool',
      slug: 'gated-tool',
      type: 'software',
      basePrice: 100,
      status: 'published',
      syncMode: 'optional',
    });
    await License.create({ productId: product._id, key: 'TZP-2026-GATEDKEY', status: 'available' });

    const token = signAccessToken({ sub: 'r1', role: 'reseller_admin', tenantId: tenant._id.toString() });

    const checkoutRes = await request(app)
      .post('/api/v1/reseller/marketplace/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString() });
    expect(checkoutRes.status).toBe(403);

    const redeemRes = await request(app)
      .post('/api/v1/reseller/marketplace/redeem')
      .set('Authorization', `Bearer ${token}`)
      .send({ key: 'TZP-2026-GATEDKEY' });
    expect(redeemRes.status).toBe(403);

    // Browsing the catalog itself is not gated — only buying/unlocking is.
    const listRes = await request(app).get('/api/v1/reseller/marketplace').set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
  });

  it('filters by a leaf category id', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-mkt-8' });
    const parent = await Category.create({ tenantId: null, name: 'AI Tools', slug: 'ai-tools-test' });
    const child = await Category.create({
      tenantId: null,
      name: 'AI Content',
      slug: 'ai-content-test',
      parentId: parent._id,
    });
    await Product.create({
      name: 'AI Writer',
      slug: 'ai-writer-mkt-8',
      type: 'ai_tool',
      basePrice: 100,
      status: 'published',
      syncMode: 'global',
      categoryId: child._id,
    });
    await Product.create({
      name: 'Unrelated Tool',
      slug: 'unrelated-tool-mkt-8',
      type: 'software',
      basePrice: 100,
      status: 'published',
      syncMode: 'global',
    });

    const token = signAccessToken({ sub: 'r1', role: 'reseller_admin', tenantId: tenant._id.toString() });
    const res = await request(app)
      .get(`/api/v1/reseller/marketplace?categoryId=${child._id.toString()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].name).toBe('AI Writer');
  });

  it('filters by a parent category id, including products in its child categories', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-mkt-9' });
    const parent = await Category.create({ tenantId: null, name: 'AI Tools', slug: 'ai-tools-test-2' });
    const child = await Category.create({
      tenantId: null,
      name: 'AI Content',
      slug: 'ai-content-test-2',
      parentId: parent._id,
    });
    await Product.create({
      name: 'AI Writer 2',
      slug: 'ai-writer-mkt-9',
      type: 'ai_tool',
      basePrice: 100,
      status: 'published',
      syncMode: 'global',
      categoryId: child._id,
    });
    await Product.create({
      name: 'Directly In Parent',
      slug: 'directly-in-parent-mkt-9',
      type: 'ai_tool',
      basePrice: 100,
      status: 'published',
      syncMode: 'global',
      categoryId: parent._id,
    });
    await Product.create({
      name: 'Unrelated Tool 2',
      slug: 'unrelated-tool-mkt-9',
      type: 'software',
      basePrice: 100,
      status: 'published',
      syncMode: 'global',
    });

    const token = signAccessToken({ sub: 'r1', role: 'reseller_admin', tenantId: tenant._id.toString() });
    const res = await request(app)
      .get(`/api/v1/reseller/marketplace?categoryId=${parent._id.toString()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const names = res.body.items.map((i: { name: string }) => i.name).sort();
    expect(names).toEqual(['AI Writer 2', 'Directly In Parent']);
  });
});
