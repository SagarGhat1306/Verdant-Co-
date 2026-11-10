// Postgres pool + a small helper for transactions.
import pg from 'pg';
import { env } from './env.js';

const { Pool, types } = pg;

// We store timestamps in UTC. Without this, pg shifts them to the machine's local time.
types.setTypeParser(types.builtins.TIMESTAMP, (value) => new Date(`${value.replace(' ', 'T')}Z`));
pg.defaults.parseInputDatesAsUTC = true;

export const pool = new Pool({
  connectionString: env.databaseUrl,
});

// Neon drops idle connections when it sleeps. Log it instead of crashing.
pool.on('error', (error) => {
  console.error('Unexpected database error:', error.message);
});

export const query = (text, params) => pool.query(text, params);

export async function withTransaction(work) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
