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
import { User } from '../../src/models/User';
import { EmailVerificationToken } from '../../src/models/EmailVerificationToken';

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

describe('POST /auth/register', () => {
  const app = buildTestApp();

  it('registers a customer under an existing tenant', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme', status: 'active' });
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ tenantSubdomain: 'acme', email: 'buyer@example.com', password: 'longenough1' });

    expect(res.status).toBe(201);
    expect(res.body.user.status).toBe('pending');

    const user = await User.findOne({ tenantId: tenant._id, email: 'buyer@example.com' });
    expect(user).not.toBeNull();
    expect(user!.passwordHash).not.toBe('longenough1');

    const verifyToken = await EmailVerificationToken.findOne({ userId: user!._id });
    expect(verifyToken).not.toBeNull();
  });

  it('404s for an unknown tenant subdomain', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ tenantSubdomain: 'nope', email: 'buyer@example.com', password: 'longenough1' });
    expect(res.status).toBe(404);
  });

  it('409s on duplicate email within the same tenant', async () => {
    await Tenant.create({ name: 'Acme', subdomain: 'acme', status: 'active' });
    await request(app)
      .post('/api/v1/auth/register')
      .send({ tenantSubdomain: 'acme', email: 'buyer@example.com', password: 'longenough1' });
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ tenantSubdomain: 'acme', email: 'buyer@example.com', password: 'longenough1' });
    expect(res.status).toBe(409);
  });

  it('400s on an invalid body', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ tenantSubdomain: 'acme', email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
  });
});
