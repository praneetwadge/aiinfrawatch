# AIInfraWatch

AI compute cost intelligence platform — public market index + enterprise cost audit + load balancer (beta).

**Stack**: Next.js 14 · TypeScript · Supabase · Vercel Hobby  
**Live**: https://aiinfrawatch.vercel.app  
**Repo**: github.com/praneetwadge/aiinfrawatch

---

## Non-negotiable rules

```
next.config.js  → typescript.ignoreBuildErrors: true   (keep)
                → eslint.ignoreDuringBuilds: true       (keep)
src/lib/**      → // @ts-nocheck on every file          (keep)
vercel.json     → "0 0 * * *" cron schedule             (Hobby max — never increase)
queries.ts      → 25hr query window                     (never change)
page.tsx        → getLatestGpuListings({ limit: 2000 }) (never lower — H100 data lives above rank 500)
src/**          → no puppeteer, no dotenv               (banned)
```

---

## Product structure — 3 routes

| Route | Purpose | Status |
|-------|---------|--------|
| `/` | Public market index — trust/traffic hook | Live |
| `/cost-audit` | Enterprise cost audit — paid wedge, demand test | Early access |
| `/load-balancer` | Multi-provider job routing — future automation | Beta concept |

**North star**: Optimize for teams asking "Am I overpaying for AI compute, and what should I do next?" — not GPU-price browsers.

---

## Key paths

| Path | Purpose |
|------|---------|
| `src/app/page.tsx` | Server component — fetches DB, passes props to DashboardClient |
| `src/app/cost-audit/page.tsx` | Cost audit landing + demand form ("use client") |
| `src/app/load-balancer/page.tsx` | Load balancer beta landing + demand form ("use client") |
| `src/app/layout.tsx` | Google Fonts preconnect, shared metadata |
| `src/app/globals.css` | CSS variables, keyframes — light editorial theme |
| `src/components/DashboardClient.tsx` | Full market UI (~1280 lines, "use client") |
| `src/components/SiteNav.tsx` | Sticky nav shared across all pages (logo, 3 links, CTA) |
| `src/components/DemandForm.tsx` | Frontend-only demand form — no API call, success state only |
| `src/lib/db/queries.ts` | DB queries — 25hr window, limit 2000 |
| `src/lib/db/supabase.ts` | Supabase clients |
| `src/lib/scrapers/{slug}.ts` | One scraper per provider |
| `src/app/api/scrape/{slug}/route.ts` | Individual scraper endpoints |
| `src/app/api/cron/route.ts` | Master cron (runs subset of scrapers) |
| `src/types/index.ts` | GpuListing, MarketSummary, EnergyPrice, LatencyBenchmark |

---

## Providers

**Live** (16): runpod, aws, azure, gcp, coreweave, lambda, nebius, tensordock, oci, paperspace, crusoe, fluidstack, ibm, gmi, voltagepark  
**Partial** (1): vastai  

**Hardcoded pricing** (no live API — too large for serverless): gcp, lambda, oci, paperspace, crusoe, fluidstack, ibm, gmi, voltagepark

---

## Homepage section order (locked)

