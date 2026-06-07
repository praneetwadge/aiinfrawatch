// @ts-nocheck
// Paperspace (DigitalOcean) GPU scraper - public pricing
import type { GpuListing, ScraperResult } from "@/types";

const PAPERSPACE_INSTANCES = [
  { id: "H100x8",    gpu: "H100 SXM5 80GB", count: 8,  price: 25.44, region: "us-east-1" },
  { id: "A100-80Gx8",gpu: "A100 SXM 80GB",  count: 8,  price: 12.72, region: "us-east-1" },
  { id: "A100-80Gx4",gpu: "A100 SXM 80GB",  count: 4,  price: 6.36,  region: "us-east-1" },
  { id: "A100-80Gx2",gpu: "A100 SXM 80GB",  count: 2,  price: 3.18,  region: "us-east-1" },
  { id: "A100-80Gx1",gpu: "A100 SXM 80GB",  count: 1,  price: 1.59,  region: "us-east-1" },
  { id: "A4000x8",   gpu: "RTX A4000 16GB", count: 8,  price: 3.20,  region: "us-east-1" },
  { id: "A4000x4",   gpu: "RTX A4000 16GB", count: 4,  price: 1.60,  region: "us-east-1" },
  { id: "A4000x2",   gpu: "RTX A4000 16GB", count: 2,  price: 0.80,  region: "us-east-1" },
  { id: "A4000x1",   gpu: "RTX A4000 16GB", count: 1,  price: 0.40,  region: "us-east-1" },
  { id: "RTX4000x8", gpu: "RTX 4000 Ada",   count: 8,  price: 2.80,  region: "us-east-1" },
  { id: "RTX4000x4", gpu: "RTX 4000 Ada",   count: 4,  price: 1.40,  region: "us-east-1" },
  { id: "RTX4000x1", gpu: "RTX 4000 Ada",   count: 1,  price: 0.35,  region: "us-east-1" },
];

export async function scrapePaperspace(): Promise<ScraperResult> {
  const start = Date.now();
  try {
    const fetchedAt = new Date().toISOString();
    const listings: GpuListing[] = PAPERSPACE_INSTANCES.map(inst => ({
      provider: "Paperspace",
      provider_slug: "paperspace",
      gpu_model: inst.gpu,
      gpu_count: inst.count,
      pricing_type: "on-demand",
      price_per_hour: inst.price,
      region: inst.region,
      availability: "high",
      raw_data: { instance_id: inst.id },
      fetched_at: fetchedAt,
    }));

    return { provider: "paperspace", listings, success: true, duration_ms: Date.now() - start };
  } catch (err) {
    return { provider: "paperspace", listings: [], success: false, error: err.message, duration_ms: Date.now() - start };
  }
}
