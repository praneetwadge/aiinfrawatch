-- Two CTAs replacing the old three (Start My Move / Move It Yourself / Notify Me):
-- 'self_serve_referral' = email captured, then redirected to the referral-tagged
--   provider link (was previously an ungated outbound click with no capture).
-- 'report_request' = interest capture for the $99 migration report, stubbed
--   until the report-generation agent is built.
--
-- NOTE: already applied live via Supabase MCP on 2026-09-13. Re-running is a
-- safe no-op (DROP ... IF EXISTS).
ALTER TABLE engagements DROP CONSTRAINT IF EXISTS engagements_kind_check;
ALTER TABLE engagements ADD CONSTRAINT engagements_kind_check
  CHECK (kind = ANY (ARRAY['savings_share'::text, 'monitor'::text, 'self_serve_referral'::text, 'report_request'::text]));
