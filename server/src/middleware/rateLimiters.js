import rateLimit from 'express-rate-limit';

function limiter(windowMs, limit, message) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMITED', message } },
  });
}

// General limit for everything under /api.
export const apiLimiter = limiter(15 * 60 * 1000, 2000,'Too many requests. Please try again later.');

// Slows down password guessing.
export const loginLimiter = limiter(15 * 60 * 1000, 10, 'Too many login attempts. Please wait and try again.');

// Every message costs an LLM call, so this public endpoint gets a tighter limit.
export const customerMessageLimiter = limiter(60 * 1000, 15, 'You are sending messages too quickly.');

export const webhookLimiter = limiter(60 * 1000, 120, 'Webhook rate limit exceeded.');
