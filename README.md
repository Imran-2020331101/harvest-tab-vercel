# Harvest Tab — bill estimator + PDF-by-email lead magnet

Static frontend (`/public/index.html`) + two Vercel serverless functions
(`/api/submit.js`, `/api/leads.js`). No framework, no build step.

## What happens on submit

1. Person answers the wizard, one question at a time.
2. On the last step (email), the browser POSTs the answers to `/api/submit`.
3. The function re-validates and re-computes the bill server-side (never
   trusts numbers from the browser), builds a one-page PDF with `pdf-lib`,
   stores the submission in Redis (via Upstash), and emails the PDF via Resend.
4. The page shows the estimate immediately either way, and updates once the
   email confirms sent (or reports what went wrong).

## One-time setup

### 1. Install and link
```bash
npm install
npm install -g vercel   # if you don't have it
vercel link             # creates/links a Vercel project
```

### 2. Add a database (Redis, via Upstash)
Vercel KV was discontinued and folded into a native Upstash Redis
integration. In the Vercel dashboard → your project → **Storage** tab →
**Marketplace Database Providers** → **Redis** (Upstash) → connect it to
this project. This auto-injects the credentials as environment variables —
nothing to copy by hand. Depending on how the integration provisions things,
you'll get either `KV_REST_API_URL`/`KV_REST_API_TOKEN` or
`UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` — the code checks both,
so either is fine.

### 3. Add Resend (real email + PDF attachment)
- Sign up at [resend.com](https://resend.com) (free tier: 3,000 emails/month).
- Verify a sending domain under **Domains** (or use their test address
  `onboarding@resend.dev` while developing — it only delivers to your own
  Resend account email).
- Create an API key under **API Keys**.
- In Vercel → your project → **Settings → Environment Variables**, add:
  - `RESEND_API_KEY`
  - `FROM_EMAIL` (an address on your verified domain)
  - `ADMIN_SECRET` (any long random string, for step 4 below)

### 4. Deploy
```bash
vercel deploy --prod
```

## Checking stored leads

`GET /api/leads` returns the most recent 200 submissions as JSON. It's
protected by a header, not a login page:

```bash
curl https://your-project.vercel.app/api/leads \
  -H "x-admin-secret: <the ADMIN_SECRET you set>"
```

If you want a real dashboard instead of curl, point a spreadsheet tool or a
small internal page at this endpoint — the shape is stable JSON.

## Notes on the pricing model

`api/_pricing.js` is the single source of truth for the calculation (the
frontend has its own copy just for the instant on-screen preview, but the
number that gets emailed and stored always comes from the server). Harvest's
seat rates are its published prices; the usage-fee bands for projects,
tasks, clients, invoices, and amount invoiced are reconstructed from a
reported real account (Harvest doesn't publish a full rate card), so treat
those as an informed estimate, not an authoritative quote.

## Local development

```bash
vercel dev
```
This runs the static files and the `/api` functions together on
`localhost:3000`, using a `.env.local` you fill in from `.env.example`.
