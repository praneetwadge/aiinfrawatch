-- Root cause of the Sept 8 -> Sept 13 silent write failure:
-- gpu_listings_identity_key was UNIQUE(provider, gpu_model, region, pricing_type),
-- which does NOT include gpu_count. Multiple scrapers legitimately return more
-- than one GPU-count tier for the same provider/model/region/pricing_type (e.g.
-- H100 x1 / x4 / x8 at different per-hour rates). Postgres cannot apply
-- ON CONFLICT DO UPDATE twice to the "same" row within one upsert statement, so
-- every batch containing 2+ count-tiers threw "ON CONFLICT DO UPDATE command
-- cannot affect row a second time" and the WHOLE batch rolled back -- silently,
-- since the cron route catches per-provider errors and always returns 200.
-- This affected 13 of 15 providers every night since 2026-09-08.
--
-- NOTE: already applied live via Supabase MCP on 2026-09-13. This file keeps
-- the repo's migration history in sync -- re-running it is a safe no-op.

ALTER TABLE gpu_listings DROP CONSTRAINT IF EXISTS gpu_listings_identity_key;
ALTER TABLE gpu_listings ADD CONSTRAINT gpu_listings_identity_key
  UNIQUE (provider, gpu_model, region, pricing_type, gpu_count);
