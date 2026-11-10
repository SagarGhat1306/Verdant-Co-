import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiters.js';
import { apiRouter } from './routes/index.js';
import { webhookRouter } from './routes/webhook.routes.js';

// Frontends allowed to call the API: the deployed app, local dev, plus anything in CLIENT_URL.
const ALLOWED_ORIGINS = new Set([
  'https://verdant-co-one.vercel.app',
  'http://localhost:5173',
  ...env.clientUrls,
]);

export function createApp() {
  const app = express();

  // We're behind Vercel's proxy; this lets rate limiting see the real client IP.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // No Origin = curl, Postman or the chat system. Those are protected by
        // the signature or JWT, not CORS.
        if (!origin || ALLOWED_ORIGINS.has(origin)) return callback(null, true);
        return callback(null, false);
      },
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    }),
  );

  app.use('/api', apiLimiter);

  // Has to come before express.json(): the signature check needs the raw body.
  app.use('/api/webhook', webhookRouter);

  app.use(express.json({ limit: '50kb' }));
  app.use('/api', apiRouter);

  app.get('/', (_req, res) => res.json({ success: true, data: { name: 'Verdant & Co support API' } }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
