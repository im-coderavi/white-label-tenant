jest.mock('../../src/common/cloudinary', () => ({
  uploadBuffer: jest.fn().mockResolvedValue({
    secureUrl: 'https://res.cloudinary.com/mock.png',
    publicId: 'toolzypro/mock',
  }),
}));

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

describe('full product lifecycle', () => {
  const app = createApp();
  const masterToken = signAccessToken({ sub: new Types.ObjectId().toString(), role: 'master_admin', tenantId: null });

  it('create -> add version -> publish -> archive', async () => {
    const createRes = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'Lifecycle Tool', type: 'software', basePrice: 499 });
    expect(createRes.status).toBe(201);
    expect(createRes.body.product.status).toBe('draft');

    const productId = createRes.body.product._id;

    const publishBeforeVersion = await request(app)
      .post(`/api/v1/admin/products/${productId}/publish`)
      .set('Authorization', `Bearer ${masterToken}`);
    expect(publishBeforeVersion.status).toBe(409);

    const versionRes = await request(app)
      .post(`/api/v1/admin/products/${productId}/versions`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ version: '1.0.0', changelog: 'Initial release' });
    expect(versionRes.status).toBe(201);

    const publishRes = await request(app)
      .post(`/api/v1/admin/products/${productId}/publish`)
      .set('Authorization', `Bearer ${masterToken}`);
    expect(publishRes.status).toBe(200);
    expect(publishRes.body.product.status).toBe('published');

    const archiveRes = await request(app)
      .delete(`/api/v1/admin/products/${productId}`)
      .set('Authorization', `Bearer ${masterToken}`);
    expect(archiveRes.status).toBe(200);
    expect(archiveRes.body.product.status).toBe('archived');
  });
});
