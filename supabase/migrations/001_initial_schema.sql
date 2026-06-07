-- ─── Enable extensions ───────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_cron";  -- for scheduled jobs inside Supabase

-- ─── Providers ───────────────────────────────────────────────────────────────
create table if not exists providers (
  slug          text primary key,
  name          text not null,
  type          text not null check (type in ('hyperscaler','cloud-native','marketplace','bare-metal')),
  website       text not null,
  api_available boolean default false,
  logo_url      text,
  description   text,
  created_at    timestamptz default now()
);

-- ─── GPU Listings ─────────────────────────────────────────────────────────────
create table if not exists gpu_listings (
  id                uuid primary key default uuid_generate_v4(),
  provider          text not null references providers(slug),
  gpu_model         text not null,
  gpu_count         integer not null default 1,
  pricing_type      text not null check (pricing_type in ('spot','on-demand','reserved-1yr','reserved-3yr')),
  price_per_hour    numeric(10,4) not null,
  region            text not null,
  availability      text not null check (availability in ('high','medium','low','unavailable')),
  vcpus             integer,
  ram_gb            numeric(8,1),
  storage_gb        numeric(10,1),
  network_gbps      numeric(8,1),
  interconnect      text,
  raw_data          jsonb,
  fetched_at        timestamptz not null default now(),
  created_at        timestamptz default now()
);

-- index for common queries
create index if not exists idx_gpu_listings_model     on gpu_listings(gpu_model);
create index if not exists idx_gpu_listings_provider  on gpu_listings(provider);
create index if not exists idx_gpu_listings_fetched   on gpu_listings(fetched_at desc);
create index if not exists idx_gpu_listings_price     on gpu_listings(price_per_hour asc);

-- ─── Price History ────────────────────────────────────────────────────────────
create table if not exists price_history (
  id             uuid primary key default uuid_generate_v4(),
  provider       text not null,
  gpu_model      text not null,
  pricing_type   text not null,
  region         text not null,
  price_per_hour numeric(10,4) not null,
  recorded_at    timestamptz not null default now()
);

create index if not exists idx_price_history_model    on price_history(gpu_model, recorded_at desc);
create index if not exists idx_price_history_provider on price_history(provider, recorded_at desc);

-- ─── Energy Prices ────────────────────────────────────────────────────────────
create table if not exists energy_prices (
  id                        uuid primary key default uuid_generate_v4(),
  region                    text not null,
  grid_operator             text not null,
  price_per_kwh             numeric(8,5) not null,
  carbon_intensity_gco2_kwh numeric(8,2),
  renewable_pct             numeric(5,2),
  source                    text not null,
  fetched_at                timestamptz not null default now()
);

create index if not exists idx_energy_region   on energy_prices(region, fetched_at desc);

-- ─── Latency Benchmarks ───────────────────────────────────────────────────────
create table if not exists latency_benchmarks (
  id               uuid primary key default uuid_generate_v4(),
  provider         text not null,
  provider_slug    text not null,
  region           text not null,
  latency_p50_ms   numeric(8,2),
  latency_p99_ms   numeric(8,2),
  bandwidth_gbps   numeric(8,1),
  tested_from      text not null,
  tested_at        timestamptz not null default now()
);

-- ─── Market Snapshots (materialized every 5 min) ─────────────────────────────
create table if not exists market_snapshots (
  id                       uuid primary key default uuid_generate_v4(),
  h100_spot_avg            numeric(10,4),
  h100_spot_change_24h     numeric(8,4),
  a100_spot_avg            numeric(10,4),
  a100_spot_change_24h     numeric(8,4),
  cheapest_h100_provider   text,
  cheapest_h100_price      numeric(10,4),
  cheapest_a100_provider   text,
  cheapest_a100_price      numeric(10,4),
  active_providers         integer,
  total_listings           integer,
  energy_cheapest_region   text,
  energy_cheapest_price    numeric(8,5),
  latency_best_provider    text,
  latency_best_ms          numeric(8,2),
  snapshot_at              timestamptz not null default now()
);

-- ─── Seed providers ───────────────────────────────────────────────────────────
insert into providers (slug, name, type, website, api_available, description) values
  ('vastai',      'vast.ai',              'marketplace',   'https://vast.ai',             true,  'Peer-to-peer GPU marketplace with lowest spot prices'),
  ('runpod',      'RunPod',               'cloud-native',  'https://www.runpod.io',       true,  'GPU cloud focused on AI/ML workloads'),
  ('lambda',      'Lambda Labs',          'cloud-native',  'https://lambdalabs.com',      true,  'On-demand and reserved GPU cloud for deep learning'),
  ('coreweave',   'CoreWeave',            'cloud-native',  'https://coreweave.com',       true,  'Kubernetes-native GPU cloud with low latency'),
  ('aws',         'AWS',                  'hyperscaler',   'https://aws.amazon.com',      false, 'Amazon Web Services GPU instances (p4, p5, g5 families)'),
  ('gcp',         'GCP',                  'hyperscaler',   'https://cloud.google.com',    false, 'Google Cloud GPU instances (a2, a3 families)'),
  ('azure',       'Azure',                'hyperscaler',   'https://azure.microsoft.com', false, 'Microsoft Azure GPU VMs (NDv5, NCv4 H100/A100 families)'),
  ('oci',         'Oracle Cloud (OCI)',   'hyperscaler',   'https://oracle.com/cloud',    false, 'Oracle bare-metal GPU with RDMA networking, competitive H100 pricing'),
  ('ibm',         'IBM Cloud',            'hyperscaler',   'https://ibm.com/cloud',       false, 'IBM Cloud GPU instances with WatsonX AI integration'),
  ('nebius',      'Nebius',               'cloud-native',  'https://nebius.ai',           false, 'European GPU cloud with competitive H100 pricing and EU data residency'),
  ('gmi',         'GMI Cloud',            'cloud-native',  'https://gmicloud.ai',         true,  'NVIDIA Reference Cloud partner, H100/H200/B200 from $2.10/hr'),
  ('tensordock',  'TensorDock',           'marketplace',   'https://tensordock.com',      true,  'Distributed GPU marketplace, budget-friendly'),
  ('fluidstack',  'FluidStack',           'cloud-native',  'https://fluidstack.io',       false, 'Global GPU cloud with carbon-aware routing'),
  ('hyperstack',  'Hyperstack',           'cloud-native',  'https://hyperstack.cloud',    true,  'NVIDIA-backed GPU cloud, strong H100 availability in Norway'),
  ('voltagepark', 'Voltage Park',         'cloud-native',  'https://voltagepark.com',     true,  'Nonprofit-backed bare-metal GPU cloud, 36k+ H100/Blackwell GPUs, $1.99/hr'),
  ('crusoe',      'Crusoe',               'cloud-native',  'https://crusoe.ai',           true,  'Stranded-gas + renewable energy AI cloud, $3.4B valuation, carbon-efficient compute')
on conflict (slug) do nothing;
