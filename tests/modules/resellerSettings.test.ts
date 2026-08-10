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
});

afterAll(async () => {
  await stopTestDb();
});

describe('resellerSettings module', () => {
  const app = buildTestApp();

  it('updates white-label branding for the current reseller tenant', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-brand' });
    await grantAgencyPlan(tenant._id);
    const token = signAccessToken({
      sub: 'reseller-1',
      role: 'reseller_admin',
      tenantId: tenant._id.toString(),
    });

    const res = await request(app)
      .patch('/api/v1/reseller/branding')
      .set('Authorization', `Bearer ${token}`)
      .send({
        storeName: 'Acme Deals',
        tagline: 'Digital products for every team',
        primaryColor: '#0F766E',
        customDomain: 'deals.example.com',
      });

    expect(res.status).toBe(200);
    expect(res.body.store.storeName).toBe('Acme Deals');
    expect(res.body.store.customDomain).toBe('deals.example.com');
    expect(res.body.store.branding.tagline).toBe('Digital products for every team');
  });
});
