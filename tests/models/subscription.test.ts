import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { Tenant } from '../../src/models/Tenant';
import { Plan } from '../../src/models/Plan';
import { Subscription } from '../../src/models/Subscription';

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

describe('Subscription model', () => {
  it('creates with defaults', async () => {
    const tenant = await Tenant.create({ name: 'A', subdomain: 'a' });
    const plan = await Plan.create({ scope: 'reseller', name: 'Starter', price: 999, billingCycle: 'annual' });
    const subscription = await Subscription.create({ tenantId: tenant._id, planId: plan._id });
    expect(subscription.status).toBe('pending');
    expect(subscription.currentPeriodEnd).toBeNull();
    expect(subscription.paymentRef).toBeNull();
  });
});
