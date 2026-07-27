import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { Tenant } from '../../src/models/Tenant';
import { Product } from '../../src/models/Product';
import { ResellerProduct } from '../../src/models/ResellerProduct';

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

describe('ResellerProduct model', () => {
  it('creates with defaults', async () => {
    const tenant = await Tenant.create({ name: 'A', subdomain: 'a' });
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    const rp = await ResellerProduct.create({ tenantId: tenant._id, productId: product._id });
    expect(rp.enabled).toBe(false);
    expect(rp.isFeatured).toBe(false);
    expect(rp.customPrice).toBeNull();
  });

  it('rejects a duplicate tenantId+productId pair', async () => {
    const tenant = await Tenant.create({ name: 'A', subdomain: 'a' });
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    await ResellerProduct.create({ tenantId: tenant._id, productId: product._id });
    await expect(
      ResellerProduct.create({ tenantId: tenant._id, productId: product._id })
    ).rejects.toThrow();
  });
});
