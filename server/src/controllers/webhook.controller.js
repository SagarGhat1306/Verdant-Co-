import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { query, withTransaction } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import { isUniqueViolation } from '../utils/dbErrors.js';
import { logger, errorContext } from '../utils/logger.js';
import { sendSuccess } from '../utils/response.js';
import {
  MAX_MESSAGE_LENGTH,
  checkPhone,
  checkString,
  isPlainObject,
  normalizePhone,
} from '../utils/validation.js';
import { generateDraftForMessage } from './draft.controller.js';

const SUPPORTED_EVENT_TYPE = 'message.received';
const SUPPORTED_MESSAGE_TYPE = 'text';

class DuplicateMessageError extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'DuplicateMessageError';
  }
}

// --- Saving a customer message (the Customer View uses this too) ---

// One transaction: customer, conversation, message, empty draft and webhook
// event all save together or not at all. NOW() is the same for every row.
async function persistCustomerMessage(input, { eventId, eventType }) {
  const { brandId, customer: c, message: m } = input;

  return withTransaction(async (tx) => {
    if (eventId) {
      const { rows } = await tx.query('SELECT "status" FROM "WebhookEvent" WHERE "eventId" = $1', [eventId]);
      const existing = rows[0];
      // Let FAILED events through so the sender's retry can work.
      if (existing && existing.status !== 'FAILED') {
        throw new DuplicateMessageError(`event ${eventId} already ${existing.status.toLowerCase()}`);
      }
    }

    // ON CONFLICT copes with two deliveries for the same customer at once.
    const {
      rows: [customer],
    } = await tx.query(
      `INSERT INTO "Customer" ("id", "externalId", "name", "phone", "updatedAt")
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT ("externalId") DO UPDATE
         SET "name" = EXCLUDED."name", "phone" = EXCLUDED."phone", "updatedAt" = NOW()
       RETURNING "id"`,
      [randomUUID(), c.externalId, c.name, c.phone],
    );

    const {
      rows: [conversation],
    } = await tx.query(
      `INSERT INTO "Conversation" ("id", "customerId", "brandId", "openKey", "status", "lastMessageAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'OPEN', NOW(), NOW())
       ON CONFLICT ("openKey") DO UPDATE SET "lastMessageAt" = NOW(), "updatedAt" = NOW()
       RETURNING "id"`,
      [randomUUID(), customer.id, brandId, `${customer.id}:${brandId}`],
    );

    const messageId = randomUUID();
    await tx.query(
      `INSERT INTO "Message" ("id", "externalId", "conversationId", "text", "senderType", "draftStatus", "createdAt")
       VALUES ($1, $2, $3, $4, 'CUSTOMER', 'PENDING', NOW())`,
      [messageId, m.externalId ?? null, conversation.id, m.text],
    );

    const draftId = randomUUID();
    await tx.query('INSERT INTO "Draft" ("id", "messageId", "updatedAt") VALUES ($1, $2, NOW())', [draftId, messageId]);

    if (eventId) {
      await tx.query(
        `INSERT INTO "WebhookEvent" ("id", "eventId", "type", "status", "processedAt", "updatedAt")
         VALUES ($1, $2, $3, 'PROCESSED', NOW(), NOW())
         ON CONFLICT ("eventId") DO UPDATE
           SET "status" = 'PROCESSED', "errorMessage" = NULL, "processedAt" = NOW(), "updatedAt" = NOW()`,
        [randomUUID(), eventId, eventType ?? null],
      );
    }

    return { customerId: customer.id, conversationId: conversation.id, messageId, draftId };
  });
}

// Entry point for every customer message, from the webhook or the Customer View.
// Database errors throw (nothing saved). AI errors don't: the draft is marked FAILED.
export async function processCustomerMessage(input, meta = {}) {
  const { eventId, eventType, source = 'unknown' } = meta;

  let saved;
  try {
    saved = await persistCustomerMessage(input, { eventId, eventType });
  } catch (error) {
    if (error instanceof DuplicateMessageError) {
      logger.info('Duplicate message ignored', { source, eventId, reason: error.message });
      return { status: 'duplicate', reason: error.message };
    }
    if (isUniqueViolation(error, 'externalId') || isUniqueViolation(error, 'eventId')) {
      logger.info('Duplicate message ignored (constraint)', { source, eventId });
      return { status: 'duplicate', reason: 'message or event already received' };
    }
    throw error;
  }

  const { customerId, conversationId, messageId, draftId } = saved;
  logger.info('Customer message saved', { source, eventId, customerId, conversationId, messageId });

  // The message is committed, so an AI problem from here on only affects the draft.
  let draft;
  try {
    draft = await generateDraftForMessage(messageId);
  } catch (error) {
    // e.g. the database blipped right after commit. The draft row exists, so Retry works.
    logger.error('Could not start draft generation', { messageId, ...errorContext(error) });
    draft = {
      id: draftId,
      status: 'PENDING',
      errorMessage: 'Draft generation did not start; retry it from the Agent View',
    };
  }

  return {
    status: 'accepted',
    customerId,
    conversationId,
    messageId,
    draft: { id: draft.id, status: draft.status, errorMessage: draft.errorMessage },
  };
}

// --- Webhook payload checks and event records ---

function parseRawJson(buffer) {
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch {
    throw new AppError(400, 'INVALID_JSON', 'Webhook body is not valid JSON');
  }
}

