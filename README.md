# A2PCheck

Pre-scan your A2P 10DLC campaign registration data against Twilio's compliance rules before you submit — catch rejections before they happen.

**Live at [a2pcheck.com](https://a2pcheck.com)**

## What it does

A2PCheck analyzes your 10DLC campaign fields (description, sample messages, opt-in flow, URLs, etc.) and flags issues that commonly cause Twilio/TCR rejections. It combines deterministic rule checks with AI-powered analysis to give you a RED / YELLOW / GREEN tier for each field, along with specific fix suggestions.

### Scanners

| Scanner | Type | What it checks |
|---|---|---|
| URLs | Deterministic | URL shorteners, missing URLs, unreachable links |
| Opt-Out Keywords | Deterministic | STOP keyword presence (CTIA requirement) |
| HELP Keywords | Deterministic | HELP keyword presence |
| Content Flags | Deterministic | SHAFT content (sex, hate, alcohol, firearms, tobacco) |
| Campaign Description | AI | Clarity, specificity, use-case alignment |
| Sample Messages | AI | Realistic examples, opt-out language, consistency |
| Opt-In / Consent Flow | AI | Consent mechanism described, TCPA compliance |
| SHAFT Content | AI | Deep check for prohibited content categories |
| Affiliate Marketing | AI | Third-party / lead-gen patterns |
| Privacy Policy | AI + Crawl | SMS/messaging disclosure in privacy policy |
| Terms of Service | AI + Crawl | Messaging terms in ToS |
| Cross-Field Consistency | AI | Description vs. sample messages vs. use case alignment |

## Architecture

This repo is the OSS scanner engine — a Cloudflare Worker that exposes the scan API.

```
Cloudflare Worker API
  |-- Deterministic scanners (instant)
  |-- AI scanners (OpenRouter via CF AI Gateway)
  |-- Firecrawl (URL content extraction)
  |-- D1 database (scan history)
  |-- KV (rate limiting)
```

The frontend at [a2pcheck.com](https://a2pcheck.com) is a separate Next.js app that calls this API.

## Quick start

### Prerequisites

- Node.js 18+
- A [Cloudflare](https://dash.cloudflare.com) account (for the worker)
- A [Firecrawl](https://firecrawl.dev) API key
- Access to [OpenRouter](https://openrouter.ai) via Cloudflare AI Gateway

### Worker (API)

```bash
cd worker
npm install
cp wrangler.toml.example wrangler.toml   # Fill in your D1 and KV IDs
cp .dev.vars.example .dev.vars           # Fill in your API keys
npm run dev                              # Starts on http://localhost:8787
```

## Environment variables

### Worker secrets (`.dev.vars`)

| Variable | Description |
|---|---|
| `FIRECRAWL_API_KEY` | Firecrawl API key for URL crawling |
| `AI_GATEWAY_URL` | Cloudflare AI Gateway endpoint (OpenRouter) |
| `CF_AIG_TOKEN` | Cloudflare AI Gateway auth token |

### Worker config (`wrangler.toml`)

| Variable | Description |
|---|---|
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |
| `RULES_VERSION` | Scanner rules version string |

See `worker/.dev.vars.example` and `worker/wrangler.toml.example` for full details.

## API

The worker serves an OpenAPI spec at `GET /api/v1/openapi.yaml`.

Key endpoints:

- `POST /api/v1/scan` — Full scan (deterministic + AI + URL crawling)
- `POST /api/v1/scan/quick` — Quick scan (deterministic + AI, no URL crawling)
- `GET /api/v1/health` — Health check

## Disclaimer

A2PCheck is a guidance tool. It does not guarantee campaign approval. Twilio and The Campaign Registry (TCR) make final registration decisions based on their own review processes. Always refer to the official Twilio documentation for current requirements.

## License

[MIT](LICENSE)
