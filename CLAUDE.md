# AIInfraWatch

AI Infrastructure Markets — GPU pricing intelligence, cost audit, and workload routing.

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

## Non-negotiable invariants

```
next.config.js  → typescript.ignoreBuildErrors: true, eslint.ignoreDuringBuilds: true
src/lib/**      → // @ts-nocheck on every file
vercel.json     → "0 0 * * *" cron (Hobby max — never increase)
queries.ts      → 25hr window on fetched_at (never change — cron timing fragility noted below)
page.tsx        → getLatestGpuListings({ limit: 2000 }) — never lower (H100 lives above rank 500)
src/**          → no puppeteer, no dotenv
```

Hardcoded pricing (live API too large for serverless): `gcp, lambda, oci, paperspace, crusoe, fluidstack, ibm, gmi, voltagepark`

**Cron fragility**: 25hr window is a hard cutoff. If cron runs late or fails, the entire site shows empty. The window is locked — fix must be on the cron side (retrigger manually via `/api/cron` with `Authorization: Bearer pwxlive-cron-2026`).

---

## Product — 3 routes

| Route | File | Purpose | Status |
|-------|------|---------|--------|
| `/` | `DashboardClient.tsx` | Market intelligence hook — GPU prices, spreads, availability signals | Live |
| `/cost-audit` | `AuditTool.tsx` | Stack intake + instant audit — paste your bill, get the gap and first move | Live |
| `/load-balancer` | `load-balancer/page.tsx` | Routing beta — demand capture + future automated workload routing | Beta |

**North star**: "Am I overpaying, what can safely move, and what could eventually route automatically?"

---

## Key files

| Path | Purpose |
|------|---------|
| `src/app/page.tsx` | Server — fetches summary + listings (limit 2000), passes to DashboardClient |
| `src/app/cost-audit/page.tsx` | Server — fetches listings, renders AuditTool |
| `src/app/load-balancer/page.tsx` | Server — fetches listings + summary, renders routing beta page |
| `src/app/layout.tsx` | Shared metadata, OG tags, font preconnects |
| `src/app/globals.css` | CSS variables, keyframes — light editorial theme |
| `src/app/sitemap.ts` | Sitemap for crawlers |
| `src/components/DashboardClient.tsx` | Full market UI (~780L, "use client") |
| `src/components/AuditTool.tsx` | Cost audit tool — paste-first, text parser, instant ResultCard |
| `src/components/MarketTicker.tsx` | Dark 30px ticker — shared across all 3 routes, no remount on nav |
| `src/components/SiteNav.tsx` | Sticky nav — hides CTA when already on /cost-audit |
| `src/components/DemandForm.tsx` | Email capture form — POSTs to /api/audit-request |
| `src/app/api/audit-request/route.ts` | POST — zod → supabaseAdmin → audit_requests table |
| `src/lib/db/queries.ts` | DB queries — 25hr window, limit 2000, dual-priority DC fetch |
| `src/lib/db/supabase.ts` | Supabase clients (anon + service-role) |
| `src/lib/market-helpers.ts` | Shared: GpuListing, PROVIDER_META, HYPERSCALERS, getMeta, fmtP, fmtMoney, minsAgo |
| `src/lib/scrapers/{slug}.ts` | One scraper per provider — do not modify on frontend passes |
| `src/app/api/scrape/{slug}/route.ts` | Individual scraper endpoints |
| `src/app/api/cron/route.ts` | Master cron — runs all scrapers |
| `public/llms.txt` | Agent/LLM discovery — 16 providers, daily freshness, no false claims |
| `public/openapi.json` | OpenAPI 3.1 spec — domain aiinfrawatch.vercel.app |

---

## Providers

**Live (16)**: runpod, aws, azure, gcp, coreweave, lambda, nebius, tensordock, oci, paperspace, crusoe, fluidstack, ibm, gmi, voltagepark
**Partial (1)**: vastai

---

## Homepage section order (locked)

1. `MarketTicker` — 30px dark ticker, shared component, all 3 routes
2. `SiteNav` — sticky, 3 links (Markets / Cost Audit / Routing Beta) + "Audit my stack" CTA (hidden on /cost-audit)
3. `MarketHero` — eyebrow + H1 "AI Infrastructure Markets" + subheadline + 3-stat strip (H100 floor / hyperscaler premium / capacity) + 2 CTAs
4. `#market-data` anchor → H100SpreadChart + GpuSmallMultiples (chart header: "The cheapest price and the cheapest safe price are not the same.")
5. Audit CTA bar — dark #171717 block: "This is the market. What's your stack actually costing you?" + "Audit my stack →"
6. Provider Explorer — collapsed behind `<details>` "Explore full provider index"
7. Routing Beta teaser — light `--elevated` block, "Learn about routing beta →"
8. Methodology — one compact paragraph (observed/reliable definitions, hardcoded providers, daily freshness)
9. Footer — provider count · Routing Beta link · API/llms.txt/OpenAPI · last updated

