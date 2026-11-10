import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

// Checks the Bearer token and puts the agent on req.agent.
export function requireAuth(req, _res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(AppError.unauthorized());
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
    req.agent = { id: payload.sub, email: payload.email };
    return next();
  } catch {
    return next(AppError.unauthorized('Session expired or invalid. Please sign in again.'));
  }
}
