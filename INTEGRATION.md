# AIInfraWatch — funnel rebuild: integration & deploy

These files reorder the funnel so the **savings number is proven before any email is asked**, and add a **savings-anchored pricing page**. They match your App Router layout, your editorial tokens, and your "never break the build" rules (`// @ts-nocheck`, no new deps required except `@supabase/supabase-js`, which you already use).

## What changed, in one line
Old: paste → email gate → (maybe) a number.
New: paste → **instant in-browser number (free)** → email gates only the **migration plan** → **pricing anchored to that number**.

## File map (copy into the repo at these paths)

| This file | Repo destination |
|---|---|
| `lib/audit/estimate.ts` | `src/lib/audit/estimate.ts` |
| `app/cost-audit/CostAuditClient.tsx` | `src/app/cost-audit/CostAuditClient.tsx` |
| `app/cost-audit/page.tsx` | `src/app/cost-audit/page.tsx` (replaces current) |
| `app/pricing/PricingClient.tsx` | `src/app/pricing/PricingClient.tsx` (new route) |
| `app/pricing/page.tsx` | `src/app/pricing/page.tsx` (new route) |
| `app/api/audit-request/route.ts` | `src/app/api/audit-request/route.ts` (new) |

> Import alias: files use `@/lib/audit/estimate`. If your `tsconfig` maps `@/*` → `src/*` (default for this repo), no change needed. Otherwise switch to a relative import.

## Three wiring tasks

1. **Nav link.** Add `Pricing` to your header (`Markets · Cost Audit · Pricing · Routing Beta`). The audit's success state and every paid CTA already deep-link to `/pricing?savings=<yearly>&gpu=<model>` so the price tiers render relative to the user's own number.

2. **Supabase table** (one-time), for `/api/audit-request`:
   ```sql
   create table if not exists audit_leads (
     id bigint generated always as identity primary key,
     email text not null,
     gpu text, count int,
     current_monthly numeric, overpay_monthly numeric, overpay_yearly numeric,
     confidence text, source text,
     created_at timestamptz default now()
   );
   ```
   Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in Vercel env. If they're absent the endpoint logs instead of 500-ing, so the unlock never breaks.

3. **Floors.** The audit hydrates live floors from `/api/gpu-prices` (same-origin) and falls back to the baked-in table in `estimate.ts` (mirrors today's index). If your API JSON shape differs, adjust `applyLiveFloors()` — it's defensive and no-ops on mismatch, so nothing breaks if you skip this.

## Deploy (your established pattern)

```bash
# from repo root, on a clean working tree
git checkout -b funnel-value-first
# copy the six files into place (see map above)
git add -A
git commit -m "Funnel: ungated instant estimate + savings-anchored pricing"
git push origin funnel-value-first      # git CLI → Vercel auto-deploy
# open the Vercel preview, verify:
#   /cost-audit  -> paste "8x H100 on AWS always-on" -> number renders, no email
#   /pricing?savings=130000&gpu=H100 -> tiers show % of savings
# then merge to main for production
```
Verify the build/deploy via the Vercel MCP (`list_deployments`, `get_deployment_build_logs` limit 50) as usual. GitHub MCP stays unused.

## Guardrails honored
- Tokens: bg `#F7F3EA`, ink `#171717`, white panels, hairline `#E6E0D3`; accents blue `#1E5EFF` / green `#087F5B` / amber `#B7791F` / red `#B42318`.
- Fonts: Playfair Display (display), Source Serif 4 (body), DM Mono (numbers) — assumed already loaded in `layout`. If not, add them there; components reference the families by name.
- No dark/neon/SaaS-generic. No new build-time deps. `@ts-nocheck` on every file.

## The point of the rebuild
The free number is the pain. The email is earned by the number. The price is a sliver of the number. That's the only honest way to push *qualified* close rates high — not 50% of all traffic, but a large share of people who paste a real setup and see real overpayment.
