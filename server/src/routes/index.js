import { Router } from 'express';
import { getCurrentAgent, loginAgent } from '../controllers/auth.controller.js';
import { getConversation, getConversations } from '../controllers/conversation.controller.js';
import {
  createCustomer,
  getConversation as getCustomerConversation,
  sendMessage,
} from '../controllers/customer.controller.js';
import { approve, retry } from '../controllers/draft.controller.js';
import { getHealth } from '../controllers/health.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { customerMessageLimiter, loginLimiter } from '../middleware/rateLimiters.js';

// JSON routes. The webhook is mounted in app.js because it needs the raw body.
export const apiRouter = Router();

apiRouter.get('/health', getHealth);

// Auth
apiRouter.post('/auth/login', loginLimiter, loginAgent);
apiRouter.get('/auth/me', requireAuth, getCurrentAgent);

// Customer View (public, never returns drafts)
apiRouter.post('/customers', createCustomer);
apiRouter.get('/customers/:id/conversation', getCustomerConversation);
apiRouter.post('/customers/:id/messages', customerMessageLimiter, sendMessage);

// Agent View (JWT required)
apiRouter.get('/conversations', requireAuth, getConversations);
apiRouter.get('/conversations/:id', requireAuth, getConversation);
apiRouter.post('/drafts/:id/approve', requireAuth, approve);
apiRouter.post('/drafts/:id/retry', requireAuth, retry);
