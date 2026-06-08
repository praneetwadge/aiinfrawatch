# AIInfraWatch

Live GPU pricing and AI compute cost intelligence across 16+ cloud providers.

**Live**: https://aiinfrawatch.vercel.app  
**Stack**: Next.js 14 · TypeScript · Supabase · Vercel Hobby

---

## What it does

| Route | Purpose |
|-------|---------|
| `/` | Public market index — live GPU prices, provider comparison, market signals |
| `/cost-audit` | Self-serve instant audit — paste your setup, get cheapest reliable option + savings |
| `/load-balancer` | Multi-provider job routing — beta concept, demand capture |

---

## Quick start

```bash
git clone https://github.com/praneetwadge/aiinfrawatch
cd aiinfrawatch
npm install
cp .env.local.example .env.local  # add Supabase keys at minimum
npm run dev
```

**Minimum env vars**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

---

## Data pipeline

Scrapers run daily via Vercel cron (`0 0 * * *`). Each provider has a scraper at `src/lib/scrapers/{slug}.ts` and an endpoint at `src/app/api/scrape/{slug}/route.ts`.

```bash
# Trigger a scraper manually
curl https://aiinfrawatch.vercel.app/api/scrape/runpod

# Check DB counts (Supabase SQL editor)
SELECT provider, COUNT(*) FROM gpu_listings GROUP BY provider ORDER BY count DESC;
```

Hardcoded pricing (APIs too large for serverless): `gcp, lambda, oci, paperspace, crusoe, fluidstack, ibm, gmi, voltagepark`

---

## Providers tracked

16 live providers: RunPod, AWS, Azure, GCP, CoreWeave, Lambda, Nebius, TensorDock, OCI, Paperspace, Crusoe, FluidStack, IBM, GMI, VoltagePark  
1 partial: Vast.ai

---

## API

```bash
# All H100 listings
GET /api/gpu-prices?gpu=H100

# Specific provider
GET /api/gpu-prices?provider=runpod

# CSV
GET /api/gpu-prices?format=csv

# Agent discovery
GET /llms.txt
GET /openapi.json
```

---

## Deployment

```bash
npm i -g vercel && vercel
```

Set all env vars from `.env.local.example` in Vercel dashboard. Cron runs automatically.

---

## Dev notes

See `CLAUDE.md` for architecture decisions, hard rules, and component contracts.
