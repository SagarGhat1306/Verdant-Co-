// Embeds each policy from src/config/knowledgeBase.js into KnowledgeChunk.
// Run it again whenever you change the policies.
// Usage: npm run db:embed
import { randomUUID } from 'node:crypto';
import { pool } from '../src/config/db.js';
import { KNOWLEDGE_BASE } from '../src/config/knowledgeBase.js';
import { embedText, toVector } from '../src/utils/retrieval.js';

try {
  for (const { topic, policy } of KNOWLEDGE_BASE) {
    // Include the topic, so "Can I pay cash?" also matches "Cash on delivery".
    const embedding = await embedText(`${topic}: ${policy}`, 'RETRIEVAL_DOCUMENT');

    await pool.query(
      `INSERT INTO "KnowledgeChunk" ("id", "topic", "content", "embedding", "updatedAt")
       VALUES ($1, $2, $3, $4::vector, NOW())
       ON CONFLICT ("topic") DO UPDATE
         SET "content" = EXCLUDED."content", "embedding" = EXCLUDED."embedding", "updatedAt" = NOW()`,
      [randomUUID(), topic, policy, toVector(embedding)],
    );
    console.log(`Embedded: ${topic}`);
  }

  // Drop policies that were removed from knowledgeBase.js.
  const { rowCount } = await pool.query('DELETE FROM "KnowledgeChunk" WHERE NOT ("topic" = ANY($1))', [
    KNOWLEDGE_BASE.map((k) => k.topic),
  ]);
  if (rowCount) console.log(`Removed ${rowCount} old polic${rowCount === 1 ? 'y' : 'ies'}.`);

  console.log(`Knowledge base ready: ${KNOWLEDGE_BASE.length} policies.`);
} catch (error) {
  console.error('Embedding failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
