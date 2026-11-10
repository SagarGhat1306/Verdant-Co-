// Runs db/schema.sql. Safe to run again.
// Usage: npm run db:setup
import { readFile } from 'node:fs/promises';
import { pool } from '../src/config/db.js';

const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');

try {
  await pool.query(sql);
  console.log('Database schema is up to date.');
} catch (error) {
  console.error('Schema setup failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
