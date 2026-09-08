-- Enable RLS with zero policies on every table that had it disabled.
-- Every read/write in this app goes through the service-role client
-- (supabaseAdmin in src/lib/db/supabase.ts), which bypasses RLS entirely —
-- nothing queries Supabase with the anon key. So this closes off direct
-- anon/PostgREST access without changing any app behavior. Matches the
-- pattern already used on audit_observations / engagements / events.
alter table public.gpu_listings       enable row level security;
alter table public.price_history      enable row level security;
alter table public.providers          enable row level security;
alter table public.energy_prices      enable row level security;
alter table public.latency_benchmarks enable row level security;
alter table public.audit_requests     enable row level security;
alter table public.audit_leads        enable row level security;
alter table public.market_snapshots   enable row level security;
