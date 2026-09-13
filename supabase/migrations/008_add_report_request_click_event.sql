-- Adds the event fired when someone opens the (stubbed) paid-report CTA.
--
-- NOTE: already applied live via Supabase MCP on 2026-09-13. Re-running is a
-- safe no-op (DROP ... IF EXISTS).
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_event_name_check;
ALTER TABLE events ADD CONSTRAINT events_event_name_check
  CHECK (event_name = ANY (ARRAY['audit_run'::text, 'overpay_shown'::text, 'move_with_us_click'::text, 'self_serve_click'::text, 'monitor_click'::text, 'share_click'::text, 'engagement_captured'::text, 'report_request_click'::text]));
