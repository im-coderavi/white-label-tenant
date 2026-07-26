import { createApp } from './app';
import { connectDb } from './config/db';
import { env } from './config/env';
import { logger } from './common/logger';

async function main(): Promise<void> {
  await connectDb();
  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info(`Server listening on port ${env.PORT}`);
  });
}

main().catch((err) => {
  logger.error('Failed to start server', { error: err instanceof Error ? err.stack : err });
  process.exit(1);
});
