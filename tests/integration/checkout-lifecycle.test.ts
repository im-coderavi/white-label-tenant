jest.mock('../../src/common/cloudinary', () => ({
  uploadBuffer: jest.fn().mockResolvedValue({
    secureUrl: 'https://res.cloudinary.com/mock.png',
    publicId: 'toolzypro/mock',
  }),
}));
jest.mock('../../src/common/smtpEmail', () => ({
  smtpEmailService: { sendEmail: jest.fn().mockResolvedValue(undefined) },
}));

import crypto from 'crypto';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { createApp } from '../../src/app';
import { signAccessToken } from '../../src/common/jwt';
import { Tenant } from '../../src/models/Tenant';
import { User } from '../../src/models/User';
import { hashPassword } from '../../src/common/password';

function sign(rawBody: string): string {
  return crypto.createHmac('sha256', 'test-webhook-secret-please-ignore').update(rawBody).digest('hex');
}

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

describe('full checkout lifecycle', () => {
  const app = createApp();
  const masterToken = signAccessToken({ sub: new Types.ObjectId().toString(), role: 'master_admin', tenantId: null });

  it('checkout -> webhook -> order paid with license -> download', async () => {
    const productRes = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'Checkout Tool', type: 'software', basePrice: 300 });
    const productId = productRes.body.product._id;

    await request(app)
      .post(`/api/v1/admin/products/${productId}/versions`)
      .set('Authorization', `Bearer ${masterToken}`)
      .field('version', '1.0.0')
      .field('changelog', 'Initial')
      .attach('file', Buffer.from('fake file contents'), 'tool.zip');
    await request(app)
      .post(`/api/v1/admin/products/${productId}/publish`)
      .set('Authorization', `Bearer ${masterToken}`);

    await request(app)
      .post('/api/v1/admin/licenses/generate')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ productId, quantity: 1 });

    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-full-checkout' });
    await request(app)
      .patch(`/api/v1/admin/products/${productId}/sync-mode`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ syncMode: 'private', tenantId: tenant._id.toString() });

    const user = await User.create({
      tenantId: tenant._id,
      role: 'customer',
      email: 'buyer@example.com',
      passwordHash: await hashPassword('longenough1'),
      status: 'active',
    });
    const customerToken = signAccessToken({
      sub: user._id.toString(),
      role: 'customer',
      tenantId: tenant._id.toString(),
    });

    const checkoutRes = await request(app)
      .post('/api/v1/customer/checkout')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId });
    expect(checkoutRes.status).toBe(201);
    const { orderId, gatewayOrderId } = checkoutRes.body;

    const webhookBody = JSON.stringify({ gatewayOrderId, success: true });
    const webhookRes = await request(app)
      .post('/api/v1/customer/checkout/webhook')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sign(webhookBody))
      .send(webhookBody);
    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body.order.status).toBe('paid');
    expect(webhookRes.body.order.licenseId).not.toBeNull();

    const downloadRes = await request(app)
      .get(`/api/v1/customer/downloads/${orderId}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.body.fileUrl).toMatch(/^https:\/\/res\.cloudinary\.com/);
  });
});
