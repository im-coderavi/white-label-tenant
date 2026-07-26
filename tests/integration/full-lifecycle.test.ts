import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { createApp } from '../../src/app';
import { signAccessToken } from '../../src/common/jwt';
import { EmailVerificationToken } from '../../src/models/EmailVerificationToken';

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

describe('full auth lifecycle', () => {
  const app = createApp();

  it('register -> verify -> login -> me -> refresh -> logout -> refresh fails', async () => {
    const masterToken = signAccessToken({ sub: new Types.ObjectId().toString(), role: 'master_admin', tenantId: null });
    await request(app)
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'Acme', subdomain: 'acme' });

    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ tenantSubdomain: 'acme', email: 'buyer@example.com', password: 'longenough1' });
    expect(registerRes.status).toBe(201);

    const verifyRecord = await EmailVerificationToken.findOne({ userId: registerRes.body.user.id });
    expect(verifyRecord).not.toBeNull();

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ tenantSubdomain: 'acme', email: 'buyer@example.com', password: 'longenough1' });
    expect(loginRes.status).toBe(200);

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe('buyer@example.com');

    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken });
    expect(refreshRes.status).toBe(200);

    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: refreshRes.body.refreshToken });
    expect(logoutRes.status).toBe(204);

    const failedRefresh = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: refreshRes.body.refreshToken });
    expect(failedRefresh.status).toBe(401);
  });

  it("a JWT issued for one tenant cannot read another tenant's users", async () => {
    const masterToken = signAccessToken({ sub: new Types.ObjectId().toString(), role: 'master_admin', tenantId: null });
    const tenantARes = await request(app)
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'TenantA', subdomain: 'tenant-a' });
    const tenantBRes = await request(app)
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'TenantB', subdomain: 'tenant-b' });

    await request(app)
      .post('/api/v1/auth/register')
      .send({ tenantSubdomain: 'tenant-a', email: 'a@example.com', password: 'longenough1' });
    await request(app)
      .post('/api/v1/auth/register')
      .send({ tenantSubdomain: 'tenant-b', email: 'b@example.com', password: 'longenough1' });

    const tokenForTenantA = signAccessToken({
      sub: new Types.ObjectId().toString(),
      role: 'reseller_admin',
      tenantId: tenantARes.body.tenant._id,
    });

    const usersRes = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${tokenForTenantA}`);
    expect(usersRes.status).toBe(200);
    const emails = usersRes.body.users.map((u: { email: string }) => u.email);
    expect(emails).toEqual(['a@example.com']);
    expect(emails).not.toContain('b@example.com');
    expect(tenantBRes.status).toBe(201);
  });
});
