# Verdant & Co – AI Customer Support

A small support tool. Customer messages come in through a signed webhook (or the built-in Customer view) and get saved in Postgres. Gemini then writes a suggested reply based on the brand's policies. An agent signs in, edits the draft if needed and approves it. Only then does the customer see it. Nothing is ever sent automatically.

- Live app: https://verdant-co-one.vercel.app
- Webhook: `POST https://verdant-co-9xwv.vercel.app/api/webhook`
- API health check: https://verdant-co-9xwv.vercel.app/api/health
- Agent login: `agent@verdant.co` / `Verdant@2026`

Stack: React + Vite + Tailwind (frontend), Node + Express (backend), Neon Postgres with plain SQL via `pg`, Gemini for drafts and embeddings, all on Vercel. I picked it because it's one language end to end, plain SQL keeps the data layer easy to read, and everything has a free tier.

## Run it locally

You need: Node 22+, a free [Neon](https://neon.tech) database and a free [Gemini API key](https://aistudio.google.com/apikey).

1. Get the database URL. In Neon, open your project → Connect, turn connection pooling off and copy the connection string (the host should *not* contain `-pooler`).

2. Set up the backend.
```bash
cd server
npm install
cp .env.example .env
```
Open `server/.env` and fill in three values:
- `DATABASE_URL`: the Neon string from step 1
- `JWT_SECRET`: any random text, 32+ characters (`node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"`)
- `GEMINI_API_KEY`: your Gemini key

3. Create the tables, the agent login and the policy embeddings. All three are safe to run again.
```bash
npm run db:setup   # creates the tables
npm run db:seed    # creates the agent login
npm run db:embed   # stores the 7 policies for retrieval
```

4. Start the backend.
```bash
npm run dev
```
Check http://localhost:5000/api/health. It should say `"database": "ok"`.

5. Start the frontend (in a second terminal).
```bash
cd client
npm install
cp .env.example .env   # already points at http://localhost:5000/api
npm run dev
```
Open http://localhost:5173.

6. Try it. In the Customer view, enter a name and phone number and send "What is your return policy?". Switch to Agent, sign in, open the conversation, edit the draft and click Approve. Switch back to Customer and the reply is there.

7. Test the webhook (from `server/`, with the backend running).
```bash
npm run webhook:send                                        # signed sample message
npm run webhook:send -- --text "Do you deliver to Dubai?"
npm run webhook:send -- --bad-signature                     # should get 401
npm run test:smoke                                          # 21 end-to-end API checks
```

If something goes wrong
- "JWT_SECRET must be at least 32 characters": make it longer.
- "table … does not exist": you skipped `npm run db:setup`.
- Drafts show "AI failed": usually Gemini is overloaded (503). Click Retry, or set another model in `GEMINI_MODEL`.

## Deploy (two Vercel projects, same repo)
1. Database: run step 3 above once against your Neon database.
2. API: New Project → root directory `server`, framework "Other". Add the variables from `server/.env.example`, plus `NODE_ENV=production`, `NODEJS_HELPERS=0` and `CLIENT_URL=https://verdant-co-one.vercel.app`.
3. Frontend: New Project → root directory `client` → `VITE_BASE_URL=https://verdant-co-9xwv.vercel.app/api`.


## Questions

### 1. A message fails at 2 a.m. What does the agent see the next morning, and how would you find out what went wrong?

It depends on what failed.

If the AI failed (Gemini was down, overloaded or too slow), nothing is lost. The customer's message was saved before the AI was called. The app already retries Gemini once on a temporary error and gives up after 20 seconds. In the morning, the agent sees that conversation in the list, sorted by latest activity, with a red "AI failed" badge. Inside, the draft box shows the actual error (for example *"Gemini did not respond within 20000 ms"*). They can click Retry, or just type the reply themselves and approve it. The customer never sees any of this.

If the database failed, nothing was saved. The webhook answered with a 503, which tells the chat system to send the message again later, so it arrives once the database is back. Where possible, the event is also recorded as FAILED with the error. If it came from the Customer view, the customer sees an error and their typed message stays in the box, so they can just press send again.

To find out what went wrong, I'd check three places:
- The database. The draft keeps the error message and how many attempts were made. The webhook event keeps its status (PROCESSED, IGNORED or FAILED) and the error. These stay around, unlike logs.
- The Vercel logs. Every step writes one JSON line with IDs (`eventId`, `messageId`, `draftId`), for example "Customer message saved", "AI draft generation failed" or "Retrieval failed". Searching by the ID shows the whole story of one message.
- `/api/health`, which says whether the database is reachable and whether the AI key is set.

What's missing today is an alert. Right now someone has to notice the badge. The next step would be a notification (email or Slack) whenever a draft or webhook event is marked FAILED.

### 2. This now has to serve 20 brands, each with its own knowledge base and agents. What would you change first, and why?

First, I'd make "brand" a real part of the data. Today the app is built for one brand:
- The brand is a single setting (`BRAND_ID`), and the webhook rejects any other `brand_id`.
- There's one webhook secret, one knowledge base and one list of agents.
- Any agent can see every conversation.
- The prompt says "Verdant & Co" directly.
- Customer IDs from the chat system must be unique across the whole database, so two brands that both send `cust_1042` would end up sharing one customer.

So the first change is:
- A `Brand` table holding each brand's name, webhook secret and prompt details.
- A `brandId` on agents, customers and knowledge base rows. Customer IDs become unique per brand, not globally.
- The webhook looks up the brand from `brand_id` and checks the signature with that brand's own secret.
- The agent's login token carries their brand, and every query filters by it, so an agent only ever sees their own brand's customers.
- Retrieval only searches that brand's policies.

I'd do this first because the worst thing that can happen with 20 brands is one brand's policies, or another brand's customers, showing up in a reply. That breaks trust, and it's hard to fix once real data is mixed. Everything else is about scale, not correctness, and can come after. With 20 brands' traffic, the next step would be moving AI calls into a background job queue, so a slow or rate-limited Gemini doesn't hold up webhook requests and retries happen automatically.