# AIInfraWatch

Live GPU price aggregator and AI compute market intelligence platform.

**Stack**: Next.js 14 · TypeScript · Supabase · Vercel Hobby  
**Live**: https://aiinfrawatch.vercel.app  
**Repo**: github.com/praneetwadge/aiinfrawatch

---

## Non-negotiable rules

```
next.config.js  → typescript.ignoreBuildErrors: true  (keep)
                → eslint.ignoreDuringBuilds: true      (keep)
src/lib/**      → // @ts-nocheck on every file         (keep)
vercel.json     → "0 0 * * *" cron schedule            (Hobby max — never increase)
queries.ts      → 25hr query window                    (never change to 10min or shorter)
src/**          → no puppeteer, no dotenv              (banned)
```

## Key paths

| Path | Purpose |
|------|---------|
| `src/app/page.tsx` | Server component — fetches DB, passes flat listings[] to client |
| `src/components/DashboardClient.tsx` | Full market terminal UI (~1400 lines) |
| `src/app/globals.css` | Light editorial theme — CSS variables, Google Fonts import |
| `src/app/layout.tsx` | Google Fonts preconnect, metadata |
| `src/lib/db/queries.ts` | DB queries (25hr window) |
| `src/lib/db/supabase.ts` | Supabase clients |
| `src/lib/scrapers/{slug}.ts` | One scraper per provider |
| `src/app/api/scrape/{slug}/route.ts` | Individual scraper endpoints |
| `src/app/api/cron/route.ts` | Master cron (subset) |
| `src/types/index.ts` | GpuListing, MarketSummary, etc. |

## Providers

**Live**: runpod, aws, azure, gcp, coreweave, lambda, nebius, tensordock, oci, paperspace, crusoe, fluidstack, ibm, gmi, voltagepark  
**Partial**: vastai  
**Pending**: *(none)*

Hardcoded pricing (no live API — too large for serverless or no public endpoint): gcp, lambda, oci, paperspace, crusoe, fluidstack, ibm, gmi, voltagepark

## Homepage section order (locked)

