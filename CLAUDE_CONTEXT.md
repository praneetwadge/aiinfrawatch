# AIInfraWatch — Claude Context

## Project
AI compute cost intelligence platform. Public market index (traffic hook) → Cost Audit (paid wedge) → Load Balancer (future automation).

- **Stack:** Next.js 14, TypeScript, Supabase, Vercel Hobby
- **Repo:** github.com/praneetwadge/aiinfrawatch
- **Live:** https://aiinfrawatch.vercel.app

## IDs
| Resource | Value |
|---|---|
| Vercel Project ID | `prj_a308XoHSYYeakZUBpN7ZvT59YVEJ` |
| Vercel Team | `praneetwadge-6944s-projects` |
| Supabase Ref | `bipxgyarjhekjgsomajv` |
| Cron secret | `pwxlive-cron-2026` |

## Hard Rules — Never Change
1. `next.config.js` → `ignoreBuildErrors: true` and `eslint.ignoreDuringBuilds: true`
2. All `src/lib/**` files → `// @ts-nocheck` at top
3. `vercel.json` cron → `"0 0 * * *"` (Hobby plan max)
4. `queries.ts` → 25hr window, never shorter
5. `page.tsx` → `limit: 2000` (never lower — H100 data is above rank 500 by price)
6. No `puppeteer`, no `dotenv` anywhere in `src/`
7. Hardcoded prices for: gcp, lambda, oci, paperspace, crusoe, fluidstack, ibm, gmi, voltagepark

## Routes
| Route | Purpose | Status |
|---|---|---|
| `/` | Market index | Live |
| `/cost-audit` | Enterprise cost audit, demand form | Early access |
| `/load-balancer` | Multi-provider routing | Beta concept |

## File Map
| File | Purpose |
|---|---|
| `src/app/page.tsx` | Server component, DB fetch |
| `src/app/cost-audit/page.tsx` | Cost audit landing ("use client") |
| `src/app/load-balancer/page.tsx` | Load balancer landing ("use client") |
| `src/app/layout.tsx` | Fonts, shared metadata |
| `src/app/globals.css` | CSS vars, keyframes |
| `src/components/DashboardClient.tsx` | Market UI ~1280 lines ("use client") |
| `src/components/SiteNav.tsx` | Sticky nav, all pages |
| `src/components/DemandForm.tsx` | Frontend-only form, no API |
| `src/lib/db/queries.ts` | DB queries, 25hr window |
| `src/lib/scrapers/{slug}.ts` | One per provider |
| `src/app/api/scrape/{slug}/route.ts` | Scraper endpoints |

## Providers
**Live (16):** runpod, aws, azure, gcp, coreweave, lambda, nebius, tensordock, oci, paperspace, crusoe, fluidstack, ibm, gmi, voltagepark  
**Partial:** vastai  
**Hardcoded pricing:** gcp, lambda, oci, paperspace, crusoe, fluidstack, ibm, gmi, voltagepark

## Design System
**Light editorial. Never dark content area.**

```
--bg: #F7F3EA  --panel: #FFFFFF  --elevated: #EFE8DC
--text-primary: #171717  --text-secondary: #555B63  --text-muted: #858B94
--blue: #1E5EFF   (neocloud, primary action)
--green: #087F5B  (cheapest, high-avail, savings)
--amber: #B7791F  (hyperscaler, cost desk, warnings)
--violet: #6741D9 (marketplace)
#171717 → ribbon, FunnelBanner, SiteNav CTA only
```

Fonts: `SERIF` (Playfair) → hero headlines only · `BODY` (Source Serif) → editorial copy · `SANS` (system) → all functional UI · `MONO` (DM Mono) → prices, tickers

## Homepage Section Order (locked)
MarketRibbon → SiteNav → FunnelBanner (dark) → MarketBrief → WhatWeKnow → CostDesk (amber) → Market Index → Price Analysis → Signals → Explorer → Methodology → Footer

## Key Components (DashboardClient)
- `FunnelBanner` — dark above-fold hook, 2 CTAs ("Request cost audit" / "Explore market data ↓")
- `MarketBrief` — Today's Brief card with 5 buyer signals + ConfidenceBadge
- `WhatWeKnow` — 3-column strip: supply leader, pricing origin, H100 status
- `CostDesk` — amber estimator, "Request private estimate" CTA
- `PriceByFamily` — recharts horizontal BarChart (replaced broken scatter)
- `ProviderExplorer` — H100 tab default, DC-GPU toggle, "X of Y listings", concentration chip
- `ConfidenceBadge` — levels: high-avail / observed / partial / pending / reliable
- `fmtP(n)` — price formatter: `$X.XX` for n<10, `$N` for larger (no "$0" axis bug)

## DemandForm
Frontend-only. No API call. Fields: work email · monthly spend · current stack · workload type · notes. Success state on valid submit. Props: `source`, `ctaLabel`, `accent`.

## DB Snapshot (June 2026)
~4,200 listings · 16 providers · H100: 618 listings from $1.49/hr · A100: 1,461 from $0.74/hr · RunPod: 29% of index · RLS disabled (known)

## Known Issues
- DemandForm has no backend storage — intent capture only
- Load balancer routing layer not built — page captures demand only
- Vast.ai scraper normalization incomplete
- H100 hyperscaler rates (GCP, OCI, IBM) are hardcoded, not live
- RLS disabled on all Supabase tables

## Environment Variables (Vercel)
```
NEXT_PUBLIC_SUPABASE_URL=https://bipxgyarjhekjgsomajv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<legacy anon key>
SUPABASE_SERVICE_ROLE_KEY=<legacy service_role key>
CRON_SECRET=pwxlive-cron-2026
NEXT_PUBLIC_APP_URL=https://aiinfrawatch.vercel.app
```
