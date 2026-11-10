import { env } from '../config/env.js';
import { query } from '../config/db.js';

export async function getHealth(_req, res) {
  let database = 'ok';
  try {
    await query('SELECT 1');
  } catch {
    database = 'unavailable';
  }

  const healthy = database === 'ok';
  res.status(healthy ? 200 : 503).json({
    success: healthy,
    data: {
      status: healthy ? 'ok' : 'degraded',
      database,
      aiConfigured: Boolean(env.geminiApiKey),
      time: new Date().toISOString(),
    },
  });
}
