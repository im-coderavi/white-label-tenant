import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { User } from '../../src/models/User';
import { seedMasterAdmin } from '../../src/scripts/seedMasterAdmin';

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

describe('seedMasterAdmin', () => {
  const originalEmail = process.env.SEED_MASTER_ADMIN_EMAIL;
  const originalPassword = process.env.SEED_MASTER_ADMIN_PASSWORD;

  afterEach(() => {
    process.env.SEED_MASTER_ADMIN_EMAIL = originalEmail;
    process.env.SEED_MASTER_ADMIN_PASSWORD = originalPassword;
  });

  it('creates a master_admin user with tenantId null', async () => {
    process.env.SEED_MASTER_ADMIN_EMAIL = 'admin@toolzypro.local';
    process.env.SEED_MASTER_ADMIN_PASSWORD = 'change-me-please';

    await seedMasterAdmin();

    const admin = await User.findOne({ role: 'master_admin', email: 'admin@toolzypro.local' });
    expect(admin).not.toBeNull();
    expect(admin!.tenantId).toBeNull();
  });

  it('is idempotent — running twice does not throw or duplicate', async () => {
    process.env.SEED_MASTER_ADMIN_EMAIL = 'admin@toolzypro.local';
    process.env.SEED_MASTER_ADMIN_PASSWORD = 'change-me-please';

    await seedMasterAdmin();
    await seedMasterAdmin();

    const count = await User.countDocuments({ role: 'master_admin' });
    expect(count).toBe(1);
  });

  it('throws if required env vars are missing', async () => {
    delete process.env.SEED_MASTER_ADMIN_EMAIL;
    delete process.env.SEED_MASTER_ADMIN_PASSWORD;
    await expect(seedMasterAdmin()).rejects.toThrow();
  });
});
