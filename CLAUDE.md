# AIInfraWatch

AI compute cost intelligence platform — public market index + self-serve instant audit + load balancer (beta).

**Stack**: Next.js 14 · TypeScript · Supabase · Vercel Hobby  
**Live**: https://aiinfrawatch.vercel.app  
**Repo**: github.com/praneetwadge/aiinfrawatch

---

## Infrastructure IDs

| Resource | Value |
|---|---|
| Vercel Project ID | `prj_a308XoHSYYeakZUBpN7ZvT59YVEJ` |
| Vercel Team | `praneetwadge-6944s-projects` |
| Supabase Ref | `bipxgyarjhekjgsomajv` |
| Cron secret | `pwxlive-cron-2026` |

---

## Non-negotiable rules

```
next.config.js  → typescript.ignoreBuildErrors: true   (keep)
                → eslint.ignoreDuringBuilds: true       (keep)
src/lib/**      → // @ts-nocheck on every file          (keep)
vercel.json     → "0 0 * * *" cron schedule             (Hobby max — never increase)
queries.ts      → 25hr window on fetched_at             (never change)
page.tsx        → getLatestGpuListings({ limit: 2000 }) (never lower — H100 lives above rank 500)
src/**          → no puppeteer, no dotenv               (banned)
```

Hardcoded pricing (no live API — too large for serverless): `gcp, lambda, oci, paperspace, crusoe, fluidstack, ibm, gmi, voltagepark`

---

## Product structure — 3 routes

| Route | Purpose | Status |
|-------|---------|--------|
| `/` | Public market index — trust/traffic hook | Live |
| `/cost-audit` | Self-serve instant audit — cheapest reliable deployment + savings from live data | Live |
| `/load-balancer` | Multi-provider job routing — future automation | Beta concept |

**North star**: Optimise for teams asking "Am I overpaying for AI compute, and what should I do next?"

---

## Key paths

| Path | Purpose |
|------|---------|
| `src/app/page.tsx` | Server component — fetches DB, passes props to DashboardClient |
| `src/app/cost-audit/page.tsx` | Server component — fetches listings, renders `<AuditTool />` |
| `src/app/load-balancer/page.tsx` | Load balancer beta landing + demand form ("use client") |
| `src/app/layout.tsx` | Google Fonts preconnect, shared metadata |
| `src/app/globals.css` | CSS variables, keyframes — light editorial theme |
| `src/components/DashboardClient.tsx` | Full market UI (~1480 lines, "use client") |
| `src/components/AuditTool.tsx` | Self-serve instant audit — GPU family + count + hours → cheapest reliable + savings |
| `src/components/MarketTicker.tsx` | Shared dark ticker — used on ALL 3 routes (same component, no remount on nav) |
| `src/components/DemandForm.tsx` | Optional post-result email capture — POSTs to `/api/audit-request` |
| `src/app/api/audit-request/route.ts` | POST handler — zod validation → supabaseAdmin insert → `audit_requests` |
| `src/lib/db/queries.ts` | DB queries — 25hr window, limit 2000, dual-priority DC fetch |
| `src/lib/db/supabase.ts` | Supabase clients (`supabase` anon, `supabaseAdmin` service-role) |
| `src/lib/market-helpers.ts` | Shared: GpuListing type, PROVIDER_META, HYPERSCALERS, getMeta, fmtP, fmtMoney, minsAgo |
| `src/lib/scrapers/{slug}.ts` | One scraper per provider |
| `src/app/api/scrape/{slug}/route.ts` | Individual scraper endpoints |
| `src/app/api/cron/route.ts` | Master cron (runs subset of scrapers) |
| `src/types/index.ts` | GpuListing, MarketSummary, EnergyPrice, LatencyBenchmark |

---

## Providers

**Live (16)**: runpod, aws, azure, gcp, coreweave, lambda, nebius, tensordock, oci, paperspace, crusoe, fluidstack, ibm, gmi, voltagepark  
**Partial (1)**: vastai

---

## Homepage section order (locked)

