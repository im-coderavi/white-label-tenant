import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { Plan } from '../../src/models/Plan';

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

describe('Plan model', () => {
  it('creates with defaults', async () => {
    const plan = await Plan.create({
      scope: 'reseller',
      name: 'Starter Annual',
      price: 999,
      billingCycle: 'annual',
    });
    expect(plan.currency).toBe('INR');
    expect(plan.status).toBe('active');
    expect(plan.featureFlagsJson).toEqual({});
    expect(plan.limitsJson).toEqual({});
  });

  it('rejects an invalid billingCycle', async () => {
    await expect(
      Plan.create({ scope: 'reseller', name: 'Bad', price: 1, billingCycle: 'weekly' })
    ).rejects.toThrow();
  });
});
