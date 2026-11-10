// End-to-end API test against a running server, local or deployed.
// Uses a fresh customer each run, so it's safe to repeat.
//
//   npm run test:smoke
//   API_URL=https://your-api.vercel.app/api npm run test:smoke
import 'dotenv/config';
import crypto from 'node:crypto';

const API = (process.env.API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const SECRET = process.env.WEBHOOK_SECRET || 'verdant-demo-secret-2026';
const EMAIL = process.env.DEMO_AGENT_EMAIL || 'agent@verdant.co';
const PASSWORD = process.env.DEMO_AGENT_PASSWORD || 'Verdant@2026';

let passed = 0;
let failed = 0;
function check(condition, label, detail = '') {
  if (condition) passed += 1;
  else failed += 1;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${!condition && detail ? `  -> ${detail}` : ''}`);
}

async function call(method, path, body, headers = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const sign = (raw, secret = SECRET) => `sha256=${crypto.createHmac('sha256', secret).update(raw).digest('hex')}`;
function webhook(payload, signature) {
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return call('POST', '/webhook', raw, { 'X-Signature': signature ?? sign(raw) });
}

const run = crypto.randomBytes(4).toString('hex');
const phone = `+9196${String(Date.now()).slice(-8)}`;

// ── Health and auth ────────────────────────────────────────────────
let r = await call('GET', '/health');
check(r.status === 200 && r.body.data.database === 'ok', 'health: database reachable', JSON.stringify(r.body));
check(r.body?.data.aiConfigured, 'health: Gemini key configured');

r = await call('POST', '/auth/login', { email: EMAIL, password: 'definitely-wrong' });
check(r.status === 401, 'login with wrong password -> 401');
r = await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD });
check(r.status === 200 && r.body.data.token && !JSON.stringify(r.body).includes('passwordHash'), 'login -> JWT, no hash');
const auth = { Authorization: `Bearer ${r.body?.data?.token}` };
r = await call('GET', '/conversations');
check(r.status === 401, 'agent API without token -> 401');

// ── Customer View path ─────────────────────────────────────────────
r = await call('POST', '/customers', { name: `Smoke ${run}`, phone });
check(r.status === 201, 'create customer', JSON.stringify(r.body));
const customer = r.body.data.customer;
r = await call('POST', `/customers/${customer.id}/messages`, { text: 'What is your return policy?' });
check(r.status === 201 && r.body.data.status === 'accepted', 'customer message accepted', JSON.stringify(r.body));

// ── Webhook path (same customer -> same conversation) ──────────────
r = await call('GET', `/customers/${customer.id}/conversation`);
const conversationId = r.body.data.conversation.id;
const externalId = await (async () => {
  const detail = await call('GET', `/conversations/${conversationId}`, undefined, auth);
  return detail.body.data.conversation.customer.externalId;
})();

const payload = {
  event_id: `evt_smoke_${run}`,
  type: 'message.received',
  brand_id: 'verdant-co',
  timestamp: new Date().toISOString(),
  customer: { id: externalId, name: customer.name, phone },
  message: { id: `msg_smoke_${run}`, type: 'text', text: 'Is cash on delivery available for a ₹3,500 order?' },
};
r = await webhook(payload);
check(r.status === 200 && r.body.data.status === 'accepted' && r.body.data.conversationId === conversationId,
  'webhook accepted into the same open conversation', JSON.stringify(r.body));
check(['PENDING', 'FAILED'].includes(r.body.data.draft?.status), `webhook reports draft honestly (${r.body.data.draft?.status})`);
r = await webhook(payload);
check(r.status === 200 && r.body.data.status === 'duplicate', 'duplicate event_id -> 200 duplicate, nothing saved');
r = await webhook(payload, `sha256=${'0'.repeat(64)}`);
check(r.status === 401, 'invalid signature -> 401');
r = await webhook(payload, sign(JSON.stringify(payload), 'wrong-secret'));
check(r.status === 401, 'signature with wrong secret -> 401');
r = await webhook({ ...payload, event_id: `evt_img_${run}`, message: { id: `m_img_${run}`, type: 'image' } });
check(r.status === 200 && r.body.data.status === 'ignored', 'unsupported message type -> 200 ignored');
r = await webhook({ event_id: `evt_bad_${run}`, type: 'message.received' });
check(r.status === 400, 'malformed payload -> 400');

// ── Agent review ───────────────────────────────────────────────────
r = await call('GET', '/conversations', undefined, auth);
const listed = r.body.data.conversations.find((c) => c.id === conversationId);
check(r.body.data.conversations[0]?.id === conversationId, 'conversation is first in the list (newest activity)');
check(listed?.pendingDrafts + listed?.failedDrafts === 2, 'list shows draft indicator');

r = await call('GET', `/conversations/${conversationId}`, undefined, auth);
const messages = r.body.data.conversation.messages;
check(messages.length === 2 && messages.every((m) => m.draft), 'detail: 2 customer messages, each with a draft');

let target = messages[0];
if (target.draft.state === 'FAILED') {
  console.log(`      draft failed: ${target.draft.errorMessage}`);
  r = await call('POST', `/drafts/${target.draft.id}/retry`, {}, auth);
  console.log(`      retry -> ${r.status}`);
}

const replyText = `Smoke-test approved reply ${run}`;
const attempts = await Promise.all(
  [1, 2, 3].map(() => call('POST', `/drafts/${target.draft.id}/approve`, { text: replyText }, auth)),
);
check(
  attempts.filter((a) => a.status === 201).length === 1 && attempts.filter((a) => a.status === 409).length === 2,
  'three concurrent approvals -> exactly one succeeds',
  attempts.map((a) => a.status).join(','),
);

// ── Customer sees approved reply, never drafts ─────────────────────
r = await call('GET', `/customers/${customer.id}/conversation`);
const visible = r.body.data.messages;
check(visible.some((m) => m.senderType === 'AGENT' && m.text === replyText), 'customer sees the approved reply');
check(!/draft/i.test(JSON.stringify(r.body)), 'customer API contains no draft data');
const unapproved = messages[1].draft.text;
check(!unapproved || !visible.some((m) => m.text === unapproved), 'unapproved draft text not shown to customer');

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
