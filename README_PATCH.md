# AIInfraWatch page cleanup patch

Replace these files in the repo with the matching paths in this zip:

- `src/components/MarketTicker.tsx` — new reusable top market ticker with market-style signals instead of mostly meta stats.
- `src/app/cost-audit/page.tsx` — reframes Cost Audit around paste-first setup intake, shows value/sample result before forms.
- `src/components/AuditTool.tsx` — simplifies the Cost Audit interaction: textarea first, manual calculator collapsed, calmer result cards.
- `src/app/load-balancer/page.tsx` — simplifies Load Balancer positioning around async/non-critical workload routing and adds ticker.
- `src/components/DemandForm.tsx` — simplified progressive-disclosure form used by Load Balancer and other demand pages.

After replacing files, run:

```bash
npm install
npm run build
```

Notes:
- Upload buttons on Cost Audit are intentionally marked "soon" and disabled so the page can sell the workflow without pretending uploads are implemented.
- Load Balancer is now explicitly framed as async-first beta, not full enterprise orchestration.
