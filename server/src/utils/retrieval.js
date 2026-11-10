// RAG: Gemini embeddings stored in Neon with pgvector.
// `npm run db:embed` fills the KnowledgeChunk table.
import { env } from '../config/env.js';
import { query } from '../config/db.js';
import { KNOWLEDGE_BASE } from '../config/knowledgeBase.js';
import { getClient } from './gemini.js';
import { logger, errorContext } from './logger.js';

// Must match vector(768) in db/schema.sql.
export const EMBEDDING_DIMENSIONS = 768;
const EMBED_TIMEOUT_MS = 8000;

// pgvector accepts a vector as the text '[0.1,0.2,...]'.
export const toVector = (values) => `[${values.join(',')}]`;

// Use 'RETRIEVAL_DOCUMENT' for policies and 'RETRIEVAL_QUERY' for messages.
export async function embedText(text, taskType) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EMBED_TIMEOUT_MS);
  try {
    const response = await getClient().models.embedContent({
      model: env.embeddingModel,
      contents: text,
      config: { taskType, outputDimensionality: EMBEDDING_DIMENSIONS, abortSignal: controller.signal },
    });
    const values = response.embeddings?.[0]?.values;
    if (!values?.length) throw new Error('Gemini returned an empty embedding');
    return values;
  } finally {
    clearTimeout(timer);
  }
}

// Returns the policies closest to the message. If anything fails (API down,
// table empty) it falls back to the full knowledge base, so drafts never get stuck.
export async function retrievePolicies(messageText) {
  try {
    const embedding = toVector(await embedText(messageText, 'RETRIEVAL_QUERY'));
    const { rows } = await query(
      `SELECT "topic", "content" AS "policy", 1 - ("embedding" <=> $1::vector) AS "similarity"
       FROM "KnowledgeChunk"
       ORDER BY "embedding" <=> $1::vector
       LIMIT $2`,
      [embedding, env.ragTopK],
    );
    if (rows.length === 0) {
      throw new Error('Knowledge base is not embedded yet; run npm run db:embed');
    }
    return { policies: rows, method: 'vector' };
  } catch (error) {
    logger.warn('Retrieval failed, using the full knowledge base', errorContext(error));
    return { policies: KNOWLEDGE_BASE, method: 'full' };
  }
}
