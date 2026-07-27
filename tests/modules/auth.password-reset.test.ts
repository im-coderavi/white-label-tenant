jest.mock('../../src/common/smtpEmail', () => ({
  smtpEmailService: { sendEmail: jest.fn().mockResolvedValue(undefined) },
}));

import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { authRouter } from '../../src/modules/auth/auth.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { Tenant } from '../../src/models/Tenant';
import { hashPassword, comparePassword } from '../../src/common/password';
import { User } from '../../src/models/User';
import { PasswordResetToken } from '../../src/models/PasswordResetToken';
import { generateOpaqueToken, hashToken } from '../../src/common/token';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRouter);
  app.use(errorMiddleware);
  return app;
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

describe('forgot-password + reset-password', () => {
  const app = buildTestApp();

  it('issues a reset token on forgot-password and resets the password with it', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme', status: 'active' });
    const user = await User.create({
      tenantId: tenant._id,
      role: 'customer',
      email: 'buyer@example.com',
      passwordHash: await hashPassword('oldpassword1'),
      status: 'active',
    });

    const forgotRes = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ tenantSubdomain: 'acme', email: 'buyer@example.com' });
    expect(forgotRes.status).toBe(200);

    const record = await PasswordResetToken.findOne({ userId: user._id });
    expect(record).not.toBeNull();

    // Simulate receiving the raw token via email by overwriting the stored hash with one
    // we control, since the raw token is only ever known to the email recipient in practice.
    const rawTokenForTest = generateOpaqueToken();
    record!.tokenHash = hashToken(rawTokenForTest);
    await record!.save();

    const resetRes = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: rawTokenForTest, newPassword: 'newpassword1' });
    expect(resetRes.status).toBe(200);

    const updated = await User.findById(user._id);
    await expect(comparePassword('newpassword1', updated!.passwordHash)).resolves.toBe(true);
  });

  it('does not leak whether an email exists', async () => {
    await Tenant.create({ name: 'Acme', subdomain: 'acme', status: 'active' });
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ tenantSubdomain: 'acme', email: 'nobody@example.com' });
    expect(res.status).toBe(200);
  });

  it('401s on an invalid reset token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'not-a-real-token', newPassword: 'newpassword1' });
    expect(res.status).toBe(401);
  });
});
