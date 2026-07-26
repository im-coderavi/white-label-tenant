import mongoose, { Types } from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { usersRouter } from '../../src/modules/users/users.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Tenant } from '../../src/models/Tenant';
import { User } from '../../src/models/User';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/users', usersRouter);
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

describe('users module — tenant isolation', () => {
  const app = buildTestApp();

  it("only returns users belonging to the caller's own tenant", async () => {
    const tenantA = await Tenant.create({ name: 'A', subdomain: 'a' });
    const tenantB = await Tenant.create({ name: 'B', subdomain: 'b' });
    await User.create({ tenantId: tenantA._id, role: 'customer', email: 'a1@example.com', passwordHash: 'x' });
    await User.create({ tenantId: tenantA._id, role: 'customer', email: 'a2@example.com', passwordHash: 'x' });
    await User.create({ tenantId: tenantB._id, role: 'customer', email: 'b1@example.com', passwordHash: 'x' });

    const tokenForA = signAccessToken({
      sub: new Types.ObjectId().toString(),
      role: 'reseller_admin',
      tenantId: tenantA._id.toString(),
    });

    const res = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${tokenForA}`);
    expect(res.status).toBe(200);
    const emails = res.body.users.map((u: { email: string }) => u.email).sort();
    expect(emails).toEqual(['a1@example.com', 'a2@example.com']);
  });

  it('rejects a customer-role caller', async () => {
    const tokenForCustomer = signAccessToken({
      sub: new Types.ObjectId().toString(),
      role: 'customer',
      tenantId: new Types.ObjectId().toString(),
    });
    const res = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${tokenForCustomer}`);
    expect(res.status).toBe(403);
  });
});
