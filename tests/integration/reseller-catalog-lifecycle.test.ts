import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { createApp } from '../../src/app';
import { signAccessToken } from '../../src/common/jwt';

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

describe('full reseller catalog lifecycle', () => {
  const app = createApp();
  const masterToken = signAccessToken({ sub: new Types.ObjectId().toString(), role: 'master_admin', tenantId: null });

  it('global product auto-syncs to a new tenant, then reassigning to private disables it and enables the assigned tenant', async () => {
    const productRes = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'Catalog Tool', type: 'software', basePrice: 100 });
    expect(productRes.status).toBe(201);
    const productId = productRes.body.product._id;

    await request(app)
      .patch(`/api/v1/admin/products/${productId}/sync-mode`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ syncMode: 'global' });

    const tenantARes = await request(app)
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'Tenant A', subdomain: 'tenant-a-catalog' });
    expect(tenantARes.status).toBe(201);

    const afterGlobalSync = await request(app)
      .get(`/api/v1/admin/products/${productId}/resellers`)
      .set('Authorization', `Bearer ${masterToken}`);
    expect(afterGlobalSync.body.tenants.map((t: { subdomain: string }) => t.subdomain)).toContain(
      'tenant-a-catalog'
    );

    const tenantBRes = await request(app)
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'Tenant B', subdomain: 'tenant-b-catalog' });
    expect(tenantBRes.status).toBe(201);

    await request(app)
      .patch(`/api/v1/admin/products/${productId}/sync-mode`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ syncMode: 'private', tenantId: tenantBRes.body.tenant._id });

    const afterReassign = await request(app)
      .get(`/api/v1/admin/products/${productId}/resellers`)
      .set('Authorization', `Bearer ${masterToken}`);
    const subdomains = afterReassign.body.tenants.map((t: { subdomain: string }) => t.subdomain);
    expect(subdomains).toEqual(['tenant-b-catalog']);
    expect(subdomains).not.toContain('tenant-a-catalog');
  });
});
