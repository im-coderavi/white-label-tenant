import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { plansRouter } from '../../src/modules/plans/plans.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Plan } from '../../src/models/Plan';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin/plans', plansRouter);
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

describe('plans module — admin CRUD', () => {
  const app = buildTestApp();
  const masterToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });
  const customerToken = signAccessToken({ sub: 'cust-1', role: 'customer', tenantId: 'tenant-x' });

  it('rejects non-master_admin roles', async () => {
    const res = await request(app)
      .get('/api/v1/admin/plans')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('creates, updates, and archives a plan', async () => {
    const createRes = await request(app)
      .post('/api/v1/admin/plans')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ scope: 'reseller', name: 'Starter Annual', price: 999, billingCycle: 'annual' });
    expect(createRes.status).toBe(201);
    const planId = createRes.body.plan._id;

    const updateRes = await request(app)
      .patch(`/api/v1/admin/plans/${planId}`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ price: 1099 });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.plan.price).toBe(1099);

    const archiveRes = await request(app)
      .delete(`/api/v1/admin/plans/${planId}`)
      .set('Authorization', `Bearer ${masterToken}`);
    expect(archiveRes.status).toBe(200);
    expect(archiveRes.body.plan.status).toBe('archived');
  });

  it('lists all plans', async () => {
    await Plan.create({ scope: 'reseller', name: 'Starter', price: 999, billingCycle: 'annual' });
    await Plan.create({ scope: 'reseller', name: 'Ultimate Lifetime', price: 14999, billingCycle: 'lifetime' });

    const res = await request(app)
      .get('/api/v1/admin/plans')
      .set('Authorization', `Bearer ${masterToken}`);
    expect(res.status).toBe(200);
    expect(res.body.plans).toHaveLength(2);
  });
});
