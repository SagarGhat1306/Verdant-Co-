import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { query } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import { sendSuccess } from '../utils/response.js';
import { checkString, isPlainObject } from '../utils/validation.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Checked when the email doesn't exist, so both kinds of failure take the
// same time and nobody can work out which emails are registered.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

function validateLogin(body) {
  if (!isPlainObject(body)) throw AppError.badRequest('Request body must be a JSON object');

  const errors = [];
  const emailError = checkString(body.email, 'email', { max: 254 });
  if (emailError) errors.push(emailError);
  else if (!EMAIL_PATTERN.test(body.email.trim())) errors.push('email must be a valid email address');

  const passwordError = checkString(body.password, 'password', { max: 128 });
  if (passwordError) errors.push(passwordError);

  if (errors.length) throw AppError.badRequest('Invalid login details', errors);

  return { email: body.email.trim().toLowerCase(), password: body.password };
}

// POST /api/auth/login
export async function loginAgent(req, res) {
  const { email, password } = validateLogin(req.body);

  const {
    rows: [agent],
  } = await query('SELECT "id", "email", "name", "passwordHash" FROM "Agent" WHERE "email" = $1', [email]);
  const passwordOk = await bcrypt.compare(password, agent?.passwordHash ?? DUMMY_HASH);

  if (!agent || !passwordOk) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const token = jwt.sign({ email: agent.email }, env.jwtSecret, {
    subject: agent.id,
    expiresIn: env.jwtExpiresIn,
    algorithm: 'HS256',
  });

  sendSuccess(res, { token, agent: { id: agent.id, email: agent.email, name: agent.name } });
}

// GET /api/auth/me
export async function getCurrentAgent(req, res) {
  const {
    rows: [agent],
  } = await query('SELECT "id", "email", "name" FROM "Agent" WHERE "id" = $1', [req.agent.id]);
  if (!agent) throw AppError.unauthorized('Agent account no longer exists');

  sendSuccess(res, { agent });
}
