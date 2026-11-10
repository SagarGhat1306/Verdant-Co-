// Sends the 5 sample messages through the signed webhook (a new customer
// for each) and prints the AI drafts.
//
//   node scripts/test-samples.js
//   API_URL=https://your-api.vercel.app/api node scripts/test-samples.js
import 'dotenv/config';
import crypto from 'node:crypto';

const API_URL = (process.env.API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const SECRET = process.env.WEBHOOK_SECRET || 'verdant-demo-secret-2026';
const EMAIL = process.env.DEMO_AGENT_EMAIL || 'agent@verdant.co';
const PASSWORD = process.env.DEMO_AGENT_PASSWORD || 'Verdant@2026';

const SAMPLES = [
  "Hi, my order #4471 hasn't arrived yet. Can I change the delivery address?",
  'What is your return policy?',
  'Do you deliver to Dubai?',
  'Is cash on delivery available for a ₹3,500 order?',
  "I think I'm allergic to the serum I bought. What should I do?",
];

async function post(path, body, headers = {}) {
  const raw = JSON.stringify(body);
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: raw,
  });
  return res.json();
}

const run = crypto.randomBytes(3).toString('hex');
const conversationIds = [];

for (const [index, text] of SAMPLES.entries()) {
  const payload = {
    event_id: `evt_sample_${run}_${index + 1}`,
    type: 'message.received',
    brand_id: 'verdant-co',
    timestamp: new Date().toISOString(),
    customer: {
      id: `cust_sample_${run}_${index + 1}`,
      name: `Sample Customer ${index + 1}`,
      phone: `+9197${String(Date.now()).slice(-7)}${index}`,
    },
    message: { id: `msg_sample_${run}_${index + 1}`, type: 'text', text },
  };
  const raw = JSON.stringify(payload);
  const signature = 'sha256=' + crypto.createHmac('sha256', SECRET).update(raw).digest('hex');
  const result = await post('/webhook', payload, { 'X-Signature': signature });
  if (!result.success) {
    console.error(`Sample ${index + 1} failed:`, result.error);
    continue;
  }
  conversationIds.push([text, result.data.conversationId, result.data.draft]);
}

const login = await post('/auth/login', { email: EMAIL, password: PASSWORD });
if (!login.success) throw new Error(`Login failed: ${login.error?.message}`);

for (const [text, conversationId, draftSummary] of conversationIds) {
  const res = await fetch(`${API_URL}/conversations/${conversationId}`, {
    headers: { Authorization: `Bearer ${login.data.token}` },
  });
  const { data } = await res.json();
  const draft = data.conversation.messages[0].draft;
  console.log('\n────────────────────────────────────────');
  console.log(`CUSTOMER: ${text}`);
  console.log(`DRAFT (${draftSummary.status}): ${draft.text ?? draft.errorMessage}`);
}
