import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';
import { logger, errorContext } from './utils/logger.js';

const app = createApp();

const server = app.listen(env.port, () => {
  logger.info('Server started', {
    port: env.port,
    env: env.nodeEnv,
    brandId: env.brandId,
    aiConfigured: Boolean(env.geminiApiKey),
    model: env.geminiModel,
  });
});

async function shutdown(signal) {
  logger.info('Shutting down', { signal });
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', errorContext(reason));
});
