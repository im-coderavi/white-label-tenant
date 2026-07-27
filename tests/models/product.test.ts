import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { Product } from '../../src/models/Product';

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

describe('Product model', () => {
  it('creates a product with defaults', async () => {
    const product = await Product.create({
      name: 'Super Tool',
      slug: 'super-tool',
      type: 'software',
      basePrice: 999,
    });
    expect(product.status).toBe('draft');
    expect(product.currency).toBe('INR');
    expect(product.syncMode).toBe('optional');
    expect(product.currentVersion).toBeNull();
  });

  it('rejects a duplicate slug', async () => {
    await Product.create({ name: 'A', slug: 'dup', type: 'software', basePrice: 1 });
    await expect(
      Product.create({ name: 'B', slug: 'dup', type: 'theme', basePrice: 2 })
    ).rejects.toThrow();
  });

  it('rejects an invalid type', async () => {
    await expect(
      Product.create({ name: 'A', slug: 'a', type: 'not-a-type', basePrice: 1 })
    ).rejects.toThrow();
  });
});
