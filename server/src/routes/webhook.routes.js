import express, { Router } from 'express';
import { receiveWebhook } from '../controllers/webhook.controller.js';
import { webhookLimiter } from '../middleware/rateLimiters.js';
import { verifyWebhookSignature } from '../middleware/verifyWebhookSignature.js';

export const webhookRouter = Router();

// Raw body, because the signature covers the exact bytes.
webhookRouter.post(
  '/',
  webhookLimiter,
  express.raw({ type: () => true, limit: '100kb' }),
  verifyWebhookSignature,
  receiveWebhook,
);
