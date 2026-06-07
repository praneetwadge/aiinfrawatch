# AIInfraWatch — AI Infrastructure Market Intelligence

Real-time GPU pricing, energy costs, and latency benchmarks across 30+ cloud providers.
Built to be the authoritative data source for AI infrastructure decisions — for humans, bots, and AI agents. 

---

## Architecture

```
Next.js (SSR)          Supabase (Postgres)       Vercel Cron
    │                       │                        │
    ├── /api/gpu-prices ────┤ gpu_listings            │
    ├── /api/energy ────────┤ energy_prices           │
    ├── /api/providers ─────┤ market_snapshots        │
    └── /api/cron ──────────┴─────────────────────────┘
                              ↑ every 5 min
```

## Providers Tracked

| Provider    | Method        | Auth Required |
|-------------|---------------|---------------|
| vast.ai     | REST API      | Optional (key unlocks more data) |
| RunPod      | GraphQL API   | Optional |
| Lambda Labs | REST API      | Required |
| CoreWeave   | Published pricing + API | Optional |
| AWS         | Public pricing JSON | None |
| GCP         | Billing Catalog API | None |
| Azure       | Retail Prices API | None |
| Nebius      | Published pricing | None |

## Quick Start

### 1. Clone and install

```bash
git clone <repo>
cd aiinfrawatch
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the migration: `supabase/migrations/001_initial_schema.sql`
3. Copy your project URL and keys

### 3. Configure environment

```bash
cp .env.local.example .env.local
# Edit .env.local with your keys
```

**Minimum required:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
- `SUPABASE_SERVICE_ROLE_KEY`

**Optional (adds more data):**
- `VASTAI_API_KEY` — [vast.ai console](https://vast.ai/console/account)
- `RUNPOD_API_KEY` — [RunPod settings](https://www.runpod.io/console/user/settings)
- `LAMBDA_API_KEY` — [Lambda API keys](https://cloud.lambdalabs.com/api-keys)
- `EIA_API_KEY` — [EIA Open Data](https://www.eia.gov/opendata/) (free)
- `COREWEAVE_API_KEY` — [CoreWeave console](https://cloud.coreweave.com/api-access)

### 4. Seed initial data

```bash
npm run seed
```

### 5. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 6. Test scrapers

```bash
# Run all scrapers
npm run scrape

# Test a specific provider
npm run scrape -- --provider vastai
npm run scrape -- --provider runpod
```

---

## Deployment (Vercel)

```bash
npm i -g vercel
vercel
```

**Required environment variables in Vercel:**
- All keys from `.env.local`
- `CRON_SECRET` — random string to protect cron endpoint

**Cron is configured in `vercel.json`** — scrapes every 5 minutes automatically on Vercel Pro.

---

## API Reference

### `GET /api/gpu-prices`

Returns current GPU listings.

```bash
# All H100 spot instances
curl https://your-domain.com/api/gpu-prices?gpu=H100&type=spot

# CSV export
curl https://your-domain.com/api/gpu-prices?format=csv

# Specific provider
curl https://your-domain.com/api/gpu-prices?provider=vastai
```

### `GET /api/energy`

Returns electricity prices and carbon intensity by region.

### `GET /api/providers`

Returns market summary with averages and cheapest options.

### Agent Discovery

- `GET /llms.txt` — Human-readable description for LLM agents
- `GET /openapi.json` — OpenAPI 3.1 spec for programmatic discovery

---

## Data Pipeline

```
Scrapers (every 5 min)
    ├── vast.ai API → normalize → gpu_listings table
    ├── RunPod GraphQL → normalize → gpu_listings table
    ├── Lambda REST → normalize → gpu_listings table
    ├── AWS pricing JSON → normalize → gpu_listings table
    ├── GCP billing API → normalize → gpu_listings table
    └── CoreWeave pricing → normalize → gpu_listings table

Energy (every hour)
    ├── EIA API (US grids) → energy_prices table
    └── Static baselines (EU, APAC) → energy_prices table

Price History
    └── Every scrape writes to price_history for trend calculation
```

---

## Roadmap

### Phase 1 (this repo) ✓
- [x] Core scraper pipeline
- [x] Supabase schema
- [x] Live dashboard
- [x] Public API
- [x] Agent discovery (llms.txt, OpenAPI)

### Phase 2 — Enterprise Optimizer
- [ ] Workload cost calculator
- [ ] Multi-provider comparison engine
- [ ] Cloud account integration (read-only)
- [ ] Slack/email price alerts
- [ ] Savings recommendations

### Phase 3 — Market Maker
- [ ] Price trend forecasting
- [ ] Bulk pricing negotiation layer
- [ ] GPU futures / reservation marketplace
- [ ] Energy arbitrage signals
