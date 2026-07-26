import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from './helpers/db';
import { createApp } from '../src/app';
import { Tenant } from '../src/models/Tenant';
import { signAccessToken } from '../src/common/jwt';

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

describe('full app wiring', () => {
  const app = createApp();

  it('serves health, auth, tenants, and users routes on one app', async () => {
    const health = await request(app).get('/health');
    expect(health.status).toBe(200);

    const masterToken = signAccessToken({ sub: new Types.ObjectId().toString(), role: 'master_admin', tenantId: null });
    const createTenant = await request(app)
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'Acme', subdomain: 'acme' });
    expect(createTenant.status).toBe(201);

    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ tenantSubdomain: 'acme', email: 'buyer@example.com', password: 'longenough1' });
    expect(registerRes.status).toBe(201);

    const tenantDoc = await Tenant.findOne({ subdomain: 'acme' });
    const resellerToken = signAccessToken({
      sub: new Types.ObjectId().toString(),
      role: 'reseller_admin',
      tenantId: tenantDoc!._id.toString(),
    });
    const usersRes = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${resellerToken}`);
    expect(usersRes.status).toBe(200);
    expect(usersRes.body.users).toHaveLength(1);
  });
});
