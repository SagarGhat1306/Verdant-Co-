import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function optional(name, fallback) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

const nodeEnv = optional('NODE_ENV', 'development');

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: Number(optional('PORT', '5000')),

  databaseUrl: required('DATABASE_URL'),

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: optional('JWT_EXPIRES_IN', '8h'),

  webhookSecret: required('WEBHOOK_SECRET'),

  // Optional. Without a key, messages still save and drafts show as FAILED.
  geminiApiKey: optional('GEMINI_API_KEY', ''),
  geminiModel: optional('GEMINI_MODEL', 'gemini-3.5-flash-lite'),
  aiTimeoutMs: Number(optional('AI_TIMEOUT_MS', '20000')),

  // RAG: embedding model, and how many policies go into each prompt.
  embeddingModel: optional('GEMINI_EMBEDDING_MODEL', 'gemini-embedding-001'),
  ragTopK: Number(optional('RAG_TOP_K', '3')),

  brandId: optional('BRAND_ID', 'verdant-co'),

  // Allowed frontend origins, comma-separated.
  clientUrls: optional('CLIENT_URL', 'http://localhost:5173')
    .split(',')
    .map((url) => url.trim().replace(/\/$/, ''))
    .filter(Boolean),
};

if (env.jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long');
}
