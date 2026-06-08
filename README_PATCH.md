# AIInfraWatch patch v3

Replace these files in the repo:

- `src/components/MarketTicker.tsx`
- `src/app/cost-audit/page.tsx`
- `src/components/AuditTool.tsx`
- `src/app/load-balancer/page.tsx`
- `src/components/DemandForm.tsx`

## What changed

- Market ticker is now the first element on Cost Audit and Load Balancer, matching homepage order:
  `MarketTicker -> SiteNav -> page content`.
- Cost Audit is paste-first and much less dense.
- Manual GPU entry is collapsed and uses safer input parsing.
- Load Balancer is shortened into one clear beta landing page.
- DemandForm is now a compact intake with optional constraints hidden.

## After replacing

Run:

```bash
npm run build
```

If you want the homepage to use the new reusable `MarketTicker` too, that can be a follow-up refactor. This patch intentionally avoids touching the large `DashboardClient.tsx` to reduce risk.
