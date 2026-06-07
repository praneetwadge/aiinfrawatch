// @ts-nocheck
// Crusoe Energy GPU scraper - public pricing
import type { GpuListing, ScraperResult } from "@/types";

const CRUSOE_INSTANCES = [
  { id: "h100-80gb-sxm-ib-8x",  gpu: "H100 SXM5 80GB", count: 8,  price: 27.84, region: "us-northcentral-1" },
  { id: "h100-80gb-sxm-ib-4x",  gpu: "H100 SXM5 80GB", count: 4,  price: 13.92, region: "us-northcentral-1" },
  { id: "h100-80gb-sxm-ib-1x",  gpu: "H100 SXM5 80GB", count: 1,  price: 3.48,  region: "us-northcentral-1" },
  { id: "a100-80gb-sxm-ib-8x",  gpu: "A100 SXM 80GB",  count: 8,  price: 13.52, region: "us-northcentral-1" },
  { id: "a100-80gb-sxm-ib-4x",  gpu: "A100 SXM 80GB",  count: 4,  price: 6.76,  region: "us-northcentral-1" },
  { id: "a100-80gb-sxm-ib-1x",  gpu: "A100 SXM 80GB",  count: 1,  price: 1.69,  region: "us-northcentral-1" },
  { id: "l40s-48gb-1x",          gpu: "L40S 48GB",       count: 1,  price: 1.08,  region: "us-northcentral-1" },
  { id: "l40s-48gb-8x",          gpu: "L40S 48GB",       count: 8,  price: 8.64,  region: "us-northcentral-1" },
];

export async function scrapeCrusoe(): Promise<ScraperResult> {
  const start = Date.now();
  try {
    const fetchedAt = new Date().toISOString();
    const listings: GpuListing[] = CRUSOE_INSTANCES.map(inst => ({
      provider: "Crusoe Energy",
      provider_slug: "crusoe",
      gpu_model: inst.gpu,
      gpu_count: inst.count,
      pricing_type: "on-demand",
      price_per_hour: inst.price,
      region: inst.region,
      availability: "high",
      raw_data: { instance_id: inst.id },
      fetched_at: fetchedAt,
    }));

    return { provider: "crusoe", listings, success: true, duration_ms: Date.now() - start };
  } catch (err) {
    return { provider: "crusoe", listings: [], success: false, error: err.message, duration_ms: Date.now() - start };
  }
}
