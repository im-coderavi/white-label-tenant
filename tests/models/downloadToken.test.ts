import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { Tenant } from '../../src/models/Tenant';
import { User } from '../../src/models/User';
import { Product } from '../../src/models/Product';
import { Order } from '../../src/models/Order';
import { DownloadToken } from '../../src/models/DownloadToken';

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

describe('DownloadToken model', () => {
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

    const token = await DownloadToken.create({
      orderId: order._id,
      fileUrl: 'https://res.cloudinary.com/x.zip',
      expiresAt: new Date(Date.now() + 60000),
    });
    expect(token.used).toBe(false);
    expect(token.ipAddress).toBeNull();
  });
});
