import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

const SIGNATURE_PATTERN = /^sha256=([0-9a-f]{64})$/i;

export function computeSignature(rawBody, secret = env.webhookSecret) {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

// Needs express.raw() on the route so req.body is the exact bytes that were
// signed. Re-serialising parsed JSON can change spacing or key order.
export function verifyWebhookSignature(req, _res, next) {
  if (!Buffer.isBuffer(req.body)) {
    return next(new AppError(400, 'INVALID_BODY', 'Webhook body must be raw JSON'));
  }

  const header = req.get('x-signature') || '';
  const match = header.trim().match(SIGNATURE_PATTERN);

  if (!match) {
    logger.warn('Webhook rejected: missing or malformed signature', { ip: req.ip });
    return next(new AppError(401, 'INVALID_SIGNATURE', 'Missing or malformed X-Signature header'));
  }

  const received = Buffer.from(match[1].toLowerCase(), 'hex');
  const expected = Buffer.from(computeSignature(req.body), 'hex');

  // timingSafeEqual throws if the lengths differ, so check that first.
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    logger.warn('Webhook rejected: signature mismatch', { ip: req.ip });
    return next(new AppError(401, 'INVALID_SIGNATURE', 'Invalid webhook signature'));
  }

  return next();
}