1. `MarketTicker` — 30px dark ticker, shared component across all routes, live price signals
2. `SiteNav` — sticky nav, "Run a cost audit" CTA always visible
3. `MarketHero` — light panel hero: eyebrow + H1 + one subline + 3-stat strip (H100 price · hyperscaler premium · capacity confidence) + exactly 2 CTAs ("Run a cost audit →" / "Explore the index ↓")
4. `#market-data` anchor
5. `Market Index` — 5 promoted tiles
6. `Price Analysis` — H100SpreadChart + GpuSmallMultiples + PriceByFamily
7. `Market Signals` — auto-generated signal cards
8. `Provider Explorer` — sortable table, best-data tab default (H100 > A100 > All)
9. `Methodology` — 3-column text block
10. `Footer` — API / llms.txt / OpenAPI links, freshness timestamp

**Removed from homepage:** `FunnelBanner`, `MarketBrief`, `WhatWeKnow`, `CostDesk`. Definitions remain in `DashboardClient.tsx` but do not render. Audit math lives in `AuditTool.tsx`.

---

## Design system — light editorial

**Light mode only. Never dark backgrounds in content area.**  
`#171717` is reserved for MarketRibbon, SiteNav CTA button, and the MarketHero "Run a cost audit" button only.

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
--amber:          #B7791F;   /* hyperscaler / warnings */
--red:            #B42318;
--violet:         #6741D9;   /* marketplace / spread */
/* -dim variants: rgba at 0.08 opacity for backgrounds */
```

### Font stack

```
--font-serif: 'Playfair Display', 'Source Serif 4', Georgia, serif  → hero headings only
--font-body:  'Source Serif 4', Georgia, serif                       → body copy
--font-mono:  'DM Mono', 'Fira Code', monospace                      → prices, tickers, badges
--font-sans:  system-ui, -apple-system, sans-serif                   → ALL functional UI
```

**Rule**: SERIF/BODY for editorial headlines only. SANS for every label, table cell, button, form field. MONO for prices, timestamps, tickers.

### Inline style constants

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
| amber | Hyperscaler premium, warnings |
| blue | Neocloud, primary action, Load Balancer accent, selected state |
| violet | Marketplace, spread metrics |
| `#171717` | MarketRibbon, SiteNav CTA, MarketHero primary CTA — never content area |

---

## DashboardClient architecture

All computation is **client-side** from a flat `listings: GpuListing[]` array passed from `page.tsx`.

### Key computed values (Main component)

- `activeProviders` — `new Set(listings.map(l => l.provider)).size` — single source of truth for all provider counts
- `totalListings` — `listings.length` — single source of truth for all listing counts
- `TOTAL_TRACKED = 16` — constant, used for "N of 16 tracked" label
- `DATA_CAVEAT` — shared caveat string used in Methodology and empty states
- `cheapestH100High` — cheapest H100 with `availability === "high"`, falls back to observed
- `a100OnDemandReliable` — fallback when A100 spot data is absent
- `premiumPct` — H100 hyperscaler vs specialist premium; falls back to `a100PremiumPct`
- `capacityConf` — `% of listings with availability === "high"`
- `fmtP(n)` — price formatter: `$X.XX` for n < 10, `$N` for larger (fixes "$0" axis bug)

### Key components

| Component | Purpose |
|-----------|---------|
| `MarketTicker` | Shared dark scrolling ticker (30px) — same component on all 3 routes, never remounts on page nav. Shows live prices: reliable floor, H100, A100, L40S, supply concentration, capacity %. |
| `SiteNav` | Sticky shared nav — imported from `@/components/SiteNav` |
| `MarketHero` | Light above-fold hero — eyebrow, H1, subline, 3-stat strip, 2 CTAs only |
| `IndexTile` | 5 promoted metric tiles — never show "—", always fallback to best available data |
| `H100SpreadChart` | Custom bar chart — provider spread, hyperscaler multiple |
| `GpuSmallMultiples` | 2×2 GPU family cards with reliable-from price |
| `PriceByFamily` | Recharts horizontal BarChart — lowest price by GPU family |
| `SignalCard` | Auto-generated market signals |
| `ProviderExplorer` | Sortable table — default tab = first family with data (H100 > A100 > All) |
| `ConfidenceBadge` | Inline trust signals: `high-avail` / `observed` / `partial` / `pending` / `reliable` |
| `FreshnessBadge` | Colour-coded age of listing (green < 2h, amber < 12h, red > 12h) |
| `AuditTool` | Self-serve instant audit on `/cost-audit` — GPU family + count + hours → cheapest reliable + savings + optional email capture |

