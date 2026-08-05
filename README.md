# AdVault Studio — Meta Ads Spy & AI Video Generation SaaS

An MVP SaaS for performance marketers: scrape winning ads from the Meta Ad
Library into a swipe file, rewrite them with GPT-4o in the Script Studio, and
render new video variations with ElevenLabs voiceovers via Creatomate.

## Stack

- **App:** Next.js (App Router) · React · TailwindCSS v4 · TypeScript
- **Database & Auth:** Supabase (Postgres + RLS, Auth, Storage)
- **Payments:** Stripe subscriptions with a credit-metering system
- **Scraper:** Python FastAPI + Playwright service (`scraper/`), deployed separately
- **AI:** OpenAI GPT-4o (scripts) · ElevenLabs (voiceovers) · Creatomate (video renders)

## Repository layout

```
src/                    Next.js app (pages, components, API routes)
  app/(app)/            Authenticated app: dashboard, scrape, ads, renders, settings
  app/api/              Route handlers: scrape, scripts, renders, billing, webhooks
  lib/                  Supabase clients, Stripe helpers, credits, types
supabase/migrations/    SQL migrations (schema, RLS, credit functions)
scraper/                FastAPI + Playwright Meta Ad Library scraper service
docs/ARCHITECTURE.md    Architecture decisions and build order
```

## Getting started

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Run both files in `supabase/migrations/` (SQL editor, in order), or link the
   project and run `npx supabase db push`.
3. Copy the project URL, anon key, and service-role key into `.env`.

### 2. App

```bash
cp .env.example .env   # fill in your keys
npm install
npm run dev            # http://localhost:3000
```

### 3. Stripe

1. Create three recurring prices (Starter/Pro/Agency) and put their IDs in `.env`.
2. Add a webhook endpoint for `https://<your-app>/api/webhooks/stripe` with
   events: `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.paid`. Locally: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

### 4. Scraper service

```bash
cd scraper
pip install -r requirements.txt
playwright install chromium
SCRAPER_API_KEY=<shared-secret> uvicorn main:app --port 8000
```

Set `SCRAPER_SERVICE_URL` and the same `SCRAPER_API_KEY` in the app's `.env`.
In production, deploy the `scraper/Dockerfile` (Railway/Fly.io) and set
`PROXY_SERVER` to a residential proxy — Meta blocks datacenter IPs.

### 5. Creatomate

Create a template with elements named `voiceover` (audio), `script-text`
(text), and `background` (video/image), then set `CREATOMATE_API_KEY` and
`CREATOMATE_TEMPLATE_ID`.

## Credits

Usage is metered in credits (free tier starts with 10): scrape = 1,
script generation = 1, video render = 5. Monthly grants: Starter 100,
Pro 500, Agency 2000 — applied by the Stripe `invoice.paid` webhook.

## Legal note

Scraping the Meta Ad Library may violate Meta's Terms of Service. The Ad
Library is public data, but automated collection is a legal gray area —
consult counsel before launching commercially, and prefer the official
[Ad Library API](https://www.facebook.com/ads/library/api/) where it covers
your use case.
