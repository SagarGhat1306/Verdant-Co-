import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { query } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import { sendSuccess } from '../utils/response.js';
import {
  checkPhone,
  checkString,
  isPlainObject,
  normalizePhone,
  validateId,
  validateMessageText,
} from '../utils/validation.js';
import { processCustomerMessage } from './webhook.controller.js';

function validateCreateCustomer(body) {
  if (!isPlainObject(body)) throw AppError.badRequest('Request body must be a JSON object');

  const errors = [checkString(body.name, 'name', { max: 100 }), checkPhone(body.phone)].filter(Boolean);
  if (errors.length) throw AppError.badRequest('Invalid customer details', errors);

  return { name: body.name.trim(), phone: normalizePhone(body.phone) };
}

// POST /api/customers: Customer View "sign in".
// Same phone number means same customer, so it joins the webhook's conversation.
export async function createCustomer(req, res) {
  const { name, phone } = validateCreateCustomer(req.body);

  const {
    rows: [existing],
  } = await query(
    'SELECT "id", "name", "phone" FROM "Customer" WHERE "phone" = $1 ORDER BY "createdAt" ASC LIMIT 1',
    [phone],
  );
  if (existing) return sendSuccess(res, { customer: existing }, 200);

  const {
    rows: [customer],
  } = await query(
    `INSERT INTO "Customer" ("id", "externalId", "name", "phone", "updatedAt")
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING "id", "name", "phone"`,
    [randomUUID(), `web_${randomUUID()}`, name, phone],
  );
  return sendSuccess(res, { customer }, 201);
}

// GET /api/customers/:id/conversation
// Drafts live in their own table, so they can't leak in here.
export async function getConversation(req, res) {
  const customerId = validateId(req.params.id, 'customer id');

  const {
    rows: [customer],
  } = await query('SELECT "id", "name", "phone" FROM "Customer" WHERE "id" = $1', [customerId]);
  if (!customer) throw AppError.notFound('Customer not found');

  const {
    rows: [conversation],
  } = await query('SELECT "id", "status" FROM "Conversation" WHERE "openKey" = $1', [
    `${customerId}:${env.brandId}`,
  ]);

  let messages = [];
  if (conversation) {
    ({ rows: messages } = await query(
      `SELECT "id", "text", "senderType", "createdAt" FROM "Message"
       WHERE "conversationId" = $1
       ORDER BY "createdAt" ASC`,
      [conversation.id],
    ));
  }

  sendSuccess(res, { customer, conversation: conversation ?? null, messages });
}

// POST /api/customers/:id/messages
export async function sendMessage(req, res) {
  const customerId = validateId(req.params.id, 'customer id');
  const text = validateMessageText(req.body);

  const {
    rows: [customer],
  } = await query('SELECT "externalId", "name", "phone" FROM "Customer" WHERE "id" = $1', [customerId]);
  if (!customer) throw AppError.notFound('Customer not found');

  const result = await processCustomerMessage(
    {
      brandId: env.brandId,
      customer: { externalId: customer.externalId, name: customer.name, phone: customer.phone },
      message: { externalId: null, text },
    },
    { source: 'customer_view' },
  );

  // Don't tell the customer anything about the draft.
  sendSuccess(res, { status: result.status, messageId: result.messageId ?? null }, 201);
}
