-- Fixes upsertGpuListings() having been a plain insert since launch: every
-- cron run added new rows instead of replacing the existing one for a given
-- listing. Verified 2026-09-08: gpu_listings had grown to ~85,000 rows for
-- only ~200 actually-distinct listings, and duplicate-inflated price sorting
-- had started silently dropping real listings (e.g. AWS H100 on-demand)
-- past query limits.
--
-- This migration:
--   1. Backfills price_history with every observation gpu_listings ever
--      recorded, before any rows are collapsed (append-only, so no conflict
--      handling — repeated identical prices are a normal time series).
--   2. Collapses gpu_listings to one row per (provider, gpu_model, region,
--      pricing_type), keeping the most recently fetched row for each.
--   3. Adds a unique constraint on that identity so upsertGpuListings() can
--      do a real upsert going forward (see src/lib/db/queries.ts).

insert into price_history (provider, gpu_model, pricing_type, region, price_per_hour, recorded_at)
select provider, gpu_model, pricing_type, region, price_per_hour, fetched_at
from gpu_listings;

delete from gpu_listings
where id not in (
  select distinct on (provider, gpu_model, region, pricing_type) id
  from gpu_listings
  order by provider, gpu_model, region, pricing_type, fetched_at desc, id desc
);

alter table public.gpu_listings
  add constraint gpu_listings_identity_key unique (provider, gpu_model, region, pricing_type);
