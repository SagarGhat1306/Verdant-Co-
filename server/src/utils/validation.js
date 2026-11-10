import { AppError } from './AppError.js';

// Validation helpers. The check* functions return an error string or null,
// so we can collect every problem and report them all at once.

export const MAX_MESSAGE_LENGTH = 2000;
const PHONE_PATTERN = /^\+?[0-9][0-9\s-]{6,19}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function checkString(value, field, { min = 1, max = 200 } = {}) {
  if (typeof value !== 'string') return `${field} must be a string`;
  const length = value.trim().length;
  if (length < min) return `${field} is required`;
  if (length > max) return `${field} must be at most ${max} characters`;
  return null;
}

export function checkPhone(value, field = 'phone') {
  const error = checkString(value, field, { max: 25 });
  if (error) return error;
  return PHONE_PATTERN.test(value.trim()) ? null : `${field} must be a valid phone number`;
}

export function normalizePhone(phone) {
  return phone.trim().replace(/[\s-]/g, '');
}

// IDs are UUIDs. Reject anything else before it reaches the database.
export function validateId(id, label = 'id') {
  if (typeof id !== 'string' || !UUID_PATTERN.test(id)) {
    throw AppError.badRequest(`Invalid ${label}`);
  }
  return id;
}

export function validateMessageText(body, field = 'text') {
  if (!isPlainObject(body)) throw AppError.badRequest('Request body must be a JSON object');

  const error = checkString(body[field], field, { max: MAX_MESSAGE_LENGTH });
  if (error) throw AppError.badRequest(error);

  return body[field].trim();
}