### DC GPU filter (`isDcGpu`)

```typescript
const DC_GPU_KEYWORDS = ["H100","H200","A100","L40S","L40","A10G","A10","A30","A40","B200","MI300"];
// Word-boundary aware: "A40" does NOT match "RTX A4000" (checks char after keyword is not a digit)
```

### ProviderExplorer tab default

```typescript
const getDefaultFamily = () => {
  if (listings.some(l => l.gpu_model.includes("H100"))) return "H100";
  if (listings.some(l => l.gpu_model.includes("A100"))) return "A100";
  return "All";
};
```
Never auto-lands on an empty table.

---

## AuditTool

`src/components/AuditTool.tsx` — client component, receives `listings: GpuListing[]` from the `/cost-audit` server page.

**Primary input:** free-text paste of current setup (bill summary, architecture notes, provider quote, plain English). Manual GPU entry (family / count / hours / situation) is collapsed behind an "Enter manually instead" toggle.

**Manual computation (instantaneous when expanded):**
- `cheapestReliable` = cheapest with `availability === "high"` for family; falls back to cheapest observed
- `baseline` = cheapest in the user's current situation category (hyperscaler assumed for "unsure")
- `savings` = `(baseline - cheapestReliable) * hours * gpuCount` per month
- Credibility guard: if no reliable listing, labels result "cheapest observed — not reliability-verified" in amber; if no listings at all, shows honest empty state

**Submit:** POSTs to `/api/audit-request` with `source: "cost-audit"`, pasted setup text as `notes`. Email field + submit button are always visible (paste-first flow).

---

## DemandForm

`src/components/DemandForm.tsx` — optional post-result capture on `/cost-audit`; primary form on `/load-balancer`.

- **Wired to backend** — POSTs to `/api/audit-request`, stores in `audit_requests` table
- Fields: work email · monthly AI infra spend (dropdown) · current stack (dropdown) · workload type (chip select) · notes (optional)
- Props: `source: "cost-audit" | "load-balancer"`, `ctaLabel`, `accent`
- On `/cost-audit`: success copy = "We'll email the full breakdown to {email}"
- On `/load-balancer`: success copy = "We'll reply to {email} within 1–2 business days"

## API: `/api/audit-request`

`src/app/api/audit-request/route.ts` — POST only.

- Validates with zod: `email` (required), `monthlySpend` (required), `workload` (required), `stack` (optional), `notes` (optional), `source` enum
- Inserts via `supabaseAdmin` into `audit_requests` table
- Returns `{ success: true, email }` or `{ success: false, error: string }`

## DB tables

| Table | Purpose |
|-------|---------|
| `gpu_listings` | Live GPU price data — primary index |
| `price_history` | Historical prices for trend data |
| `providers` | Provider metadata |
| `energy_prices` | Electricity prices by region |
| `latency_benchmarks` | Provider latency data |
| `audit_requests` | Cost audit + load-balancer demand form submissions |

`audit_requests` schema: `id uuid, email text, monthly_spend text, stack text, workload text, notes text, source text, created_at timestamptz`  
RLS: disabled on all tables — known, not yet remediated.

---

## CTA copy (locked)

| Surface | CTA text |
|---------|---------|
| SiteNav | "Run a cost audit" |
| MarketHero primary | "Run a cost audit →" |
| MarketHero secondary | "Explore the index ↓" |
| AuditTool email capture | "Email me the full breakdown →" |
| DemandForm (load-balancer) | "Join the beta" |

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
- **Load balancer not built**: routing layer is a beta concept only. The page exists to capture demand.
- **H100 hyperscaler rates hardcoded**: GCP, OCI, IBM H100 prices are static, not live-scraped.
- **Vercel Hobby cron limit**: daily only (00:00 UTC). Upgrade to Pro for more frequent scraping.
