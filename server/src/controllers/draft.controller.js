import { randomUUID } from 'node:crypto';
import { query, withTransaction } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import { isUniqueViolation } from '../utils/dbErrors.js';
import { AiGenerationError, generateReplyDraft } from '../utils/gemini.js';
import { logger, errorContext } from '../utils/logger.js';
import { retrievePolicies } from '../utils/retrieval.js';
import { sendSuccess } from '../utils/response.js';
import { validateId, validateMessageText } from '../utils/validation.js';

const HISTORY_LIMIT = 10;
// The draft hasn't been approved yet.
const OPEN_DRAFT = `"draftStatus" IN ('PENDING', 'FAILED')`;

// Generates (or regenerates) the draft for a customer message and saves it.
// AI failures don't throw; they're saved on the draft so the agent can retry.
// The webhook controller uses this too.
export async function generateDraftForMessage(messageId) {
  const {
    rows: [message],
  } = await query(
    `SELECT m."id", m."conversationId", m."text", d."id" AS "draftId", c."name" AS "customerName"
     FROM "Message" m
     JOIN "Draft" d ON d."messageId" = m."id"
     JOIN "Conversation" cv ON cv."id" = m."conversationId"
     JOIN "Customer" c ON c."id" = cv."customerId"
     WHERE m."id" = $1`,
    [messageId],
  );

  if (!message) {
    throw AppError.notFound('Draft not found for this message');
  }

  const { draftId } = message;
  const logContext = { draftId, messageId, conversationId: message.conversationId };

  const { rows: earlier } = await query(
    `SELECT "text", "senderType" FROM "Message"
     WHERE "conversationId" = $1
       AND "createdAt" < (SELECT "createdAt" FROM "Message" WHERE "id" = $2)
     ORDER BY "createdAt" DESC
     LIMIT ${HISTORY_LIMIT}`,
    [message.conversationId, messageId],
  );

  // Pick the most relevant policies (all of them if retrieval fails).
  const { policies, method } = await retrievePolicies(message.text);
  logger.info('Policies retrieved', {
    ...logContext,
    method,
    topics: policies.map((p) => p.topic),
  });

  try {
    const { text, model } = await generateReplyDraft({
      customerName: message.customerName,
      history: earlier.reverse(),
      latestMessage: message.text,
      policies,
    });

    await withTransaction(async (tx) => {
      // An agent may have approved while we waited on Gemini. Leave it alone.
      const reopened = await tx.query(
        `UPDATE "Message" SET "draftStatus" = 'PENDING' WHERE "id" = $1 AND ${OPEN_DRAFT}`,
        [messageId],
      );
      if (reopened.rowCount === 0) return;

      await tx.query(
        `UPDATE "Draft"
         SET "text" = $2, "model" = $3, "errorMessage" = NULL, "attempts" = "attempts" + 1, "updatedAt" = NOW()
         WHERE "id" = $1`,
        [draftId, text, model],
      );
    });

    logger.info('AI draft generated', logContext);
    return { id: draftId, status: 'PENDING', text, errorMessage: null };
  } catch (error) {
    logger.error('AI draft generation failed', { ...logContext, ...errorContext(error) });

    const errorMessage =
      error instanceof AiGenerationError ? error.message : 'Unexpected error while generating the draft';

    try {
      await withTransaction(async (tx) => {
        await tx.query(`UPDATE "Message" SET "draftStatus" = 'FAILED' WHERE "id" = $1 AND ${OPEN_DRAFT}`, [
          messageId,
        ]);
        await tx.query(
          `UPDATE "Draft" SET "errorMessage" = $2, "attempts" = "attempts" + 1, "updatedAt" = NOW() WHERE "id" = $1`,
          [draftId, errorMessage],
        );
      });
    } catch (dbError) {
      // The message is already saved; the agent can still hit Retry.
      logger.error('Could not record AI failure', { ...logContext, ...errorContext(dbError) });
    }

    return { id: draftId, status: 'FAILED', text: null, errorMessage };
  }
}

// POST /api/drafts/:id/retry
export async function retry(req, res) {
  const draftId = validateId(req.params.id, 'draft id');

  const {
    rows: [draft],
  } = await query(
    `SELECT d."messageId", m."draftStatus"
     FROM "Draft" d JOIN "Message" m ON m."id" = d."messageId"
     WHERE d."id" = $1`,
    [draftId],
  );
  if (!draft) throw AppError.notFound('Draft not found');
  if (draft.draftStatus === 'APPROVED') {
    throw AppError.conflict('This draft has already been approved', 'ALREADY_APPROVED');
  }

  const result = await generateDraftForMessage(draft.messageId);
  if (result.status === 'FAILED') {
    throw new AppError(502, 'AI_GENERATION_FAILED', `Draft generation failed again: ${result.errorMessage}`);
  }

  sendSuccess(res, { draft: result });
}

// POST /api/drafts/:id/approve
// Saves the (maybe edited) text as the agent's reply. The conditional UPDATE
// means only one approval wins, even if the button gets clicked twice.
export async function approve(req, res) {
  const draftId = validateId(req.params.id, 'draft id');
  const text = validateMessageText(req.body);
  const agentId = req.agent.id;

  let reply;
  try {
    reply = await withTransaction(async (tx) => {
      const {
        rows: [draft],
      } = await tx.query(
        `SELECT d."messageId", d."text", m."conversationId"
         FROM "Draft" d JOIN "Message" m ON m."id" = d."messageId"
         WHERE d."id" = $1`,
        [draftId],
      );
      if (!draft) throw AppError.notFound('Draft not found');

      const claimed = await tx.query(
        `UPDATE "Message" SET "draftStatus" = 'APPROVED' WHERE "id" = $1 AND ${OPEN_DRAFT}`,
        [draft.messageId],
      );
      if (claimed.rowCount === 0) {
        throw AppError.conflict('This draft has already been approved', 'ALREADY_APPROVED');
      }

      const {
        rows: [created],
      } = await tx.query(
        `INSERT INTO "Message" ("id", "conversationId", "text", "senderType", "inReplyTo", "draftStatus", "createdAt")
         VALUES ($1, $2, $3, 'AGENT', $4, 'NOT_APPLICABLE', NOW())
         RETURNING "id", "text", "senderType", "inReplyTo", "createdAt"`,
        [randomUUID(), draft.conversationId, text, draft.messageId],
      );

      await tx.query(
        `UPDATE "Draft"
         SET "replyMessageId" = $2, "approvedById" = $3, "approvedAt" = NOW(), "updatedAt" = NOW()
         WHERE "id" = $1`,
        [draftId, created.id, agentId],
      );

      await tx.query(`UPDATE "Conversation" SET "lastMessageAt" = NOW(), "updatedAt" = NOW() WHERE "id" = $1`, [
        draft.conversationId,
      ]);

      logger.info('Draft approved', { draftId, agentId, replyMessageId: created.id, edited: text !== draft.text });
      return created;
    });
  } catch (error) {
    if (isUniqueViolation(error, 'replyMessageId')) {
      throw AppError.conflict('This draft has already been approved', 'ALREADY_APPROVED');
    }
    throw error;
  }

  sendSuccess(res, { reply }, 201);
}
