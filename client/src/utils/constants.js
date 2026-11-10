// Backend API base URL (VITE_BASE_URL). Adds /api if it's missing, so both
// https://my-api.vercel.app and https://my-api.vercel.app/api work.
const rawBaseUrl = (import.meta.env.VITE_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
export const BASE_URL = rawBaseUrl.endsWith('/api') ? rawBaseUrl : `${rawBaseUrl}/api`;

export const TEST_CUSTOMERS = [];

export const SAMPLE_MESSAGES = [
  "Hi, my order #4471 hasn't arrived yet. Can I change the delivery address?",
  'What is your return policy?',
  'Do you deliver to Dubai?',
  'Is cash on delivery available for a ₹3,500 order?',
  "I think I'm allergic to the serum I bought. What should I do?",
];

export const MAX_MESSAGE_LENGTH = 2000;