// Returns { supported: true, eventId, eventType, input } to process it,
// or { supported: false, eventId, eventType, reason } to acknowledge and skip.
// Throws a 400 if the payload is malformed.
function validateWebhookPayload(body, { allowedBrandIds }) {
  if (!isPlainObject(body)) throw AppError.badRequest('Payload must be a JSON object');

  const headerErrors = [checkString(body.event_id, 'event_id'), checkString(body.type, 'type', { max: 100 })].filter(
    Boolean,
  );
  if (headerErrors.length) throw AppError.badRequest('Invalid webhook payload', headerErrors);

  const eventId = body.event_id.trim();
  const eventType = body.type.trim();

  // Unknown event types still get a 200, so the sender doesn't retry forever.
  if (eventType !== SUPPORTED_EVENT_TYPE) {
    return { supported: false, eventId, eventType, reason: `Unsupported event type "${eventType}"` };
  }

  const errors = [];
  const { brand_id: brandId, customer, message } = body;

  const brandError = checkString(brandId, 'brand_id', { max: 100 });
  if (brandError) errors.push(brandError);
  else if (!allowedBrandIds.includes(brandId.trim())) errors.push(`Unknown brand_id "${brandId}"`);

  if (!isPlainObject(customer)) {
    errors.push('customer must be an object');
  } else {
    errors.push(
      checkString(customer.id, 'customer.id'),
      checkString(customer.name, 'customer.name', { max: 100 }),
      checkPhone(customer.phone, 'customer.phone'),
    );
  }

  if (!isPlainObject(message)) {
    errors.push('message must be an object');
  } else {
    errors.push(checkString(message.id, 'message.id'), checkString(message.type, 'message.type', { max: 50 }));
  }

  const realErrors = errors.filter(Boolean);
  if (realErrors.length) throw AppError.badRequest('Invalid webhook payload', realErrors);

  // Images, audio etc. aren't supported. Acknowledge and skip.
  if (message.type.trim() !== SUPPORTED_MESSAGE_TYPE) {
    return { supported: false, eventId, eventType, reason: `Unsupported message type "${message.type}"` };
  }

  const textError = checkString(message.text, 'message.text', { max: MAX_MESSAGE_LENGTH });
  if (textError) throw AppError.badRequest('Invalid webhook payload', [textError]);

  return {
    supported: true,
    eventId,
    eventType,
    input: {
      brandId: brandId.trim(),
      customer: {
        externalId: customer.id.trim(),
        name: customer.name.trim(),
        phone: normalizePhone(customer.phone),
      },
      message: {
        externalId: message.id.trim(),
        text: message.text.trim(),
      },
    },
  };
}

// Records a skipped event. Re-deliveries do nothing.
async function recordIgnoredEvent({ eventId, eventType, reason }) {
  await query(
    `INSERT INTO "WebhookEvent" ("id", "eventId", "type", "status", "errorMessage", "processedAt", "updatedAt")
     VALUES ($1, $2, $3, 'IGNORED', $4, NOW(), NOW())
     ON CONFLICT ("eventId") DO NOTHING`,
    [randomUUID(), eventId, eventType ?? null, reason ?? null],
  );
}

// Best effort. If the database is down this fails too, and the log line is all we have.
async function recordFailedEvent({ eventId, eventType, error }) {
  const errorMessage = String(error?.message || error).slice(0, 500);
  try {
    // New event: insert as FAILED. Already FAILED: update the error.
    // Already PROCESSED or IGNORED: leave it.
    await query(
      `INSERT INTO "WebhookEvent" ("id", "eventId", "type", "status", "errorMessage", "updatedAt")
       VALUES ($1, $2, $3, 'FAILED', $4, NOW())
       ON CONFLICT ("eventId") DO UPDATE
         SET "errorMessage" = EXCLUDED."errorMessage", "updatedAt" = NOW()
         WHERE "WebhookEvent"."status" = 'FAILED'`,
      [randomUUID(), eventId, eventType ?? null, errorMessage],
    );
  } catch (recordError) {
    logger.error('Could not record failed webhook event', { eventId, ...errorContext(recordError) });
  }
}

// --- POST /api/webhook ---
// The signature is already checked by middleware. Responses:
//   200 accepted / duplicate / ignored
//   400 bad payload (retrying won't help)
//   401 bad signature
//   503 database down, nothing saved (sender should retry)
export async function receiveWebhook(req, res) {
  const payload = parseRawJson(req.body);
  const result = validateWebhookPayload(payload, { allowedBrandIds: [env.brandId] });
  const { eventId, eventType } = result;

  if (!result.supported) {
    await recordIgnoredEvent({ eventId, eventType, reason: result.reason });
    logger.info('Webhook event ignored', { eventId, reason: result.reason });
    return sendSuccess(res, { status: 'ignored', eventId, reason: result.reason });
  }

  let outcome;
  try {
    outcome = await processCustomerMessage(result.input, { eventId, eventType, source: 'webhook' });
  } catch (error) {
    await recordFailedEvent({ eventId, eventType, error });
    throw error; // the error handler turns this into a 503
  }

  if (outcome.status === 'duplicate') {
    return sendSuccess(res, { status: 'duplicate', eventId });
  }

  return sendSuccess(res, {
    status: 'accepted',
    eventId,
    conversationId: outcome.conversationId,
    messageId: outcome.messageId,
    draft: outcome.draft,
  });
}
