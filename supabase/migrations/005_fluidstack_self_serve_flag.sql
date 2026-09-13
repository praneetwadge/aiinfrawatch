-- FluidStack exited self-serve GPU rental (pivoted to enterprise-only large-
-- cluster deals). It's no longer something a $10k-100k/mo self-serve customer
-- can actually buy, so it's removed from active comparisons/recommendations.
--
-- Historical price_history rows are deliberately NOT touched — they document
-- a real market data point (a neocloud priced self-serve H100 access, then
-- exited the segment) and feed the proprietary market dataset.
--
-- NOTE: This migration was already applied directly via the Supabase MCP on
-- 2026-09-13. This file exists to keep the repo's migration history in sync
-- with the live database — running it again is a no-op (idempotent).

ALTER TABLE providers ADD COLUMN IF NOT EXISTS self_serve boolean NOT NULL DEFAULT true;

UPDATE providers
SET self_serve = false,
    description = 'Carbon-aware GPU cloud — exited self-serve rental; enterprise-only large-cluster deals as of 2026. Historical pricing retained for market dataset.'
WHERE slug = 'fluidstack';
