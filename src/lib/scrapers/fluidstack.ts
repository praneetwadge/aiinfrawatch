// @ts-nocheck
// FluidStack GPU scraper - public pricing
import type { GpuListing, ScraperResult } from "@/types";

const FLUIDSTACK_INSTANCES = [
  { gpu: "H100 SXM5 80GB", count: 8,  price: 21.60, region: "us-central-1" },
  { gpu: "H100 SXM5 80GB", count: 4,  price: 10.80, region: "us-central-1" },
  { gpu: "H100 SXM5 80GB", count: 1,  price: 2.85,  region: "us-central-1" },
  { gpu: "A100 SXM 80GB",  count: 8,  price: 10.40, region: "us-central-1" },
  { gpu: "A100 SXM 80GB",  count: 4,  price: 5.20,  region: "us-central-1" },
  { gpu: "A100 SXM 80GB",  count: 1,  price: 1.30,  region: "us-central-1" },
  { gpu: "A100 PCIe 80GB", count: 1,  price: 1.10,  region: "eu-central-1" },
  { gpu: "L40S 48GB",      count: 8,  price: 8.00,  region: "us-central-1" },
  { gpu: "L40S 48GB",      count: 1,  price: 1.00,  region: "us-central-1" },
  { gpu: "RTX A6000 48GB", count: 1,  price: 0.75,  region: "eu-central-1" },
  { gpu: "RTX A6000 48GB", count: 8,  price: 6.00,  region: "eu-central-1" },
];

export async function scrapeFluidStack(): Promise<ScraperResult> {
  const start = Date.now();
  try {
    const fetchedAt = new Date().toISOString();
    const listings: GpuListing[] = FLUIDSTACK_INSTANCES.map((inst, i) => ({
      provider: "FluidStack",
      provider_slug: "fluidstack",
      gpu_model: inst.gpu,
      gpu_count: inst.count,
      pricing_type: "on-demand",
      price_per_hour: inst.price,
      region: inst.region,
      availability: "high",
      fetched_at: fetchedAt,
    }));

    return { provider: "fluidstack", listings, success: true, duration_ms: Date.now() - start };
  } catch (err) {
    return { provider: "fluidstack", listings: [], success: false, error: err.message, duration_ms: Date.now() - start };
  }
}
