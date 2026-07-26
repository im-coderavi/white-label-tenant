import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { authRouter } from '../../src/modules/auth/auth.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { Tenant } from '../../src/models/Tenant';
import { User } from '../../src/models/User';
import { EmailVerificationToken } from '../../src/models/EmailVerificationToken';
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

describe('POST /auth/verify-email', () => {
  const app = buildTestApp();

  it('activates a pending user with a valid token', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme', status: 'active' });
    const user = await User.create({
      tenantId: tenant._id,
      role: 'customer',
      email: 'buyer@example.com',
      passwordHash: 'x',
      status: 'pending',
    });
    const rawToken = generateOpaqueToken();
    await EmailVerificationToken.create({
      userId: user._id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + 60000),
      used: false,
    });

    const res = await request(app).post('/api/v1/auth/verify-email').send({ token: rawToken });
    expect(res.status).toBe(200);

    const updated = await User.findById(user._id);
    expect(updated!.status).toBe('active');
  });

  it('401s on an already-used token', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme', status: 'active' });
    const user = await User.create({
      tenantId: tenant._id,
      role: 'customer',
      email: 'buyer@example.com',
      passwordHash: 'x',
      status: 'pending',
    });
    const rawToken = generateOpaqueToken();
    await EmailVerificationToken.create({
      userId: user._id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + 60000),
      used: true,
    });

    const res = await request(app).post('/api/v1/auth/verify-email').send({ token: rawToken });
    expect(res.status).toBe(401);
  });
});
