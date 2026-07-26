import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { authRouter } from '../../src/modules/auth/auth.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { Tenant } from '../../src/models/Tenant';
import { hashPassword } from '../../src/common/password';
import { User } from '../../src/models/User';

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

describe('POST /auth/login', () => {
  const app = buildTestApp();

  it('logs in with correct credentials and returns tokens', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme', status: 'active' });
    await User.create({
      tenantId: tenant._id,
      role: 'customer',
      email: 'buyer@example.com',
      passwordHash: await hashPassword('longenough1'),
      status: 'active',
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ tenantSubdomain: 'acme', email: 'buyer@example.com', password: 'longenough1' });

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
    expect(typeof res.body.refreshToken).toBe('string');
  });

  it('401s on wrong password', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme', status: 'active' });
    await User.create({
      tenantId: tenant._id,
      role: 'customer',
      email: 'buyer@example.com',
      passwordHash: await hashPassword('longenough1'),
      status: 'active',
    });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ tenantSubdomain: 'acme', email: 'buyer@example.com', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('401s for a suspended user', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme', status: 'active' });
    await User.create({
      tenantId: tenant._id,
      role: 'customer',
      email: 'buyer@example.com',
      passwordHash: await hashPassword('longenough1'),
      status: 'suspended',
    });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ tenantSubdomain: 'acme', email: 'buyer@example.com', password: 'longenough1' });
    expect(res.status).toBe(401);
  });
});
