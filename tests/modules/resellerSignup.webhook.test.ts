jest.mock('../../src/common/smtpEmail', () => ({
  smtpEmailService: { sendEmail: jest.fn().mockResolvedValue(undefined) },
}));

import crypto from 'crypto';
import mongoose from 'mongoose';
import express, { Request } from 'express';
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
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as Request).rawBody = buf;
      },
    })
  );
  app.use('/api/v1/auth', resellerSignupRouter);
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

describe('reseller signup — webhook', () => {
  const app = buildTestApp();

  it('400s on an invalid signature', async () => {
    const body = JSON.stringify({ gatewayOrderId: 'mock_order_x', success: true });
    const res = await request(app)
      .post('/api/v1/auth/register-reseller/webhook')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', 'wrong-signature')
      .send(body);
    expect(res.status).toBe(400);
  });

  it('activates tenant, user, and subscription for an annual plan', async () => {
    const plan = await Plan.create({
      scope: 'reseller',
      name: 'Starter Annual',
      price: 999,
      billingCycle: 'annual',
    });
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-webhook-signup', status: 'pending' });
    await User.create({
      tenantId: tenant._id,
      role: 'reseller_admin',
      email: 'owner@acme.example',
      passwordHash: 'x',
      status: 'pending',
    });
    const subscription = await Subscription.create({
      tenantId: tenant._id,
      planId: plan._id,
      status: 'pending',
      paymentRef: 'mock_order_signuptest',
    });

    const body = JSON.stringify({ gatewayOrderId: 'mock_order_signuptest', success: true });
    const res = await request(app)
      .post('/api/v1/auth/register-reseller/webhook')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sign(body))
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.subscription.status).toBe('active');
    expect(res.body.subscription.currentPeriodEnd).not.toBeNull();

    const updatedTenant = await Tenant.findById(tenant._id);
    expect(updatedTenant!.status).toBe('active');
    const updatedUser = await User.findOne({ tenantId: tenant._id, role: 'reseller_admin' });
    expect(updatedUser!.status).toBe('active');
    const updatedSub = await Subscription.findById(subscription._id);
    const expectedYear = new Date().getFullYear() + 1;
    expect(updatedSub!.currentPeriodEnd!.getFullYear()).toBe(expectedYear);
  });

  it('sets currentPeriodEnd to null for a lifetime plan', async () => {
    const plan = await Plan.create({
      scope: 'reseller',
      name: 'Ultimate Lifetime',
      price: 14999,
      billingCycle: 'lifetime',
    });
    const tenant = await Tenant.create({ name: 'Acme2', subdomain: 'acme-webhook-lifetime', status: 'pending' });
    await User.create({
      tenantId: tenant._id,
      role: 'reseller_admin',
      email: 'owner2@acme.example',
      passwordHash: 'x',
      status: 'pending',
    });
    await Subscription.create({
      tenantId: tenant._id,
      planId: plan._id,
      status: 'pending',
      paymentRef: 'mock_order_lifetimetest',
    });

    const body = JSON.stringify({ gatewayOrderId: 'mock_order_lifetimetest', success: true });
    const res = await request(app)
      .post('/api/v1/auth/register-reseller/webhook')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sign(body))
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.subscription.currentPeriodEnd).toBeNull();
  });

  it('cancels the subscription without activating tenant/user on failure', async () => {
    const plan = await Plan.create({
      scope: 'reseller',
      name: 'Starter Annual',
      price: 999,
      billingCycle: 'annual',
    });
    const tenant = await Tenant.create({ name: 'Acme3', subdomain: 'acme-webhook-fail', status: 'pending' });
    await User.create({
      tenantId: tenant._id,
      role: 'reseller_admin',
      email: 'owner3@acme.example',
      passwordHash: 'x',
      status: 'pending',
    });
    await Subscription.create({
      tenantId: tenant._id,
      planId: plan._id,
      status: 'pending',
      paymentRef: 'mock_order_failtest',
    });

    const body = JSON.stringify({ gatewayOrderId: 'mock_order_failtest', success: false });
    const res = await request(app)
      .post('/api/v1/auth/register-reseller/webhook')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sign(body))
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.subscription.status).toBe('cancelled');

    const updatedTenant = await Tenant.findById(tenant._id);
    expect(updatedTenant!.status).toBe('pending');
  });
});
