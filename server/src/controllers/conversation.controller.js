import { env } from '../config/env.js';
import { query } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import { sendSuccess } from '../utils/response.js';
import { validateId } from '../utils/validation.js';

const LIST_LIMIT = 100;

// PENDING with no text means the AI is still working on it.
function draftView(draft, draftStatus) {
  if (!draft) return null;
  let state = 'APPROVED';
  if (draftStatus === 'FAILED') state = 'FAILED';
  else if (draftStatus === 'PENDING') state = draft.text ? 'READY' : 'GENERATING';

  return {
    id: draft.id,
    status: draftStatus,
    state,
    text: draft.text,
    errorMessage: draft.errorMessage,
    attempts: draft.attempts,
    approvedAt: draft.approvedAt,
    updatedAt: draft.updatedAt,
  };
}

// GET /api/conversations: the agent inbox, newest first.
export async function getConversations(_req, res) {
  // One query: the LATERAL joins fetch each conversation's last message and draft counts.
  const { rows } = await query(
    `SELECT cv."id", cv."status", cv."lastMessageAt",
            c."id" AS "customerId", c."name" AS "customerName", c."phone" AS "customerPhone",
            lm."text" AS "latestText", lm."senderType" AS "latestSenderType", lm."createdAt" AS "latestCreatedAt",
            cnt."pending", cnt."failed"
     FROM "Conversation" cv
     JOIN "Customer" c ON c."id" = cv."customerId"
     LEFT JOIN LATERAL (
       SELECT "text", "senderType", "createdAt" FROM "Message"
       WHERE "conversationId" = cv."id"
       ORDER BY "createdAt" DESC
       LIMIT 1
     ) lm ON TRUE
     LEFT JOIN LATERAL (
       SELECT COUNT(*) FILTER (WHERE "draftStatus" = 'PENDING')::int AS "pending",
              COUNT(*) FILTER (WHERE "draftStatus" = 'FAILED')::int AS "failed"
       FROM "Message"
       WHERE "conversationId" = cv."id"
     ) cnt ON TRUE
     WHERE cv."brandId" = $1
     ORDER BY cv."lastMessageAt" DESC
     LIMIT ${LIST_LIMIT}`,
    [env.brandId],
  );

  const conversations = rows.map((row) => ({
    id: row.id,
    status: row.status,
    lastMessageAt: row.lastMessageAt,
    customer: { id: row.customerId, name: row.customerName, phone: row.customerPhone },
    latestMessage: row.latestCreatedAt
      ? { text: row.latestText, senderType: row.latestSenderType, createdAt: row.latestCreatedAt }
      : null,
    pendingDrafts: row.pending,
    failedDrafts: row.failed,
  }));

  sendSuccess(res, { conversations });
}

// GET /api/conversations/:id: the full thread, with drafts.
export async function getConversation(req, res) {
  const id = validateId(req.params.id, 'conversation id');

  const {
    rows: [row],
  } = await query(
    `SELECT cv."id", cv."brandId", cv."status", cv."createdAt", cv."lastMessageAt",
            c."id" AS "customerId", c."externalId" AS "customerExternalId", c."name" AS "customerName",
            c."phone" AS "customerPhone", c."createdAt" AS "customerCreatedAt"
     FROM "Conversation" cv
     JOIN "Customer" c ON c."id" = cv."customerId"
     WHERE cv."id" = $1`,
    [id],
  );

  if (!row || row.brandId !== env.brandId) {
    throw AppError.notFound('Conversation not found');
  }

  const { rows: messages } = await query(
    `SELECT m."id", m."text", m."senderType", m."inReplyTo", m."draftStatus", m."createdAt",
            d."id" AS "draftId", d."text" AS "draftText", d."errorMessage" AS "draftErrorMessage",
            d."attempts" AS "draftAttempts", d."approvedAt" AS "draftApprovedAt", d."updatedAt" AS "draftUpdatedAt"
     FROM "Message" m
     LEFT JOIN "Draft" d ON d."messageId" = m."id"
     WHERE m."conversationId" = $1
     ORDER BY m."createdAt" ASC`,
    [id],
  );

  const conversation = {
    id: row.id,
    brandId: row.brandId,
    status: row.status,
    createdAt: row.createdAt,
    lastMessageAt: row.lastMessageAt,
    customer: {
      id: row.customerId,
      externalId: row.customerExternalId,
      name: row.customerName,
      phone: row.customerPhone,
      createdAt: row.customerCreatedAt,
    },
    messages: messages.map((m) => {
      const draft = m.draftId
        ? {
            id: m.draftId,
            text: m.draftText,
            errorMessage: m.draftErrorMessage,
            attempts: m.draftAttempts,
            approvedAt: m.draftApprovedAt,
            updatedAt: m.draftUpdatedAt,
          }
        : null;
      return {
        id: m.id,
        text: m.text,
        senderType: m.senderType,
        inReplyTo: m.inReplyTo,
        draftStatus: m.draftStatus,
        createdAt: m.createdAt,
        draft: m.senderType === 'CUSTOMER' ? draftView(draft, m.draftStatus) : null,
      };
    }),
  };

  sendSuccess(res, { conversation });
}