**Removed from homepage:** `FunnelBanner`, `MarketBrief`, `WhatWeKnow`, `CostDesk`, `PriceByFamily`, `SignalCard`, `IndexTile`, `Sparkline`, `SectionHead`, status module (4-card), "Today's Market Signals" feed, pain cards, "What can safely move" table, "Current prices" tiles. All were redundant repetitions of the same 3–4 facts (H100 price, A100 price, capacity %, concentration %).

**Freshness language**: "Updated daily" everywhere. No "live", "just now", "5-minute" claims. Cron is daily (Hobby max).

---

## Design system

**Light mode only. Never dark backgrounds in content area.**
`#171717` reserved for: MarketTicker, SiteNav CTA button, MarketHero primary CTA, Markets audit CTA bar.

### CSS variables (`globals.css`)

```css
--bg:             #F5F1E8;
--panel:          #FEFCF8;
--elevated:       #EDE7DA;
--border:         rgba(20,20,20,0.09);
--border-mid:     rgba(20,20,20,0.16);
--text-primary:   #1A1A1A;
--text-secondary: #4A5058;
--text-muted:     #8A9099;
--blue:           #2B6CB0;
--blue-dim:       rgba(43,108,176,0.07);
--green:          #276749;
--green-dim:      rgba(39,103,73,0.07);
--amber:          #975A16;
--amber-dim:      rgba(151,90,22,0.07);
--red:            #9B1C1C;
--red-dim:        rgba(155,28,28,0.07);
--violet:         #553C9A;
```

### Fonts

```
--font-serif: 'Playfair Display', Georgia, serif       → hero H1 only
--font-body:  'Source Serif 4', Georgia, serif          → body editorial copy
--font-sans:  system-ui, -apple-system, sans-serif      → ALL functional UI
--font-mono:  'DM Mono', monospace                      → prices, ticker, badges
```

### Design rules

- **Badge rule**: Amber badge for exception states only (observed-only, not-in-snapshot). Never a green "high availability" badge — reliable is the unmarked default.
- **Metric rule**: Each metric appears once. H100 price → hero stat strip. Premium → hero only. Capacity → hero only.
- **Recharts**: Removed — H100SpreadChart and GpuSmallMultiples use custom CSS bars. Do not re-add recharts import.

---

## DashboardClient components

| Component | Status | Purpose |
|-----------|--------|---------|
| `MarketHero` | Active | Hero — 3-stat strip, 2 CTAs |
| `H100SpreadChart` | Active | Custom CSS bar chart — provider H100 spread |
| `GpuSmallMultiples` | Active | 2×2 GPU cards — gap % between observed and reliable is the headline |
| `ProviderExplorer` | Active | Sortable table, collapsed by default |
| `ConfidenceBadge` | Active | observed / pending badges only |
| `FreshnessBadge` | Active | Age of listing — green/amber/red |
| `Rule` | Active | `<hr>` utility |
| `IndexTile` | **Removed** | Replaced by GpuSmallMultiples and hero stats |
| `Sparkline` | **Removed** | Was decorative noise inside tiles |
| `PriceByFamily` | **Removed** | Recharts bar chart — redundant with GpuSmallMultiples |
| `SignalCard` | **Removed** | Replaced by inline content |
| `SectionHead` | **Removed** | Replaced by inline labels |

### Key computed values in Main

```typescript
activeProviders   // Set of providers in current snapshot
h100High          // H100 listings with availability === "high"
cheapestH100High  // cheapest high-avail H100 — used in hero + GpuSmallMultiples
h100Prices        // all H100 spot prices sorted asc
a100Prices        // all A100 spot prices sorted asc
premiumPct        // hyperscaler vs specialist premium (H100); falls back to a100PremiumPct
capacityConf      // % of all listings with availability === "high"
```

---

## AuditTool

`src/components/AuditTool.tsx` — receives `listings: GpuListing[]`.

### Flow

1. **Textarea** — paste-first, always visible. Placeholder shows example.
2. **Chips** ("Cloud bill", "Architecture notes", "Provider quote", "Plain English") — functional buttons that insert a relevant starter prefix if textarea is empty.
3. **Live preview** — `ResultCard` renders automatically as soon as `hasInput` is true (text typed OR manual panel opened). No button press needed to see a result.
4. **Text parser** (`parseStackText`) — extracts GPU family, count, hours/mo, current provider, workload type from free text using regex. Matched terms shown as blue chips. Drives the result without requiring manual dropdowns.
5. **Refine panel** ("Refine with structured details") — seeds manual fields from parsed values when first opened. Result updates live as fields change.
6. **Email gate** — "Email me the full breakdown" button appears below the result. Opens email input → "Send stack audit" submits to `/api/audit-request`.

