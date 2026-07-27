import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { Tenant } from '../../src/models/Tenant';
import { Product } from '../../src/models/Product';
import { ResellerProduct } from '../../src/models/ResellerProduct';
import { syncProductToTenants } from '../../src/modules/products/products.service';

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

describe('syncProductToTenants', () => {
  it('enables a global product for every tenant', async () => {
    await Tenant.create({ name: 'A', subdomain: 'a' });
    await Tenant.create({ name: 'B', subdomain: 'b' });
    const product = await Product.create({
      name: 'P',
      slug: 'p',
      type: 'software',
      basePrice: 10,
      syncMode: 'global',
    });

    await syncProductToTenants(product);

    const rows = await ResellerProduct.find({ productId: product._id });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.enabled)).toBe(true);
  });

  it('does nothing for optional mode', async () => {
    await Tenant.create({ name: 'A', subdomain: 'a' });
    const product = await Product.create({
      name: 'P',
      slug: 'p',
      type: 'software',
      basePrice: 10,
      syncMode: 'optional',
    });

    await syncProductToTenants(product);

    const rows = await ResellerProduct.find({ productId: product._id });
    expect(rows).toHaveLength(0);
  });

  it('enables only the assigned tenant for private mode and disables others', async () => {
    const tenantA = await Tenant.create({ name: 'A', subdomain: 'a' });
    const tenantB = await Tenant.create({ name: 'B', subdomain: 'b' });
    const product = await Product.create({
      name: 'P',
      slug: 'p',
      type: 'software',
      basePrice: 10,
      syncMode: 'global',
    });
    await syncProductToTenants(product);

    product.syncMode = 'private';
    product.tenantId = tenantA._id;
    await product.save();
    await syncProductToTenants(product);

    const rowA = await ResellerProduct.findOne({ tenantId: tenantA._id, productId: product._id });
    const rowB = await ResellerProduct.findOne({ tenantId: tenantB._id, productId: product._id });
    expect(rowA!.enabled).toBe(true);
    expect(rowB!.enabled).toBe(false);
  });

  it('moving private assignment from tenant A to tenant B disables A and enables B', async () => {
    const tenantA = await Tenant.create({ name: 'A', subdomain: 'a' });
    const tenantB = await Tenant.create({ name: 'B', subdomain: 'b' });
    const product = await Product.create({
      name: 'P',
      slug: 'p',
      type: 'software',
      basePrice: 10,
      syncMode: 'private',
      tenantId: tenantA._id,
    });
    await syncProductToTenants(product);

    product.tenantId = tenantB._id;
    await product.save();
    await syncProductToTenants(product);

    const rowA = await ResellerProduct.findOne({ tenantId: tenantA._id, productId: product._id });
    const rowB = await ResellerProduct.findOne({ tenantId: tenantB._id, productId: product._id });
    expect(rowA!.enabled).toBe(false);
    expect(rowB!.enabled).toBe(true);
  });
});
