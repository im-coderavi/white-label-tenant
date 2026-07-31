import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { publicPlansRouter } from '../../src/modules/plans/public.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { Plan } from '../../src/models/Plan';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', publicPlansRouter);
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

describe('plans module — public listing', () => {
  const app = buildTestApp();

  it('only returns active reseller-scope plans', async () => {
    await Plan.create({ scope: 'reseller', name: 'Starter', price: 999, billingCycle: 'annual' });
    await Plan.create({
      scope: 'reseller',
      name: 'Archived Plan',
      price: 500,
      billingCycle: 'annual',
      status: 'archived',
    });
    await Plan.create({ scope: 'customer', name: 'Customer Plan', price: 200, billingCycle: 'monthly' });

    const res = await request(app).get('/api/v1/plans');
    expect(res.status).toBe(200);
    expect(res.body.plans).toHaveLength(1);
    expect(res.body.plans[0].name).toBe('Starter');
  });
});
