const sendMailMock = jest.fn().mockResolvedValue({ messageId: 'test-id' });
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: sendMailMock })),
}));

import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { grantAgencyPlan } from '../helpers/plans';
import { resellerSettingsRouter } from '../../src/modules/resellerSettings/resellerSettings.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Tenant } from '../../src/models/Tenant';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/reseller', resellerSettingsRouter);
  app.use(errorMiddleware);
  return app;
}

beforeAll(async () => {
  const uri = await startTestDb();
  await mongoose.connect(uri);
});

afterEach(async () => {
  await clearTestDb();
  sendMailMock.mockClear();
});

afterAll(async () => {
  await stopTestDb();
});

describe('resellerSettings module — payment gateway + SMTP', () => {
  const app = buildTestApp();

  it('saves Razorpay credentials, encrypting the secret and masking it in the response', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-pg-1' });
    await grantAgencyPlan(tenant._id);
    const token = signAccessToken({ sub: 'r1', role: 'reseller_admin', tenantId: tenant._id.toString() });

    const res = await request(app)
      .patch('/api/v1/reseller/payment-gateway')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'razorpay', keyId: 'rzp_test_abc', keySecret: 'super-secret' });

    expect(res.status).toBe(200);
    expect(res.body.store.paymentGateway.keyId).toBe('rzp_test_abc');
    expect(res.body.store.paymentGateway.keySecretEncrypted).toBeUndefined();
    expect(res.body.store.paymentGateway.keySecretEncryptedSet).toBe(true);

    const stored = await Tenant.findById(tenant._id);
    expect(stored!.paymentGatewayJson.keySecretEncrypted).not.toBe('super-secret');
  });

  it('rejects an unsupported provider', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-pg-2' });
    await grantAgencyPlan(tenant._id);
    const token = signAccessToken({ sub: 'r1', role: 'reseller_admin', tenantId: tenant._id.toString() });

    const res = await request(app)
      .patch('/api/v1/reseller/payment-gateway')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'stripe', keyId: 'x', keySecret: 'y' });

    expect(res.status).toBe(400);
  });

  it('saves SMTP config, encrypting the password and masking it in the response', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-smtp-1' });
    await grantAgencyPlan(tenant._id);
    const token = signAccessToken({ sub: 'r1', role: 'reseller_admin', tenantId: tenant._id.toString() });

    const res = await request(app)
      .patch('/api/v1/reseller/smtp')
      .set('Authorization', `Bearer ${token}`)
      .send({ host: 'smtp.acme.com', port: 587, user: 'acme', password: 'pw123', fromEmail: 'hi@acme.com' });

    expect(res.status).toBe(200);
    expect(res.body.store.smtpConfig.host).toBe('smtp.acme.com');
    expect(res.body.store.smtpConfig.passwordEncrypted).toBeUndefined();
    expect(res.body.store.smtpConfig.passwordEncryptedSet).toBe(true);
  });

  it('sends a test email using the tenant SMTP config', async () => {
    const tenant = await Tenant.create({
      name: 'Acme',
      subdomain: 'acme-smtp-2',
      smtpConfigJson: { host: 'smtp.acme.com', port: 587, fromEmail: 'hi@acme.com' },
    });
    await grantAgencyPlan(tenant._id);
    const token = signAccessToken({ sub: 'r1', role: 'reseller_admin', tenantId: tenant._id.toString() });

    const res = await request(app)
      .post('/api/v1/reseller/smtp/test')
      .set('Authorization', `Bearer ${token}`)
      .send({ to: 'me@acme.com' });

    expect(res.status).toBe(200);
    expect(res.body.sent).toBe(true);
    expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({ to: 'me@acme.com' }));
  });

  it('rejects an invalid test email address', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-smtp-3' });
    await grantAgencyPlan(tenant._id);
    const token = signAccessToken({ sub: 'r1', role: 'reseller_admin', tenantId: tenant._id.toString() });

    const res = await request(app)
      .post('/api/v1/reseller/smtp/test')
      .set('Authorization', `Bearer ${token}`)
      .send({ to: 'not-an-email' });

    expect(res.status).toBe(400);
  });
});
