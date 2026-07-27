import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { Product } from '../../src/models/Product';
import { License } from '../../src/models/License';

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

describe('License model', () => {
  it('creates with defaults', async () => {
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    const license = await License.create({ productId: product._id, key: 'TZP-2026-ABCD1234' });
    expect(license.status).toBe('available');
    expect(license.activationLimit).toBe(1);
    expect(license.activationsUsed).toBe(0);
    expect(license.tenantId).toBeNull();
    expect(license.assignedUserId).toBeNull();
  });

  it('rejects a duplicate key', async () => {
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    await License.create({ productId: product._id, key: 'TZP-2026-DUPEKEY1' });
    await expect(License.create({ productId: product._id, key: 'TZP-2026-DUPEKEY1' })).rejects.toThrow();
  });
});
