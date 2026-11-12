# A2PCheck

Review your A2P 10DLC campaign draft before submitting it to your messaging provider. Get field-level readiness findings and suggested fixes—not registration or an approval guarantee.

## Try the hosted scanner

**[Run a free Basic check](https://www.a2pcheck.com/10dlc-check?utm_source=github&utm_medium=referral&utm_campaign=developer_precheck)** — no account required, within usage limits. Bring your campaign description, at least two representative sample messages, and your opt-in/consent flow. Do not include real subscriber data or credentials.

Basic reviews the details you paste without fetching URL contents. Full also fetches and analyzes your privacy policy and terms pages and adds a dedicated cross-field consistency check. Neither tier fetches your business website, checks registration status, sends test SMS, or guarantees approval. Signed-in Basic and Full scans use credits; see [pricing](https://www.a2pcheck.com/pricing).

## Use A2PCheck with a coding agent

The [public A2PCheck skill](skills/a2pcheck/SKILL.md) helps an agent check a campaign draft and present findings for human review. [Install the reviewed skill folder](skills/README.md), or use the [hosted agent guide](https://www.a2pcheck.com/agents) for API examples and HTTP downloads.

Installation does not run a scan or create an account. The skill defaults to an anonymous Basic request; authenticated Basic costs one credit and Full costs two. Paid calls require explicit approval. It does not submit campaigns to providers.

Want to run the engine yourself? Jump to [self-hosting](#self-host-the-worker).

## What it does

A2PCheck analyzes your 10DLC campaign fields (description, sample messages, opt-in flow, URLs, etc.) and flags issues that commonly cause Twilio/TCR rejections. It combines deterministic rule checks with AI-powered analysis to give you a RED / YELLOW / GREEN tier for each field, along with specific fix suggestions.

### Scanners

| Scanner | Type | What it checks |
|---|---|---|
| URLs | Deterministic | URL shorteners in sample messages |
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

Before resubmitting a campaign, use the [resubmission checklist](docs/10dlc-resubmission-checklist.md) to compare the description, samples, consent evidence, and supporting pages. It includes a clearly synthetic worked example and links to current Twilio guidance; using the scanner is optional.

## Architecture

This repo is the OSS scanner engine — a Cloudflare Worker that exposes the scan API.

```
Cloudflare Worker API
  |-- Deterministic scanners (instant)
  |-- AI scanners (OpenRouter via CF AI Gateway)
  |-- Firecrawl (URL content extraction)
  |-- KV (IP rate limiting)
```

The frontend at [a2pcheck.com](https://a2pcheck.com) is a separate Next.js app that calls this API.

## Self-host the worker

### Prerequisites

- Node.js 18+
- A [Cloudflare](https://dash.cloudflare.com) account (for the worker)
- A [Firecrawl](https://firecrawl.dev) API key
- Access to [OpenRouter](https://openrouter.ai) via Cloudflare AI Gateway

### Worker (API)

```bash
cd worker
npm install
cp wrangler.toml.example wrangler.toml   # Fill in your KV namespace ID
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

## Contributing and AI fixtures

See [CONTRIBUTING.md](CONTRIBUTING.md) for offline testing and the explicit, billable command that sequentially refreshes request-bound AI scanner fixtures.
See [model evaluation](worker/docs/model-evaluation.md) for provider restrictions,
model-specific decoding controls, and the synthetic gateway bake-off.

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
