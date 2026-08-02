import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { publicStoreRouter } from '../../src/modules/publicStore/publicStore.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { Tenant } from '../../src/models/Tenant';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/public', publicStoreRouter);
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

describe('publicStore module', () => {
  const app = buildTestApp();

  it('resolves a subdomain to its store name without requiring auth', async () => {
    await Tenant.create({ name: 'Nova Digital', subdomain: 'nova', status: 'active' });

    const res = await request(app).get('/api/v1/public/store?subdomain=nova');

    expect(res.status).toBe(200);
    expect(res.body.store).toEqual({ name: 'Nova Digital', subdomain: 'nova', status: 'active' });
  });

  it('matches case-insensitively', async () => {
    await Tenant.create({ name: 'Nova Digital', subdomain: 'nova', status: 'active' });

    const res = await request(app).get('/api/v1/public/store?subdomain=NOVA');

    expect(res.status).toBe(200);
    expect(res.body.store.subdomain).toBe('nova');
  });

  it('returns null for an unknown subdomain rather than an error', async () => {
    const res = await request(app).get('/api/v1/public/store?subdomain=ghost');

    expect(res.status).toBe(200);
    expect(res.body.store).toBeNull();
  });

  it('returns null when no subdomain is supplied', async () => {
    const res = await request(app).get('/api/v1/public/store');

    expect(res.status).toBe(200);
    expect(res.body.store).toBeNull();
  });

  it('never exposes anything beyond the public store identity', async () => {
    await Tenant.create({ name: 'Nova Digital', subdomain: 'nova', status: 'active' });

    const res = await request(app).get('/api/v1/public/store?subdomain=nova');

    expect(Object.keys(res.body.store).sort()).toEqual(['name', 'status', 'subdomain']);
  });
});
