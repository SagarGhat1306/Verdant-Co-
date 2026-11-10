// Sends a signed test webhook.
//
//   node scripts/send-webhook.js                         -> new event, sample #1 message
//   node scripts/send-webhook.js --text "Do you deliver to Dubai?"
//   node scripts/send-webhook.js --event evt_fixed_1      -> run twice to test duplicates
//   node scripts/send-webhook.js --bad-signature          -> expect 401
//   node scripts/send-webhook.js --url https://your-api.vercel.app/api/webhook
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};

const url = arg('url', process.env.WEBHOOK_URL || 'http://localhost:5000/api/webhook');
const secret = process.env.WEBHOOK_SECRET || 'verdant-demo-secret-2026';
const suffix = crypto.randomBytes(4).toString('hex');

const payload = {
  event_id: arg('event', `evt_${suffix}`),
  type: 'message.received',
  brand_id: 'verdant-co',
  timestamp: new Date().toISOString(),
  customer: {
    id: arg('customer', 'cust_1042'),
    name: arg('name', 'Aisha Khan'),
    phone: arg('phone', '+919800000001'),
  },
  message: {
    id: arg('message-id', `msg_${suffix}`),
    type: arg('type', 'text'),
    text: arg('text', "Hi, my order #4471 hasn't arrived yet. Can I change the delivery address?"),
  },
};

const body = JSON.stringify(payload);
const signature = args.includes('--bad-signature')
  ? 'sha256=' + '0'.repeat(64)
  : 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');

const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Signature': signature },
  body,
});

console.log(`POST ${url} -> ${response.status}`);
console.log(JSON.stringify(await response.json(), null, 2));
