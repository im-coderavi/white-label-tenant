import { User } from '../models/User';
import { hashPassword } from '../common/password';
import { logger } from '../common/logger';

export async function seedMasterAdmin(): Promise<void> {
  const email = process.env.SEED_MASTER_ADMIN_EMAIL;
  const password = process.env.SEED_MASTER_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('SEED_MASTER_ADMIN_EMAIL and SEED_MASTER_ADMIN_PASSWORD must be set');
  }
  const existing = await User.findOne({ tenantId: null, email: email.toLowerCase(), role: 'master_admin' });
  if (existing) {
    logger.info('Master admin already exists, skipping');
    return;
  }
  const passwordHash = await hashPassword(password);
  await User.create({
    tenantId: null,
    role: 'master_admin',
    email: email.toLowerCase(),
    passwordHash,
    status: 'active',
  });
  logger.info('Master admin created');
}

if (require.main === module) {
  const { connectDb, disconnectDb } = require('../config/db');
  connectDb()
    .then(() => seedMasterAdmin())
    .then(() => disconnectDb())
    .catch((err: unknown) => {
      logger.error('Failed to seed master admin', { error: err instanceof Error ? err.stack : err });
      process.exit(1);
    });
}
