# AIInfraWatch

Live GPU price aggregator and AI compute market terminal.

**Stack**: Next.js 14 · TypeScript · Supabase · Vercel Hobby  
**Live**: https://aiinfrawatch.vercel.app  
**Repo**: github.com/praneetwadge/aiinfrawatch

---

## Non-negotiable rules

```
next.config.js  → typescript.ignoreBuildErrors: true  (keep)
                → eslint.ignoreDuringBuilds: true      (keep)
src/lib/**      → // @ts-nocheck on every file         (keep)
vercel.json     → "0 0 * * *" cron schedule            (Hobby max)
queries.ts      → 25hr query window                    (never 10min)
src/**          → no puppeteer, no dotenv              (banned)
```

## Key paths

| Path | Purpose |
|------|---------|
| `src/app/page.tsx` | Server component, DB fetch |
| `src/components/DashboardClient.tsx` | Full market terminal UI |
| `src/lib/db/queries.ts` | DB queries (25hr window) |
| `src/lib/db/supabase.ts` | Supabase clients |
| `src/lib/scrapers/{slug}.ts` | One scraper per provider |
| `src/app/api/scrape/{slug}/route.ts` | Individual scraper endpoints |
| `src/app/api/cron/route.ts` | Master cron (subset) |
| `src/types/index.ts` | GpuListing, MarketSummary, etc. |

## Providers

**Live**: runpod, aws, azure, gcp, coreweave, lambda, nebius, tensordock, oci, paperspace, crusoe, fluidstack  
**Partial**: vastai  
**Pending**: ibm, gmi, voltagepark

Hardcoded pricing (no live API): gcp, lambda, oci, paperspace, crusoe, fluidstack

## Scraper template

```typescript
// @ts-nocheck
import axios from "axios";
import type { GpuListing, ScraperResult } from "@/types";

export async function scrapeXxx(): Promise<ScraperResult> {
  const start = Date.now();
  try {
    // ... fetch and transform
    return { provider: "slug", listings, success: true, duration_ms: Date.now() - start };
  } catch (err) {
    return { provider: "slug", listings: [], success: false, error: err.message, duration_ms: Date.now() - start };
  }
}
```

## Scraper endpoint template

```typescript
// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { scrapeXxx } = await import("@/lib/scrapers/xxx");
    const { upsertGpuListings } = await import("@/lib/db/queries");
    const result = await scrapeXxx();
    if (result.listings?.length > 0) await upsertGpuListings(result.listings);
    return NextResponse.json({ success: true, provider: "xxx", count: result.listings?.length ?? 0 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
```

## Running scrapers manually

```bash
# Trigger individual provider
curl https://aiinfrawatch.vercel.app/api/scrape/runpod

# Check DB counts
# Supabase → SQL editor:
# SELECT provider, COUNT(*) FROM gpu_listings GROUP BY provider ORDER BY count DESC;
```

## Environment variables (Vercel)

```
NEXT_PUBLIC_SUPABASE_URL=https://bipxgyarjhekjgsomajv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<legacy anon key>
SUPABASE_SERVICE_ROLE_KEY=<legacy service_role key>
CRON_SECRET=pwxlive-cron-2026
NEXT_PUBLIC_APP_URL=https://aiinfrawatch.vercel.app
```

## Design tokens

```typescript
const MONO = { fontFamily: "monospace" };
const UPPER = { textTransform: "uppercase", letterSpacing: "0.08em" };
// Colors: #00d084 green, #3b82f6 blue, #f59e0b amber, #8b5cf6 purple
// Bg: #080808 · Surface: #0c0c0c · Border: #111
```
