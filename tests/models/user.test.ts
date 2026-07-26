import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { Tenant } from '../../src/models/Tenant';
import { User } from '../../src/models/User';

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

describe('User model', () => {
  it('allows the same email under different tenants', async () => {
    const tenantA = await Tenant.create({ name: 'A', subdomain: 'a' });
    const tenantB = await Tenant.create({ name: 'B', subdomain: 'b' });
    await User.create({ tenantId: tenantA._id, role: 'customer', email: 'same@example.com', passwordHash: 'x' });
    await expect(
      User.create({ tenantId: tenantB._id, role: 'customer', email: 'same@example.com', passwordHash: 'x' })
    ).resolves.toBeDefined();
  });

  it('rejects a duplicate email within the same tenant', async () => {
    const tenant = await Tenant.create({ name: 'A', subdomain: 'a' });
    await User.create({ tenantId: tenant._id, role: 'customer', email: 'dup@example.com', passwordHash: 'x' });
    await expect(
      User.create({ tenantId: tenant._id, role: 'customer', email: 'dup@example.com', passwordHash: 'x' })
    ).rejects.toThrow();
  });
});
