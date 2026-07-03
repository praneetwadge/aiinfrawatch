// REPO PATH: src/lib/db/funnel.ts  (NEW FILE — goes alongside existing src/lib/db/queries.ts and supabase.ts)
// @ts-nocheck
// Service-role writes to the three locked-down tables backing the funnel:
// audit_observations (transacted-price asset), engagements (leads/demand
// signal), events (funnel instrumentation). All three have RLS enabled with
// zero policies for anon/authenticated — only supabaseAdmin can touch them.
//
// Every function here is best-effort: a logging failure must never break the
// audit UX for the visitor. Errors are caught and logged server-side only.
import { supabaseAdmin } from "./supabase";

export interface AuditObservationInput {
  session_id?: string | null;
  input_mode: "describe" | "bill" | "manual";
  gpu_type: string;
  current_provider?: string | null;
  region?: string | null;
  pricing_type?: string | null;
  effective_rate_usd_hr?: number | null;
  gpu_count?: number | null;
  monthly_spend_usd?: number | null;
  workload_class?: string | null;
  reliable_floor_usd_hr: number;
  overpay_pct?: number | null;
  recommended_provider?: string | null;
  recommended_rate_usd_hr?: number | null;
}

export async function recordAuditObservation(obs: AuditObservationInput): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("audit_observations").insert({
      session_id: obs.session_id || null,
      input_mode: obs.input_mode,
      gpu_type: obs.gpu_type,
      current_provider: obs.current_provider || null,
      region: obs.region || null,
      pricing_type: obs.pricing_type || null,
      effective_rate_usd_hr: obs.effective_rate_usd_hr ?? null,
      gpu_count: obs.gpu_count ?? null,
      monthly_spend_usd: obs.monthly_spend_usd ?? null,
      workload_class: obs.workload_class || null,
      reliable_floor_usd_hr: obs.reliable_floor_usd_hr,
      overpay_pct: obs.overpay_pct ?? null,
      recommended_provider: obs.recommended_provider || null,
      recommended_rate_usd_hr: obs.recommended_rate_usd_hr ?? null,
    });
    if (error) console.error("[audit_observations] insert error:", error.message);
  } catch (err) {
    console.error("[audit_observations] insert exception:", err);
  }
}

export interface EngagementInput {
  session_id?: string | null;
  kind: "savings_share" | "monitor";
  email: string;
  current_provider?: string | null;
  gpu_type?: string | null;
  est_monthly_spend_usd?: number | null;
  est_annual_savings_usd?: number | null;
  target_provider?: string | null;
  consent: boolean;
}

export async function recordEngagement(eng: EngagementInput): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin.from("engagements").insert({
      session_id: eng.session_id || null,
      kind: eng.kind,
      email: eng.email,
      current_provider: eng.current_provider || null,
      gpu_type: eng.gpu_type || null,
      est_monthly_spend_usd: eng.est_monthly_spend_usd ?? null,
      est_annual_savings_usd: eng.est_annual_savings_usd ?? null,
      target_provider: eng.target_provider || null,
      consent: eng.consent,
    });
    if (error) {
      console.error("[engagements] insert error:", error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error("[engagements] insert exception:", err);
    return { success: false, error: err?.message ?? "Unknown error" };
  }
}

export type EventName =
  | "audit_run"
  | "overpay_shown"
  | "move_with_us_click"
  | "self_serve_click"
  | "monitor_click"
  | "share_click"
  | "engagement_captured";

export interface EventInput {
  session_id?: string | null;
  event_name: EventName;
  kind?: string | null;
  meta?: Record<string, unknown> | null;
}

export async function recordEvent(evt: EventInput): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("events").insert({
      session_id: evt.session_id || null,
      event_name: evt.event_name,
      kind: evt.kind || null,
      meta: evt.meta ?? null,
    });
    if (error) console.error("[events] insert error:", error.message);
  } catch (err) {
    console.error("[events] insert exception:", err);
  }
}
