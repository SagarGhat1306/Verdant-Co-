import { AppError } from '../utils/AppError.js';
import { isDatabaseError } from '../utils/dbErrors.js';
import { logger, errorContext } from '../utils/logger.js';

export function notFoundHandler(req, _res, next) {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

// Every error goes out in the same JSON shape. Unexpected ones never leak
// stack traces or SQL.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong. Please try again.';
  let details;

  if (err instanceof AppError) {
    ({ statusCode: status, code, message, details } = err);
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Request body is not valid JSON';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body is too large';
  } else if (isDatabaseError(err)) {
    status = 503;
    code = 'DATABASE_ERROR';
    message = 'The database is temporarily unavailable. Please try again.';
  }

  if (status >= 500) {
    logger.error('Request failed', {
      method: req.method,
      path: req.originalUrl,
      status,
      ...errorContext(err),
    });
  }

  res.status(status).json({
    success: false,
    error: { code, message, ...(details ? { details } : {}) },
  });
}
