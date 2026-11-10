-- Verdant & Co schema (Neon Postgres). Safe to run again, everything is
-- "create if missing". Run with: npm run db:setup

DO $$ BEGIN
  CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SenderType" AS ENUM ('CUSTOMER', 'AGENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Draft state, kept on CUSTOMER messages (AGENT messages are NOT_APPLICABLE):
--   PENDING  = generating, or waiting for review
--   FAILED   = the AI failed; agent can retry or reply by hand
--   APPROVED = replied, nothing left to do
DO $$ BEGIN
  CREATE TYPE "DraftStatus" AS ENUM ('PENDING', 'APPROVED', 'FAILED', 'NOT_APPLICABLE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "WebhookEventStatus" AS ENUM ('PROCESSED', 'IGNORED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Agent" (
  "id"           TEXT PRIMARY KEY,
  "email"        TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Customer" (
  "id"         TEXT PRIMARY KEY,
  "externalId" TEXT NOT NULL, -- the chat system's customer.id, or "web_..." from the Customer View
  "name"       TEXT NOT NULL,
  "phone"      TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Conversation" (
  "id"            TEXT PRIMARY KEY,
  "customerId"    TEXT NOT NULL REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "brandId"       TEXT NOT NULL,
  "status"        "ConversationStatus" NOT NULL DEFAULT 'OPEN',
  -- "<customerId>:<brandId>" while open, NULL once closed. The unique index
  -- keeps it to one open conversation per customer.
  "openKey"       TEXT,
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Message" (
  "id"             TEXT PRIMARY KEY,
  "externalId"     TEXT, -- the chat system's message.id (NULL from the Customer View)
  "conversationId" TEXT NOT NULL REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "text"           TEXT NOT NULL,
  "senderType"     "SenderType" NOT NULL,
  "inReplyTo"      TEXT REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE, -- for AGENT replies
  "draftStatus"    "DraftStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Drafts get their own table so customer-facing queries can't return one by mistake.
CREATE TABLE IF NOT EXISTS "Draft" (
  "id"             TEXT PRIMARY KEY,
  "messageId"      TEXT NOT NULL REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "text"           TEXT, -- NULL until generation succeeds
  "model"          TEXT,
  "errorMessage"   TEXT,
  "attempts"       INTEGER NOT NULL DEFAULT 0,
  "replyMessageId" TEXT REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE, -- the reply created on approval
  "approvedById"   TEXT REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "approvedAt"     TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "WebhookEvent" (
  "id"           TEXT PRIMARY KEY,
  "eventId"      TEXT NOT NULL,
  "type"         TEXT,
  "status"       "WebhookEventStatus" NOT NULL,
  "errorMessage" TEXT,
  "receivedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt"  TIMESTAMP(3),
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RAG: one row per policy with its embedding (filled by `npm run db:embed`).
-- No vector index yet; a plain scan is instant for a few rows. Add HNSW later.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "KnowledgeChunk" (
  "id"        TEXT PRIMARY KEY,
  "topic"     TEXT NOT NULL,
  "content"   TEXT NOT NULL,
  "embedding" vector(768) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Don't rename the unique indexes: the code spots duplicates by their names.
CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeChunk_topic_key" ON "KnowledgeChunk"("topic");
CREATE UNIQUE INDEX IF NOT EXISTS "Agent_email_key" ON "Agent"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "Customer_externalId_key" ON "Customer"("externalId");
CREATE INDEX IF NOT EXISTS "Customer_phone_idx" ON "Customer"("phone");
CREATE UNIQUE INDEX IF NOT EXISTS "Conversation_openKey_key" ON "Conversation"("openKey");
CREATE INDEX IF NOT EXISTS "Conversation_brandId_status_lastMessageAt_idx" ON "Conversation"("brandId", "status", "lastMessageAt" DESC);
CREATE INDEX IF NOT EXISTS "Conversation_customerId_idx" ON "Conversation"("customerId");
CREATE UNIQUE INDEX IF NOT EXISTS "Message_externalId_key" ON "Message"("externalId");
CREATE INDEX IF NOT EXISTS "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "Message_draftStatus_idx" ON "Message"("draftStatus");
CREATE UNIQUE INDEX IF NOT EXISTS "Draft_messageId_key" ON "Draft"("messageId");
CREATE UNIQUE INDEX IF NOT EXISTS "Draft_replyMessageId_key" ON "Draft"("replyMessageId");
CREATE UNIQUE INDEX IF NOT EXISTS "WebhookEvent_eventId_key" ON "WebhookEvent"("eventId");
CREATE INDEX IF NOT EXISTS "WebhookEvent_status_idx" ON "WebhookEvent"("status");
