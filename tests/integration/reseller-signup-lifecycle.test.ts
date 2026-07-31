jest.mock('../../src/common/smtpEmail', () => ({
  smtpEmailService: { sendEmail: jest.fn().mockResolvedValue(undefined) },
}));

import crypto from 'crypto';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { createApp } from '../../src/app';
import { signAccessToken } from '../../src/common/jwt';

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

describe('full reseller signup lifecycle', () => {
  const app = createApp();
  const masterToken = signAccessToken({ sub: new Types.ObjectId().toString(), role: 'master_admin', tenantId: null });

  it('admin creates a plan -> reseller registers -> webhook activates everything', async () => {
    const planRes = await request(app)
      .post('/api/v1/admin/plans')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ scope: 'reseller', name: 'Starter Annual', price: 999, billingCycle: 'annual' });
    expect(planRes.status).toBe(201);
    const planId = planRes.body.plan._id;

    const publicPlansRes = await request(app).get('/api/v1/plans');
    expect(publicPlansRes.status).toBe(200);
    expect(publicPlansRes.body.plans.some((p: { _id: string }) => p._id === planId)).toBe(true);

    const registerRes = await request(app).post('/api/v1/auth/register-reseller').send({
      businessName: 'Full Lifecycle Reseller',
      subdomain: 'full-lifecycle-reseller',
      email: 'owner@fulllifecycle.example',
      password: 'longenough1',
      planId,
    });
    expect(registerRes.status).toBe(201);
    const { tenantId, userId, subscriptionId, gatewayOrderId } = registerRes.body;

    const webhookBody = JSON.stringify({ gatewayOrderId, success: true });
    const webhookRes = await request(app)
      .post('/api/v1/auth/register-reseller/webhook')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sign(webhookBody))
      .send(webhookBody);
    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body.subscription.status).toBe('active');

    expect(tenantId).toBeDefined();
    expect(userId).toBeDefined();
    expect(subscriptionId).toBeDefined();
  });
});
