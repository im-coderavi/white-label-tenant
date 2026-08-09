import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { grantAgencyPlan } from '../helpers/plans';
import { ownProductsRouter } from '../../src/modules/ownProducts/ownProducts.routes';
import { storefrontRouter } from '../../src/modules/storefront/storefront.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Tenant } from '../../src/models/Tenant';
import { Plan } from '../../src/models/Plan';
import { Subscription } from '../../src/models/Subscription';
import { OwnProduct } from '../../src/models/OwnProduct';
import { STARTER_FLAGS, PREMIUM_FLAGS } from '../../src/common/planEntitlements';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/reseller/own-products', ownProductsRouter);
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

async function grantPremiumPlan(tenantId: any, maxOwnProducts = 25) {
  const plan = await Plan.create({
    scope: 'reseller',
    name: 'Premium-Test',
    price: 2999,
    billingCycle: 'monthly',
    featureFlagsJson: PREMIUM_FLAGS,
    limitsJson: { maxOwnProducts },
  });
  await Subscription.create({ tenantId, planId: plan._id, status: 'active' });
}

describe('ownProducts module', () => {
  const app = buildTestApp();

  it('creates and lists a reseller-owned product', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-own-1' });
    await grantPremiumPlan(tenant._id);
    const token = signAccessToken({ sub: 'r1', role: 'reseller_admin', tenantId: tenant._id.toString() });

    const createRes = await request(app)
      .post('/api/v1/reseller/own-products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My Custom Toolkit', price: 499, description: 'Built by me' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.product.name).toBe('My Custom Toolkit');
    expect(createRes.body.product.status).toBe('draft');

    const listRes = await request(app)
      .get('/api/v1/reseller/own-products')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.products).toHaveLength(1);
  });

  it('blocks creating own products on a plan without canAddOwnProducts (Starter)', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-own-2' });
    const plan = await Plan.create({
      scope: 'reseller',
      name: 'Starter-Test',
      price: 999,
      billingCycle: 'monthly',
      featureFlagsJson: STARTER_FLAGS,
    });
    await Subscription.create({ tenantId: tenant._id, planId: plan._id, status: 'active' });
    const token = signAccessToken({ sub: 'r1', role: 'reseller_admin', tenantId: tenant._id.toString() });

    const res = await request(app)
      .post('/api/v1/reseller/own-products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Should Not Work', price: 100 });

    expect(res.status).toBe(403);
  });

  it('enforces the maxOwnProducts limit', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-own-3' });
    await grantPremiumPlan(tenant._id, 1);
    const token = signAccessToken({ sub: 'r1', role: 'reseller_admin', tenantId: tenant._id.toString() });

    const first = await request(app)
      .post('/api/v1/reseller/own-products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'First Product', price: 100 });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/v1/reseller/own-products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Second Product', price: 100 });
    expect(second.status).toBe(409);
  });

  it('updates and publishes an own product, then it appears on the public storefront', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-own-4' });
    await grantAgencyPlan(tenant._id);
    const token = signAccessToken({ sub: 'r1', role: 'reseller_admin', tenantId: tenant._id.toString() });

    const createRes = await request(app)
      .post('/api/v1/reseller/own-products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Publishable Kit', price: 299 });
    const productId = createRes.body.product._id;

    const publishRes = await request(app)
      .patch(`/api/v1/reseller/own-products/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'published' });
    expect(publishRes.status).toBe(200);
    expect(publishRes.body.product.status).toBe('published');

    const customerToken = signAccessToken({ sub: 'cust-1', role: 'customer', tenantId: tenant._id.toString() });
    const storeRes = await request(app)
      .get('/api/v1/customer/products')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(storeRes.status).toBe(200);
    const ownItem = storeRes.body.items.find((i: { name: string }) => i.name === 'Publishable Kit');
    expect(ownItem).toBeDefined();
    expect(ownItem.source).toBe('own');
  });

  it('does not list a draft own product on the storefront', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-own-5' });
    await grantAgencyPlan(tenant._id);
    await OwnProduct.create({ tenantId: tenant._id, name: 'Draft Kit', slug: 'draft-kit', price: 100, status: 'draft' });

    const customerToken = signAccessToken({ sub: 'cust-1', role: 'customer', tenantId: tenant._id.toString() });
    const storeRes = await request(app)
      .get('/api/v1/customer/products')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(storeRes.body.items.find((i: { name: string }) => i.name === 'Draft Kit')).toBeUndefined();
  });

  it('deletes an own product', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-own-6' });
    await grantAgencyPlan(tenant._id);
    const token = signAccessToken({ sub: 'r1', role: 'reseller_admin', tenantId: tenant._id.toString() });

    const createRes = await request(app)
      .post('/api/v1/reseller/own-products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Deletable Kit', price: 50 });
    const productId = createRes.body.product._id;

    const deleteRes = await request(app)
      .delete(`/api/v1/reseller/own-products/${productId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(204);

    const listRes = await request(app)
      .get('/api/v1/reseller/own-products')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.body.products).toHaveLength(0);
  });

  it('scopes own products strictly per tenant', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-own-7' });
    await grantAgencyPlan(tenant._id);
    const otherTenant = await Tenant.create({ name: 'Other', subdomain: 'other-own-7' });
    await OwnProduct.create({ tenantId: otherTenant._id, name: 'Not Mine', slug: 'not-mine', price: 10 });

    const token = signAccessToken({ sub: 'r1', role: 'reseller_admin', tenantId: tenant._id.toString() });
    const listRes = await request(app)
      .get('/api/v1/reseller/own-products')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.body.products).toHaveLength(0);
  });
});
