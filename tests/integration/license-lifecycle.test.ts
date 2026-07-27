import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { createApp } from '../../src/app';
import { signAccessToken } from '../../src/common/jwt';
import { Tenant } from '../../src/models/Tenant';
import { User } from '../../src/models/User';
import { hashPassword } from '../../src/common/password';

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

describe('full license lifecycle', () => {
  const app = createApp();
  const masterToken = signAccessToken({ sub: new Types.ObjectId().toString(), role: 'master_admin', tenantId: null });

  it('generate -> assign -> activate -> activate again fails once limit reached', async () => {
    const productRes = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'Licensed Tool', type: 'software', basePrice: 200 });
    expect(productRes.status).toBe(201);
    const productId = productRes.body.product._id;

    const generateRes = await request(app)
      .post('/api/v1/admin/licenses/generate')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ productId, quantity: 1 });
    expect(generateRes.status).toBe(201);
    const licenseId = generateRes.body.licenses[0]._id;

    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-license' });
    const user = await User.create({
      tenantId: tenant._id,
      role: 'customer',
      email: 'buyer@example.com',
      passwordHash: await hashPassword('longenough1'),
      status: 'active',
    });

    const assignRes = await request(app)
      .post(`/api/v1/admin/licenses/${licenseId}/assign`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ userId: user._id.toString() });
    expect(assignRes.status).toBe(200);
    expect(assignRes.body.license.status).toBe('assigned');

    const customerToken = signAccessToken({
      sub: user._id.toString(),
      role: 'customer',
      tenantId: tenant._id.toString(),
    });

    const listRes = await request(app)
      .get('/api/v1/customer/licenses')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.licenses).toHaveLength(1);

    const activateRes = await request(app)
      .post(`/api/v1/customer/licenses/${licenseId}/activate`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(activateRes.status).toBe(200);
    expect(activateRes.body.license.status).toBe('activated');

    const secondActivateRes = await request(app)
      .post(`/api/v1/customer/licenses/${licenseId}/activate`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(secondActivateRes.status).toBe(409);
  });
});
