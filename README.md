# Verdant & Co – AI Customer Support

A small support tool. Customer messages come in through a signed webhook (or the built-in Customer view) and get saved in Postgres. Gemini then writes a suggested reply based on the brand's policies. An agent signs in, edits the draft if needed and approves it. Only then does the customer see it. Nothing is ever sent automatically.

Live app: `https://<your-app>.vercel.app` 
Webhook: `POST https://<your-api>.vercel.app/api/webhook` · Agent login: `agent@verdant.co` / `Verdant@2026`

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
2. API: New Project → root directory `server`, framework "Other". Add the variables from `server/.env.example`, plus `NODE_ENV=production`, `NODEJS_HELPERS=0` and `CLIENT_URL=https://<your-app>.vercel.app`.
3. Frontend: New Project → root directory `client` → `VITE_BASE_URL=https://<your-api>.vercel.app/api`.



## Questions
1. A message fails at 2 a.m. What does the agent see, and how do you find out why? 

If the AI failed, the message is still saved. The conversation shows at the top with an "AI failed" badge, the error in the draft box, and a Retry button (or they can just write the reply). If the database failed, nothing was saved and the webhook returned 503, so the sender retries. To find out why, I'd search the Vercel logs by message or event id, check the error saved on the draft or webhook event, and hit `/api/health`. Next step: an alert whenever something fails.

2. Now it has to serve 20 brands. What changes first? Make "brand" a real part of the data. Add a `Brand` table with its own webhook secret and knowledge base, link agents to brands, and filter every query and login by brand. Right now the brand is a single setting, so the biggest risk is one brand's policies or customers showing up in another brand's replies. Once that's in place, per-brand retrieval and a job queue for AI calls are the next steps.
