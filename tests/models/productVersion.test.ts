import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { Product } from '../../src/models/Product';
import { ProductVersion } from '../../src/models/ProductVersion';

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

describe('ProductVersion model', () => {
  it('creates a version linked to a product', async () => {
    const product = await Product.create({ name: 'A', slug: 'a', type: 'software', basePrice: 1 });
    const version = await ProductVersion.create({
      productId: product._id,
      version: '1.0.0',
      changelog: 'Initial release',
    });
    expect(version.productId.toString()).toBe(product._id.toString());
    expect(version.fileUrl).toBeNull();
  });
});
