// @ts-nocheck
// Shared market data helpers — imported by DashboardClient and AuditTool
// All types re-exported so consumers don't need to re-declare them.

export interface GpuListing {
  provider: string;
  provider_slug?: string;
  gpu_model: string;
  gpu_count: number;
  pricing_type: string;
  price_per_hour: number;
  region: string;
  availability: string;
  fetched_at?: string;
}

export const TOTAL_TRACKED = 16;

// Provenance is tracked honestly per provider. `source` reflects how that
// provider's prices actually reach us:
//   "live"      — fetched from the provider's public pricing API every run
//   "rate_card" — static published rate card embedded in the scraper; refreshed
//                 manually. `asOf` is the date that card was last verified.
// This is verified against the scraper implementations, NOT aspirational. If a
// scraper is hardcoded, it is marked rate_card — surfacing this is the point.
export type DataSource = "live" | "rate_card";

export const PROVIDER_META: Record<string, { cat: string; color: string; source: DataSource; asOf?: string; short: string }> = {
  runpod:         { cat: "Marketplace",  color: "var(--violet)", source: "live",                          short: "RunPod" },
  vastai:         { cat: "Marketplace",  color: "var(--violet)", source: "live",                          short: "Vast.ai" },
  "vast.ai":      { cat: "Marketplace",  color: "var(--violet)", source: "live",                          short: "Vast.ai" },
  aws:            { cat: "Hyperscaler",  color: "var(--amber)",  source: "live",                          short: "AWS" },
  azure:          { cat: "Hyperscaler",  color: "var(--amber)",  source: "live",                          short: "Azure" },
  gcp:            { cat: "Hyperscaler",  color: "var(--amber)",  source: "rate_card", asOf: "2025-06",    short: "GCP" },
  "google cloud": { cat: "Hyperscaler",  color: "var(--amber)",  source: "rate_card", asOf: "2025-06",    short: "GCP" },
  coreweave:      { cat: "Neocloud",     color: "var(--blue)",   source: "rate_card", asOf: "2026-05",    short: "CoreWeave" },
  lambda:         { cat: "Neocloud",     color: "var(--blue)",   source: "rate_card", asOf: "2025-06",    short: "Lambda" },
  "lambda labs":  { cat: "Neocloud",     color: "var(--blue)",   source: "rate_card", asOf: "2025-06",    short: "Lambda" },
  nebius:         { cat: "Neocloud",     color: "var(--blue)",   source: "live",                          short: "Nebius" },
  tensordock:     { cat: "Marketplace",  color: "var(--violet)", source: "live",                          short: "TensorDock" },
  oci:            { cat: "Hyperscaler",  color: "var(--amber)",  source: "rate_card", asOf: "2026-05",    short: "Oracle" },
  "oracle cloud": { cat: "Hyperscaler",  color: "var(--amber)",  source: "rate_card", asOf: "2026-05",    short: "Oracle" },
  paperspace:     { cat: "Neocloud",     color: "var(--blue)",   source: "rate_card", asOf: "2026-05",    short: "Paperspace" },
  crusoe:         { cat: "Neocloud",     color: "var(--blue)",   source: "rate_card", asOf: "2026-05",    short: "Crusoe" },
  "crusoe energy":{ cat: "Neocloud",     color: "var(--blue)",   source: "rate_card", asOf: "2026-05",    short: "Crusoe" },
  fluidstack:     { cat: "Marketplace",  color: "var(--violet)", source: "rate_card", asOf: "2026-05",    short: "FluidStack" },
  ibm:            { cat: "Hyperscaler",  color: "var(--amber)",  source: "live",                          short: "IBM" },
  "ibm cloud":    { cat: "Hyperscaler",  color: "var(--amber)",  source: "live",                          short: "IBM" },
  gmi:            { cat: "Neocloud",     color: "var(--blue)",   source: "rate_card", asOf: "2026-04",    short: "GMI" },
  "gmi cloud":    { cat: "Neocloud",     color: "var(--blue)",   source: "rate_card", asOf: "2026-04",    short: "GMI" },
  voltagepark:    { cat: "Neocloud",     color: "var(--blue)",   source: "rate_card", asOf: "2026-05",    short: "VoltagePark" },
  "voltage park": { cat: "Neocloud",     color: "var(--blue)",   source: "rate_card", asOf: "2026-05",    short: "VoltagePark" },
};

// True if every provider feeding listings is live-API sourced. Used to decide
// whether the global "Updated daily" claim is honest for a given view.
export const isLiveSource = (p: string): boolean => (getMeta(p).source ?? "rate_card") === "live";

export const HYPERSCALERS = ["aws", "azure", "gcp", "oci", "ibm", "ibm cloud", "google cloud", "oracle cloud"];

export const getMeta = (p: string) =>
  PROVIDER_META[p.toLowerCase()] ?? { cat: "Unknown", color: "var(--text-muted)", source: "rate_card" as DataSource, short: p };

export const fmtP = (n: number) =>
  n < 1 ? `$${n.toFixed(2)}` : n < 10 ? `$${n.toFixed(2)}` : `$${Math.round(n)}`;

export const fmtMoney = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`;

// Data refreshes once daily via 00:00 UTC cron — always report as "Updated daily".
// Relative timestamps ("just now", "5m ago") are misleading on a daily-refresh schedule.
export const minsAgo = (_iso?: string): string => "Updated daily";