1. `MarketRibbon` — 30px dark ticker, decision metrics only (no vanity counts)
2. `SiteNav` — sticky nav, links to all 3 routes, "Request cost audit" CTA always visible
3. `FunnelBanner` — dark (#171717) panel, above-the-fold product hook
4. `#market-data` anchor
5. `MarketBrief` — editorial hero + Today's Brief card (5 buyer-signal metrics)
6. `WhatWeKnow` — 3-column strip: supply leader, where prices are lower, H100 coverage status
7. `CostDesk` — amber-accented, first section in body (before index tiles)
8. `Market Index` — 5 promoted tiles (cheapest any GPU, cheapest reliable H100, hyperscaler premium, capacity confidence, A100 avg)
9. `Price Analysis` — H100SpreadChart + GpuSmallMultiples + PriceByFamily bar chart
10. `Market Signals` — auto-generated signal cards
11. `Provider Explorer` — sortable table, H100 tab default, DC-GPU filter toggle, concentration chip
12. `Methodology` — demoted 3-column text block
13. `Footer` — API / llms.txt / OpenAPI links, freshness timestamp

---

## Design system — light editorial

**Light mode only. Never dark backgrounds in content area.**  
`#171717` is reserved for the MarketRibbon, FunnelBanner, and SiteNav CTA button only.

### CSS variables (`globals.css`)

```css
--bg:             #F7F3EA;   /* warm cream — page background */
--panel:          #FFFFFF;   /* cards, table, form surfaces */
--elevated:       #EFE8DC;   /* secondary surface */
--border:         rgba(20,20,20,0.10);
--border-mid:     rgba(20,20,20,0.18);
--text-primary:   #171717;
--text-secondary: #555B63;
--text-muted:     #858B94;
--blue:           #1E5EFF;   /* neocloud / primary action / load balancer */
--green:          #087F5B;   /* cheapest / high availability / savings */
--amber:          #B7791F;   /* hyperscaler / cost desk / warnings */
--red:            #B42318;
--violet:         #6741D9;   /* marketplace / spread */
/* -dim variants: rgba at 0.08 opacity for backgrounds */
```

### Font stack

```
--font-serif: 'Playfair Display', 'Source Serif 4', Georgia, serif  → hero headings only
--font-body:  'Source Serif 4', Georgia, serif                       → body copy, MarketBrief
--font-mono:  'DM Mono', 'Fira Code', monospace                      → prices, tickers, badges
--font-sans:  system-ui, -apple-system, sans-serif                   → ALL functional UI
```

**Rule**: `SERIF`/`BODY` for editorial headlines and hero copy only. `SANS` for every label, table cell, chart axis, badge, button, and form field. `MONO` for prices, timestamps, and tickers.

### Inline style constants (used in all components)

```typescript
const MONO:  React.CSSProperties = { fontFamily: "var(--font-mono)" };
const SERIF: React.CSSProperties = { fontFamily: "var(--font-serif)" };
const SANS:  React.CSSProperties = { fontFamily: "var(--font-sans)" };
const BODY:  React.CSSProperties = { fontFamily: "var(--font-body)" };
```

### Color semantics

| Color | Meaning |
|-------|---------|
| green | Cheapest price, high availability, savings, reliable |
| amber | Hyperscaler premium, Cost Desk accent, warnings, pending |
| blue | Neocloud, primary action, Load Balancer accent, selected state |
| violet | Marketplace, spread metrics |
| `#171717` | FunnelBanner, MarketRibbon, SiteNav CTA — never content area |

---

## DashboardClient architecture

All computation is **client-side** from a flat `listings: GpuListing[]` array passed from `page.tsx`.

### Key computed values (Main component)

- `h100Avg` / `a100Avg` — credibility-guarded: only shown if `listings.length > 0` (prevents phantom price + "0 listings" contradiction)
- `cheapestH100High` — cheapest H100 with `availability === "high"`, falls back to cheapest spot
- `premiumPct` — `(hyperscalerAvg / specialistAvg - 1) * 100` for H100
- `capacityConf` — `% of listings with availability === "high"`
- `fmtP(n)` — price formatter: `$X.XX` for n < 10, `$N` for larger (fixes "$0" axis bug)

### Key components

| Component | Purpose |
|-----------|---------|
| `MarketRibbon` | Scrolling dark ticker — decision metrics, not vanity counts |
| `SiteNav` | Sticky shared nav — imported from `@/components/SiteNav` |
| `FunnelBanner` | Dark above-fold hook — "Public prices show the market. A cost audit shows your decision." |
| `MarketBrief` | Editorial hero + Today's Brief card (5 buyer signals with ConfidenceBadge) |
| `WhatWeKnow` | 3-column market facts strip (supply leader, pricing, H100 coverage) |
| `CostDesk` | Amber-accented estimator + "Request private estimate" CTA |
| `IndexTile` | 5 promoted metric tiles |
| `H100SpreadChart` | Custom bar chart — provider spread, hyperscaler multiple |
| `GpuSmallMultiples` | 2×2 GPU family cards with reliable-from price |
| `PriceByFamily` | Recharts horizontal BarChart — lowest price by GPU family (replaces broken scatter) |
| `SignalCard` | Auto-generated market signals |
| `ProviderExplorer` | Sortable table — H100 tab default, DC-GPU toggle, concentration chip, "X of Y" count |
| `ConfidenceBadge` | Inline trust signals: `high-avail` / `observed` / `partial` / `pending` / `reliable` |
| `FreshnessBadge` | Colour-coded age of listing (green < 2h, amber < 12h, red > 12h) |

### DC GPU filter (`isDcGpu`)

```typescript
const DC_GPU_KEYWORDS = ["H100","H200","A100","L40S","L40","A10G","A10","A30","A40","B200","MI300"];
// Word-boundary aware: "A40" does NOT match "RTX A4000" (checks char after keyword is not a digit)
```

ProviderExplorer defaults to H100 tab. If no H100 listings exist, falls back to "All". DC-only toggle is available but off by default.

---

## DemandForm

`src/components/DemandForm.tsx` — shared across `/cost-audit` and `/load-balancer`.

- **No API call, no backend** — frontend-only success state
- Fields: work email · monthly AI infra spend (dropdown) · current stack (dropdown) · workload type (chip select) · notes (optional)
- Props: `source: "cost-audit" | "load-balancer"`, `ctaLabel`, `accent` (color for selected chips and CTA button)
- On submit: validates email + spend + workload, then flips to success state

---

## Scraper template

```typescript
// @ts-nocheck
import axios from "axios";
import type { GpuListing, ScraperResult } from "@/types";

export async function scrapeXxx(): Promise<ScraperResult> {
  const start = Date.now();
  try {
    // fetch and transform
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

---

## Environment variables (Vercel)

```
NEXT_PUBLIC_SUPABASE_URL=https://bipxgyarjhekjgsomajv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<legacy anon key>
SUPABASE_SERVICE_ROLE_KEY=<legacy service_role key>
CRON_SECRET=pwxlive-cron-2026
NEXT_PUBLIC_APP_URL=https://aiinfrawatch.vercel.app
```

---

## DB snapshot (June 2026)

~4,200 listings · 16 active providers · scraped daily via cron  
H100: 618 listings · cheapest $1.49/hr GMI spot · reliable from $1.99/hr VoltagePark  
A100: 1,461 listings · cheapest $0.74/hr Azure on-demand (high-avail)  
RunPod: 29% of index (consumer + DC mix)  
RLS: disabled on all tables — known, not yet remediated

---

## Known issues / next priorities

- **RLS disabled**: Supabase tables have no row-level security. Not remediated yet.
- **Vast.ai partial**: scraper exists but normalization incomplete.
- **DemandForm no backend**: form captures intent only — no storage, no email. Next step is a Supabase insert or Resend webhook.
- **Load balancer not built**: routing layer is a beta concept only. The page exists to capture demand.
- **H100 hyperscaler rates hardcoded**: GCP, OCI, IBM H100 prices are static, not live-scraped.