1. MarketRibbon (dark ticker strip, 30px)
2. Header (brand + live/partial badges — no vanity listing count)
3. MarketBrief (hero: editorial headline + Today's Market Brief card with 4 decision metrics)
4. Market Index tiles (5 tiles: cheapest reliable H100, hyperscaler premium, capacity confidence, spot-OD spread, A100 avg)
5. Price Analysis charts (H100 spread bar + GPU small multiples + Price vs Availability scatter)
6. Market Signals (auto-generated signal cards)
7. **Private Cost Desk** (amber-accented — above the screener table, not below)
8. Provider Explorer (table: DC GPUs default-on, group-by-GPU default-on, concentration chip)
9. Methodology / Coverage (demoted — text only, no tiles)
10. Footer (API links, llms.txt, OpenAPI, freshness timestamp)

## Design system — light editorial (Economist-style)

**This is a light-mode product. Never switch to dark backgrounds in the main content area.**  
The ribbon (#171717) is the only dark element — used intentionally to frame the page.

### CSS variables (defined in globals.css)

```css
--bg:             #F7F3EA;   /* warm cream — page background */
--panel:          #FFFFFF;   /* cards, table rows */
--elevated:       #EFE8DC;   /* slightly darker surface */
--border:         rgba(20,20,20,0.10);
--border-mid:     rgba(20,20,20,0.18);
--text-primary:   #171717;
--text-secondary: #555B63;
--text-muted:     #858B94;
--blue:           #1E5EFF;   /* neocloud / primary action */
--blue-dim:       rgba(30,94,255,0.08);
--green:          #087F5B;   /* cheapest / high availability */
--green-dim:      rgba(8,127,91,0.08);
--amber:          #B7791F;   /* hyperscaler / private cost desk / warning */
--amber-dim:      rgba(183,121,31,0.08);
--red:            #B42318;
--red-dim:        rgba(180,35,24,0.08);
--violet:         #6741D9;   /* marketplace / spread */
```

### Fonts (Google Fonts, loaded in layout.tsx)

```
--font-serif: 'Playfair Display', 'Source Serif 4', Georgia, serif
--font-body:  'Source Serif 4', Georgia, serif
--font-mono:  'DM Mono', 'Fira Code', monospace
--font-sans:  system-ui, -apple-system, sans-serif
```

### Inline style constants (DashboardClient.tsx)

```typescript
const MONO:  React.CSSProperties = { fontFamily: "var(--font-mono)" };
const SERIF: React.CSSProperties = { fontFamily: "var(--font-serif)" };
const BODY:  React.CSSProperties = { fontFamily: "var(--font-body)" };
```

### Color semantics

| Color | Meaning |
|-------|---------|
| green `#087F5B` | Cheapest price, high availability, savings |
| amber `#B7791F` | Hyperscaler pricing, Cost Desk (private/premium), warnings |
| blue `#1E5EFF` | Neocloud, primary action, selected state |
| violet `#6741D9` | Marketplace, spread metrics |
| `#171717` | Ribbon only — dark-on-light intentional contrast |

## DashboardClient architecture

All grouping and metric computation is client-side from a flat `listings: GpuListing[]` array.  
`page.tsx` fetches: `computeMarketSummary()`, `getLatestGpuListings({ limit: 2000 })`, `getLatestEnergyPrices()`, `getLatencyBenchmarks()`.

Key computed values (in Main component):
- `h100Avg` / `a100Avg` — **guarded**: only shows if backed by actual listings (no phantom price + "0 listings" contradiction)
- `cheapestReliableH100` — cheapest H100 with `availability === "high"`, falls back to cheapest spot
- `premiumPct` — hyperscaler avg ÷ neocloud avg (H100), shown as %
- `capacityConf` — % of listings reporting high availability
- `spreadPct` — on-demand premium over spot (H100)

Key components:
- `MarketRibbon` — scrolling dark ticker (decision metrics, not vanity counts)
- `MarketBrief` — editorial hero + Today's Brief card (4 decision metrics)
- `IndexTile` — 5 promoted metric tiles
- `H100SpreadChart` — custom bar chart (no recharts dependency)
- `PriceVsAvailability` — recharts ScatterChart (x=$/hr, y=availability, color=category)
- `GpuSmallMultiples` — 2×2 grid of GPU family cards
- `CostDesk` — amber-accented private cost desk teaser (above ProviderExplorer)
- `ProviderExplorer` — sortable table with DC-GPU-only default toggle + concentration chip
- `SignalCard` — auto-generated market signals

## DC GPU filter

`DC_GPU_KEYWORDS = ["H100", "H200", "A100", "L40S", "L40", "A10G", "A10", "A30", "A40", "B200", "MI300"]`

ProviderExplorer defaults `dcOnly = true`. If no DC GPU listings exist in the window, the filter is bypassed gracefully (shows all, with a caveat).

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

## Known issues / next priorities

- **H100 data gap**: most H100 listings are hardcoded (GCP, Lambda, OCI). Live scraping from RunPod/CoreWeave/Nebius is the next unlock for the key metrics.
- **RLS disabled**: all Supabase tables have RLS off — known, not yet remediated.
- **Concentration risk**: runpod dominates the listing count with gaming/consumer GPUs. The DC-only filter now mitigates this on the frontend, but data diversity is the real fix.
- **Vast.ai partial**: normalization in progress.

## Correction pass — June 2026

**Root cause fixed**: `page.tsx` was fetching `limit: 500`. With 1000+ RunPod consumer cards below $1.49/hr, H100 listings never appeared. Bumped to `limit: 2000`.

**Key changes:**
- `page.tsx`: limit 500 → 2000
- `isDcGpu`: word-boundary aware — "A40" no longer matches "RTX A4000"
- Hero: leads with available signal (cheapest observed, cheapest high-avail) — not missing H100
- `WhatWeKnow` strip: 3 concise market facts after MarketBrief
- `CostDesk`: moved to top of body (before Market Index)
- `PriceByFamily`: recharts BarChart replaces broken scatter — horizontal bars, `fmtP` formatter ensures "$0.12" not "$0"
- `fmtP` helper: shows `$X.XX` for values < $10, `$N` for larger — fixes x-axis "$0" problem
- Table: defaults to H100 tab (with graceful "All" fallback if no H100), shows "X of Y listings"
- Typography: all functional UI (labels, table, chart, meta) switched from `BODY` to `SANS`; `BODY`/`SERIF` reserved for editorial headings and hero copy only
- Confidence badges: everywhere metrics are shown (IndexTile, MarketBrief, table groups)
- `ConfidenceBadge` levels: high-avail (green), observed (grey), partial (amber), pending (amber), reliable (blue)
