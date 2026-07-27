import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { Tenant } from '../../src/models/Tenant';
import { User } from '../../src/models/User';
import { Product } from '../../src/models/Product';
import { Order } from '../../src/models/Order';

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

describe('Order model', () => {
  it('creates with defaults', async () => {
    const tenant = await Tenant.create({ name: 'A', subdomain: 'a' });
    const user = await User.create({
      tenantId: tenant._id,
      role: 'customer',
      email: 'buyer@example.com',
      passwordHash: 'x',
    });
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });

    const order = await Order.create({
      tenantId: tenant._id,
      customerUserId: user._id,
      productId: product._id,
      orderType: 'single_product',
      amount: 10,
    });
    expect(order.status).toBe('pending');
    expect(order.currency).toBe('INR');
    expect(order.paymentRef).toBeNull();
    expect(order.licenseId).toBeNull();
  });
});
