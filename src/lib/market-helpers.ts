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

export const PROVIDER_META: Record<string, { cat: string; color: string; status: string; short: string }> = {
  runpod:         { cat: "Marketplace",  color: "var(--violet)", status: "live",    short: "RunPod" },
  vastai:         { cat: "Marketplace",  color: "var(--violet)", status: "partial", short: "Vast.ai" },
  "vast.ai":      { cat: "Marketplace",  color: "var(--violet)", status: "partial", short: "Vast.ai" },
  aws:            { cat: "Hyperscaler",  color: "var(--amber)",  status: "live",    short: "AWS" },
  azure:          { cat: "Hyperscaler",  color: "var(--amber)",  status: "live",    short: "Azure" },
  gcp:            { cat: "Hyperscaler",  color: "var(--amber)",  status: "live",    short: "GCP" },
  "google cloud": { cat: "Hyperscaler",  color: "var(--amber)",  status: "live",    short: "GCP" },
  coreweave:      { cat: "Neocloud",     color: "var(--blue)",   status: "live",    short: "CoreWeave" },
  lambda:         { cat: "Neocloud",     color: "var(--blue)",   status: "live",    short: "Lambda" },
  "lambda labs":  { cat: "Neocloud",     color: "var(--blue)",   status: "live",    short: "Lambda" },
  nebius:         { cat: "Neocloud",     color: "var(--blue)",   status: "live",    short: "Nebius" },
  tensordock:     { cat: "Marketplace",  color: "var(--violet)", status: "live",    short: "TensorDock" },
  oci:            { cat: "Hyperscaler",  color: "var(--amber)",  status: "live",    short: "Oracle" },
  "oracle cloud": { cat: "Hyperscaler",  color: "var(--amber)",  status: "live",    short: "Oracle" },
  paperspace:     { cat: "Neocloud",     color: "var(--blue)",   status: "live",    short: "Paperspace" },
  crusoe:         { cat: "Neocloud",     color: "var(--blue)",   status: "live",    short: "Crusoe" },
  "crusoe energy":{ cat: "Neocloud",     color: "var(--blue)",   status: "live",    short: "Crusoe" },
  fluidstack:     { cat: "Marketplace",  color: "var(--violet)", status: "live",    short: "FluidStack" },
  ibm:            { cat: "Hyperscaler",  color: "var(--amber)",  status: "live",    short: "IBM" },
  "ibm cloud":    { cat: "Hyperscaler",  color: "var(--amber)",  status: "live",    short: "IBM" },
  gmi:            { cat: "Neocloud",     color: "var(--blue)",   status: "live",    short: "GMI" },
  "gmi cloud":    { cat: "Neocloud",     color: "var(--blue)",   status: "live",    short: "GMI" },
  voltagepark:    { cat: "Neocloud",     color: "var(--blue)",   status: "live",    short: "VoltagePark" },
  "voltage park": { cat: "Neocloud",     color: "var(--blue)",   status: "live",    short: "VoltagePark" },
};

export const HYPERSCALERS = ["aws", "azure", "gcp", "oci", "ibm", "ibm cloud", "google cloud", "oracle cloud"];

export const getMeta = (p: string) =>
  PROVIDER_META[p.toLowerCase()] ?? { cat: "Unknown", color: "var(--text-muted)", status: "unknown", short: p };

export const fmtP = (n: number) =>
  n < 1 ? `$${n.toFixed(2)}` : n < 10 ? `$${n.toFixed(2)}` : `$${Math.round(n)}`;

export const fmtMoney = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`;

// Data refreshes once daily via 00:00 UTC cron — always report as "Updated daily".
// Relative timestamps ("just now", "5m ago") are misleading on a daily-refresh schedule.
export const minsAgo = (_iso?: string): string => "Updated daily";
