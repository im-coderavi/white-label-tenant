import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { Tenant } from '../../src/models/Tenant';

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

describe('Tenant model', () => {
  it('creates a tenant with defaults', async () => {
    const tenant = await Tenant.create({ name: 'Acme Resell', subdomain: 'acme' });
    expect(tenant.plan).toBe('starter');
    expect(tenant.status).toBe('pending');
  });

  it('rejects a duplicate subdomain', async () => {
    await Tenant.create({ name: 'Acme Resell', subdomain: 'acme' });
    await expect(Tenant.create({ name: 'Other', subdomain: 'acme' })).rejects.toThrow();
  });
});
