# Meta Ads Studio

A self-hosted tool for Meta (Facebook/Instagram) advertisers that combines:

- **📊 Ads tracking** — spend, impressions, clicks, CTR, CPM, and ROAS pulled from the
  Meta Marketing API, with daily trend charts and a per-campaign breakdown.
- **✍️ AI ad copy** — Claude generates multiple copy variants (hook, primary text,
  headline, description, CTA), each with a distinct persuasion angle, plus a creative strategy.
- **🖼 AI images & 🎬 AI video** — text-to-image and text-to-video generation via
  Replicate (Flux, Minimax, or any model you configure). Prompts are auto-written by
  Claude from your product brief.
- **🔥 Trending ads** — search live ad creatives from the Meta Ad Library to see what
  competitors in your niche are running.

Everything works out of the box with **demo data** — add API keys as you get them.

## Quick start

```bash
npm install
cp .env.example .env   # then fill in the keys you have
npm start              # http://localhost:3000
```

## Configuration (`.env`)

| Variable | Needed for | Where to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | Ad copy + prompt generation | [platform.claude.com](https://platform.claude.com) |
| `META_ACCESS_TOKEN` | Live performance data + Ad Library | [developers.facebook.com](https://developers.facebook.com) — app with Marketing API, token with `ads_read` |
| `META_AD_ACCOUNT_ID` | Live performance data | Ads Manager URL, number after `act=` (no `act_` prefix) |
| `REPLICATE_API_TOKEN` | Image + video generation | [replicate.com](https://replicate.com/account/api-tokens) |
| `REPLICATE_IMAGE_MODEL` | optional | Any Replicate text-to-image model slug (default `black-forest-labs/flux-schnell`) |
| `REPLICATE_VIDEO_MODEL` | optional | Any Replicate text-to-video model slug (default `minimax/video-01`) |

Missing keys degrade gracefully: the dashboard and trending tab show demo data, and the
generation buttons explain what to configure.

### Notes on the Meta Ad Library

The Ad Library API requires identity verification at
[facebook.com/ads/library/api](https://www.facebook.com/ads/library/api). It returns
**all active ads** for EU-targeted searches, and political/issue ads elsewhere. For
broader competitor research outside the EU, the [Ad Library website](https://www.facebook.com/ads/library)
remains the most complete source; the demo tab shows the kind of angles to look for.

## API routes

| Route | Description |
|---|---|
| `GET /api/status` | Which integrations are configured |
| `GET /api/insights?range=last_30d` | Daily series + campaign breakdown (`last_7d/14d/30d/90d`) |
| `GET /api/trending?q=skincare&country=US` | Ad Library search |
| `POST /api/creative/copy` | `{product, audience, tone, offer}` → strategy, variants, image/video prompts |
| `POST /api/creative/image` | `{prompt, aspectRatio}` → `{url}` |
| `POST /api/creative/video` | `{prompt}` → `{url}` |

## Stack

Node.js + Express, vanilla JS frontend with hand-rolled SVG charts (light/dark aware),
`@anthropic-ai/sdk` (model `claude-opus-5` with structured JSON outputs), Replicate REST API.
