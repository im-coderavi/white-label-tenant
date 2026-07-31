import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { resellerSignupRouter } from '../../src/modules/resellerSignup/resellerSignup.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { Plan } from '../../src/models/Plan';
import { Tenant } from '../../src/models/Tenant';
import { User } from '../../src/models/User';
import { Subscription } from '../../src/models/Subscription';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', resellerSignupRouter);
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

describe('reseller signup — register', () => {
  const app = buildTestApp();

  it('creates a pending tenant, user, and subscription with a gateway reference', async () => {
    const plan = await Plan.create({
      scope: 'reseller',
      name: 'Starter Annual',
      price: 999,
      billingCycle: 'annual',
    });

    const res = await request(app).post('/api/v1/auth/register-reseller').send({
      businessName: 'Acme Resell',
      subdomain: 'acme-resell',
      email: 'owner@acme.example',
      password: 'longenough1',
      planId: plan._id.toString(),
    });
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(999);
    expect(res.body.gatewayOrderId).toMatch(/^mock_order_/);

    const tenant = await Tenant.findById(res.body.tenantId);
    expect(tenant!.status).toBe('pending');
    const user = await User.findById(res.body.userId);
    expect(user!.status).toBe('pending');
    expect(user!.role).toBe('reseller_admin');
    const subscription = await Subscription.findById(res.body.subscriptionId);
    expect(subscription!.status).toBe('pending');
    expect(subscription!.paymentRef).toBe(res.body.gatewayOrderId);
  });

  it('404s for an unknown plan', async () => {
    const res = await request(app).post('/api/v1/auth/register-reseller').send({
      businessName: 'Acme Resell',
      subdomain: 'acme-resell-2',
      email: 'owner2@acme.example',
      password: 'longenough1',
      planId: '64b000000000000000000000',
    });
    expect(res.status).toBe(404);
  });

  it('409s for a taken subdomain', async () => {
    const plan = await Plan.create({
      scope: 'reseller',
      name: 'Starter Annual',
      price: 999,
      billingCycle: 'annual',
    });
    await Tenant.create({ name: 'Existing', subdomain: 'taken-subdomain' });

    const res = await request(app).post('/api/v1/auth/register-reseller').send({
      businessName: 'Acme Resell',
      subdomain: 'taken-subdomain',
      email: 'owner3@acme.example',
      password: 'longenough1',
      planId: plan._id.toString(),
    });
    expect(res.status).toBe(409);
  });
});
