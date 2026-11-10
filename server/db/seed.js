// Creates the demo agent login. Safe to run again.
// Usage: npm run db:seed
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../src/config/db.js';

const agentEmail = (process.env.DEMO_AGENT_EMAIL || 'agent@verdant.co').toLowerCase();
const agentPassword = process.env.DEMO_AGENT_PASSWORD || 'Verdant@2026';

try {
  const passwordHash = await bcrypt.hash(agentPassword, 12);

  await pool.query(
    `INSERT INTO "Agent" ("id", "email", "name", "passwordHash", "updatedAt")
     VALUES ($1, $2, 'Demo Agent', $3, NOW())
     ON CONFLICT ("email") DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", "updatedAt" = NOW()`,
    [randomUUID(), agentEmail, passwordHash],
  );

  console.log(`Seeded demo agent ${agentEmail}.`);
} catch (error) {
  console.error('Seed failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
