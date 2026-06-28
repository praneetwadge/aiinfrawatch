// @ts-nocheck
// GCP scraper using public pricing JSON (no API key needed)
import axios from "axios";
import type { GpuListing, ScraperResult } from "@/types";

const INSTANCE_GPU_MAP = {
  "a3-highgpu-8g":   { gpu: "H100 SXM5 80GB", count: 8 },
  "a3-megagpu-8g":   { gpu: "H100 SXM5 80GB", count: 8 },
  "a2-highgpu-1g":   { gpu: "A100 SXM 40GB",  count: 1 },
  "a2-highgpu-2g":   { gpu: "A100 SXM 40GB",  count: 2 },
  "a2-highgpu-4g":   { gpu: "A100 SXM 40GB",  count: 4 },
  "a2-highgpu-8g":   { gpu: "A100 SXM 40GB",  count: 8 },
  "a2-megagpu-16g":  { gpu: "A100 SXM 40GB",  count: 16 },
  "a2-ultragpu-1g":  { gpu: "A100 SXM 80GB",  count: 1 },
  "a2-ultragpu-2g":  { gpu: "A100 SXM 80GB",  count: 2 },
  "a2-ultragpu-4g":  { gpu: "A100 SXM 80GB",  count: 4 },
  "a2-ultragpu-8g":  { gpu: "A100 SXM 80GB",  count: 8 },
  "g2-standard-4":   { gpu: "L4 24GB",         count: 1 },
  "g2-standard-8":   { gpu: "L4 24GB",         count: 1 },
  "g2-standard-12":  { gpu: "L4 24GB",         count: 1 },
  "g2-standard-16":  { gpu: "L4 24GB",         count: 1 },
  "g2-standard-24":  { gpu: "L4 24GB",         count: 2 },
  "g2-standard-32":  { gpu: "L4 24GB",         count: 1 },
  "g2-standard-48":  { gpu: "L4 24GB",         count: 4 },
  "g2-standard-96":  { gpu: "L4 24GB",         count: 8 },
};

// Hardcoded GCP GPU pricing (from public GCP pricing page - updated Jun 2025)
const GCP_PRICES = [
  { machine: "a3-highgpu-8g",  region: "us-central1",   on_demand: 32.77, spot: 9.83 },
  { machine: "a3-highgpu-8g",  region: "us-east4",      on_demand: 32.77, spot: 9.83 },
  { machine: "a3-highgpu-8g",  region: "europe-west4",  on_demand: 36.05, spot: 10.81 },
  { machine: "a2-highgpu-1g",  region: "us-central1",   on_demand: 3.67,  spot: 1.10 },
  { machine: "a2-highgpu-2g",  region: "us-central1",   on_demand: 7.35,  spot: 2.20 },
  { machine: "a2-highgpu-4g",  region: "us-central1",   on_demand: 14.69, spot: 4.41 },
  { machine: "a2-highgpu-8g",  region: "us-central1",   on_demand: 29.39, spot: 8.82 },
  { machine: "a2-ultragpu-1g", region: "us-central1",   on_demand: 5.08,  spot: 1.52 },
  { machine: "a2-ultragpu-2g", region: "us-central1",   on_demand: 10.16, spot: 3.05 },
  { machine: "a2-ultragpu-4g", region: "us-central1",   on_demand: 20.33, spot: 6.10 },
  { machine: "a2-ultragpu-8g", region: "us-central1",   on_demand: 40.65, spot: 12.20 },
  { machine: "g2-standard-4",  region: "us-central1",   on_demand: 0.70,  spot: 0.21 },
  { machine: "g2-standard-8",  region: "us-central1",   on_demand: 1.00,  spot: 0.30 },
  { machine: "g2-standard-16", region: "us-central1",   on_demand: 1.59,  spot: 0.48 },
  { machine: "g2-standard-48", region: "us-central1",   on_demand: 4.06,  spot: 1.22 },
  { machine: "g2-standard-96", region: "us-central1",   on_demand: 8.12,  spot: 2.44 },
];

// Live GCP pricing requires the Cloud Billing Catalog API + an API key and
// non-trivial SKU→GPU mapping. Until that's wired and verified, we serve the
// dated rate card below and TAG it as such so nothing is presented as live when
// it isn't. When GCP_BILLING_API_KEY is set, a live fetch is attempted first;
// on any failure we fall back to the rate card (never an empty/garbage write).
async function fetchGcpLive(fetchedAt: string): Promise<GpuListing[] | null> {
  if (!process.env.GCP_BILLING_API_KEY) return null;
  try {
    // Placeholder for the real Cloud Billing Catalog integration. Intentionally
    // returns null (not partial data) until the SKU parser is implemented and
    // verified against a real response — so we never ship unverified "live" data.
    // TODO(live-gcp): implement cloudbilling.googleapis.com/v1/services/.../skus
    return null;
  } catch {
    return null;
  }
}

export async function scrapeGCP(): Promise<ScraperResult> {
  const start = Date.now();
  try {
    const fetchedAt = new Date().toISOString();

    const live = await fetchGcpLive(fetchedAt);
    if (live && live.length > 0) {
      return { provider: "gcp", listings: live, success: true, duration_ms: Date.now() - start };
    }

    // Rate-card fallback — tagged with source + as-of date.
    const listings: GpuListing[] = [];
    for (const row of GCP_PRICES) {
      const gpuInfo = INSTANCE_GPU_MAP[row.machine];
      if (!gpuInfo) continue;

      for (const [pricingType, price] of [["on-demand", row.on_demand], ["spot", row.spot]]) {
        listings.push({
          provider: "Google Cloud",
          provider_slug: "gcp",
          gpu_model: gpuInfo.gpu,
          gpu_count: gpuInfo.count,
          pricing_type: pricingType,
          price_per_hour: price,
          region: row.region,
          availability: "high",
          raw_data: { machine_type: row.machine, source: "rate_card", rate_card_date: "2025-06" },
          fetched_at: fetchedAt,
        });
      }
    }

    return { provider: "gcp", listings, success: true, duration_ms: Date.now() - start };
  } catch (err) {
    return { provider: "gcp", listings: [], success: false, error: err.message, duration_ms: Date.now() - start };
  }
}
