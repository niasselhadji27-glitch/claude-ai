# Meta Ads Spy & AI Video Generation SaaS — MVP Architecture

> Status: **Step 1 — awaiting approval before auth implementation.**

## Product summary

A SaaS for digital marketers that combines:

1. **Meta Ad Library intelligence** — scrape winning ads (creative, copy, metadata) into a swipe file organized by boards.
2. **AI Script Studio** — GPT-4o rewrites of scraped ad transcripts (3 variations per run).
3. **Video render pipeline** — script + ElevenLabs voiceover + background assets → programmatic render (Creatomate).

## Tech stack (agreed baseline)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js (App Router), React, TailwindCSS, shadcn/ui | |
| Backend | Next.js Route Handlers + Supabase Edge Functions | Long-running work goes through a job queue, not route handlers |
| DB / Auth | Supabase (Postgres + Auth + Storage) | RLS on all user tables |
| Payments | Stripe (Checkout + Billing Portal + webhooks) | Subscription tiers + metered credits |
| Scraper | Python FastAPI + Playwright + residential proxies | Deployed separately (e.g. Railway/Fly.io); authenticated via internal API key |
| AI | OpenAI GPT-4o (scripts), Whisper (transcripts), ElevenLabs (VO) | |
| Video | Creatomate (recommended over Shotstack for MVP) | Webhook-driven status updates |

## Key architectural decisions

1. **Everything slow is a job.** Scraping, transcription, script generation, and rendering are asynchronous jobs tracked in a `jobs` table with status polling/realtime updates — never awaited inside a route handler.
2. **Meta Ad Library API first, Playwright second.** The official Ad Library API covers a subset of ads (political/EU transparency data plus page-level lookups); Playwright + proxies fills the gap. The scraper service abstracts both behind one interface.
3. **Store creatives in Supabase Storage.** Scraped video/image URLs from Meta's CDN expire; downloads are re-hosted immediately at scrape time.
4. **Credits-based metering.** Renders and scrapes consume credits attached to the subscription tier — protects margins on expensive third-party API calls (ElevenLabs + Creatomate + proxies).
5. **RLS everywhere.** All tables carry row-level security keyed on `auth.uid()`; service-role access is reserved for webhooks and the scraper callback.

## Database schema

See `supabase/migrations/00001_initial_schema.sql`. Summary:

- `profiles` — 1:1 with `auth.users`; Stripe customer ID, tier, credit balance.
- `boards` — swipe-file folders.
- `saved_ads` — scraped ads: copy, metadata (JSONB), re-hosted media path, transcript, board link.
- `generated_scripts` — AI script variations linked to a saved ad.
- `voice_profiles` — ElevenLabs voice references per user.
- `rendered_videos` — render jobs: script link, voice, assets, provider job ID, status, output URL.
- `jobs` — generic async job tracker (scrape / transcribe / generate / render).
- `credit_ledger` — append-only credit consumption/grant history.

## Build order (iterative)

1. ✅ Spec, stack critique, initial schema (this document)
2. ⬜ Project scaffold + Supabase auth flow (sign-up/login, protected routes)
3. ⬜ Stripe subscriptions + credit metering
4. ⬜ Boards + swipe file dashboard (masonry grid)
5. ⬜ Scraper service (FastAPI + Playwright) + scrape intake UI
6. ⬜ Transcription + AI Script Studio
7. ⬜ Voiceover + render pipeline (Creatomate)
