-- audit_requests: stores demand-form submissions from /cost-audit and /load-balancer
create table if not exists audit_requests (
  id              uuid primary key default gen_random_uuid(),
  email           text not null,
  monthly_spend   text not null,
  stack           text,
  workload        text not null,
  notes           text,
  source          text not null check (source in ('cost-audit', 'load-balancer')),
  created_at      timestamptz not null default now()
);

-- Index for time-based queries and email lookups
create index if not exists audit_requests_created_at_idx on audit_requests (created_at desc);
create index if not exists audit_requests_email_idx      on audit_requests (email);
create index if not exists audit_requests_source_idx     on audit_requests (source);
