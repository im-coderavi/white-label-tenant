import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { customerLicensesRouter } from '../../src/modules/licenses/customer.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Product } from '../../src/models/Product';
import { License } from '../../src/models/License';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/customer/licenses', customerLicensesRouter);
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

describe('licenses module — customer list & activate', () => {
  const app = buildTestApp();

  it("lists only the caller's own licenses", async () => {
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    const myUserId = new mongoose.Types.ObjectId();
    const otherUserId = new mongoose.Types.ObjectId();
    await License.create({
      productId: product._id,
      key: 'TZP-2026-MINE0001',
      assignedUserId: myUserId,
      status: 'assigned',
    });
    await License.create({
      productId: product._id,
      key: 'TZP-2026-THEIRS01',
      assignedUserId: otherUserId,
      status: 'assigned',
    });

    const token = signAccessToken({ sub: myUserId.toString(), role: 'customer', tenantId: 'tenant-x' });
    const res = await request(app)
      .get('/api/v1/customer/licenses')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.licenses).toHaveLength(1);
    expect(res.body.licenses[0].key).toBe('TZP-2026-MINE0001');
  });

  it('includes the product each license belongs to', async () => {
    const product = await Product.create({
      name: 'Nova Portfolio Theme',
      slug: 'nova-portfolio-theme',
      type: 'theme',
      basePrice: 999,
    });
    const userId = new mongoose.Types.ObjectId();
    await License.create({
      productId: product._id,
      key: 'TZP-2026-WITHPROD',
      assignedUserId: userId,
      status: 'assigned',
    });

    const token = signAccessToken({ sub: userId.toString(), role: 'customer', tenantId: 'tenant-x' });
    const res = await request(app)
      .get('/api/v1/customer/licenses')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.licenses[0].product).toEqual({
      _id: product._id.toString(),
      name: 'Nova Portfolio Theme',
      type: 'theme',
    });
  });

  it('401s activating a license not assigned to the caller', async () => {
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    const ownerId = new mongoose.Types.ObjectId();
    const license = await License.create({
      productId: product._id,
      key: 'TZP-2026-NOTYOURS',
      assignedUserId: ownerId,
      status: 'assigned',
    });

    const token = signAccessToken({
      sub: new mongoose.Types.ObjectId().toString(),
      role: 'customer',
      tenantId: 'tenant-x',
    });
    const res = await request(app)
      .post(`/api/v1/customer/licenses/${license._id}/activate`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('activates a license and increments activationsUsed, then 409s once the limit is reached', async () => {
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    const userId = new mongoose.Types.ObjectId();
    const license = await License.create({
      productId: product._id,
      key: 'TZP-2026-LIMIT001',
      assignedUserId: userId,
      status: 'assigned',
      activationLimit: 1,
    });

    const token = signAccessToken({ sub: userId.toString(), role: 'customer', tenantId: 'tenant-x' });

    const firstActivate = await request(app)
      .post(`/api/v1/customer/licenses/${license._id}/activate`)
      .set('Authorization', `Bearer ${token}`);
    expect(firstActivate.status).toBe(200);
    expect(firstActivate.body.license.status).toBe('activated');
    expect(firstActivate.body.license.activationsUsed).toBe(1);

    const secondActivate = await request(app)
      .post(`/api/v1/customer/licenses/${license._id}/activate`)
      .set('Authorization', `Bearer ${token}`);
    expect(secondActivate.status).toBe(409);
  });

  it('401s and expires a license whose expiresAt has passed', async () => {
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    const userId = new mongoose.Types.ObjectId();
    const license = await License.create({
      productId: product._id,
      key: 'TZP-2026-EXPIRED1',
      assignedUserId: userId,
      status: 'assigned',
      expiresAt: new Date(Date.now() - 60000),
    });

    const token = signAccessToken({ sub: userId.toString(), role: 'customer', tenantId: 'tenant-x' });
    const res = await request(app)
      .post(`/api/v1/customer/licenses/${license._id}/activate`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);

    const updated = await License.findById(license._id);
    expect(updated!.status).toBe('expired');
  });
});
