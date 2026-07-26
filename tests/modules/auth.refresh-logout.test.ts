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

async function loginAndGetTokens(app: express.Express) {
  const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme', status: 'active' });
  await User.create({
    tenantId: tenant._id,
    role: 'customer',
    email: 'buyer@example.com',
    passwordHash: await hashPassword('longenough1'),
    status: 'active',
  });
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ tenantSubdomain: 'acme', email: 'buyer@example.com', password: 'longenough1' });
  return loginRes.body as { accessToken: string; refreshToken: string };
}

describe('POST /auth/refresh and /auth/logout', () => {
  const app = buildTestApp();

  it('rotates the refresh token and issues a new access token', async () => {
    const { refreshToken } = await loginAndGetTokens(app);
    const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.refreshToken).not.toBe(refreshToken);

    const reuse = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(reuse.status).toBe(401);
  });

  it('revokes the refresh token on logout, blocking future refresh', async () => {
    const { refreshToken } = await loginAndGetTokens(app);
    const logoutRes = await request(app).post('/api/v1/auth/logout').send({ refreshToken });
    expect(logoutRes.status).toBe(204);

    const refreshRes = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(refreshRes.status).toBe(401);
  });
});