### hasInput logic

```typescript
const hasInput = setupText.trim().length > 0 || (showManual && manualTouched);
// manualTouched starts false; set to true only when visitor actually changes a field
// Prevents ResultCard from rendering just because the panel was opened
```

### Parsed values vs manual fields

When `showManual === false`: effective values come from `parseStackText(setupText)`, falling back to manual field defaults.
When `showManual === true`: manual fields take full control.

### ResultCard

Computes from live listings:
- `cheapestObserved` — lowest price for family
- `cheapestReliable` — lowest `availability === "high"` for family
- `baseline` — cheapest from current situation category (hyperscaler/neocloud/marketplace)
- `savings` — `(baseline - cheapestReliable) * gpuCount * hours`
- `reliabilityRisk` — Low / Medium / High based on reliable supply presence
- One-line advice bound to workload type + savings magnitude

---

## CTA copy (locked)

| Surface | CTA text |
|---------|---------|
| SiteNav (on Markets + Routing Beta) | "Audit my stack" |
| SiteNav (on /cost-audit) | Hidden — page has its own CTAs |
| MarketHero primary | "Run cost audit →" |
| MarketHero secondary | "View market data ↓" |
| Markets audit CTA bar | "Audit my stack →" |
| AuditTool email gate | "Email me the full breakdown" |
| AuditTool submit | "Send stack audit" |
| DemandForm (cost-audit) | "Get my compute audit" |
| DemandForm (load-balancer) | "Request beta access" |
| Routing Beta teaser (homepage) | "Learn about routing beta →" |

---

## DemandForm

`src/components/DemandForm.tsx` — POSTs to `/api/audit-request`.

- Props: `source: "cost-audit" | "load-balancer"`, `headline`, `ctaLabel`, `accent`
- Fields: email (required), workload textarea, monthly spend dropdown
- On `/cost-audit` success: "We'll email the full breakdown to {email} within one business day."
- On `/load-balancer` success: "We'll reply to {email} within 1–2 business days."

---

## API: `/api/audit-request`

POST only. Zod schema: `email` (req), `monthlySpend` (req), `workload` (req), `stack` (opt), `notes` (opt), `source` enum.
Inserts via `supabaseAdmin` → `audit_requests` table.
Returns `{ success: true, email }` or `{ success: false, error }`.

`audit_requests` schema: `id uuid, email text, monthly_spend text, stack text, workload text, notes text, source text, created_at timestamptz`

RLS: disabled on all tables — known, not remediated.

---

## DB tables

| Table | Purpose |
|-------|---------|
| `gpu_listings` | Primary price index |
| `price_history` | Historical prices |
| `providers` | Provider metadata |
| `energy_prices` | Seed/experimental — not on a fixed schedule |
| `latency_benchmarks` | Seed/experimental — not surfaced in UI |
| `audit_requests` | Audit + routing beta submissions |

---

## DB snapshot (June 2026)

~13,778 listings · 16 providers · daily cron
H100: reliable from $1.99/hr (VoltagePark) · observed from $1.49/hr (GMI)
A100: reliable from $0.73/hr (Azure) · 546 listings
RunPod: ~31% of index
Capacity confidence: ~65% high-availability

---

## Known issues

- **RLS disabled** — all Supabase tables have no row-level security.
- **Cron fragility** — 25hr hard cutoff means a missed/late cron empties the entire site. Manual trigger: `GET /api/cron` with `Authorization: Bearer pwxlive-cron-2026`.
- **Vast.ai partial** — scraper exists, normalization incomplete.
- **H100 hyperscaler rates hardcoded** — GCP, OCI, IBM H100 not live-scraped.
- **Vercel Hobby cron** — daily max. Upgrade to Pro for more frequent scraping.
- **Routing layer not built** — /load-balancer captures demand only.

---

## Scraper templates

```typescript
// src/lib/scrapers/xxx.ts
// @ts-nocheck
import axios from "axios";
import type { GpuListing, ScraperResult } from "@/types";

export async function scrapeXxx(): Promise<ScraperResult> {
  const start = Date.now();
  try {
    return { provider: "slug", listings, success: true, duration_ms: Date.now() - start };
  } catch (err) {
    return { provider: "slug", listings: [], success: false, error: err.message, duration_ms: Date.now() - start };
  }
}
```

```typescript
// src/app/api/scrape/xxx/route.ts
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

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=https://bipxgyarjhekjgsomajv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
CRON_SECRET=pwxlive-cron-2026
NEXT_PUBLIC_APP_URL=https://aiinfrawatch.vercel.app
```
