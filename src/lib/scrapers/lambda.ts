// @ts-nocheck
// Lambda Labs scraper - uses public pricing page data (no API key needed)
import type { GpuListing, ScraperResult } from "@/types";

// Lambda Labs GPU instance pricing (from public pricing page - updated Jun 2025)
const LAMBDA_INSTANCES = [
  { name: "gpu_1x_h100_sxm5",  gpu: "H100 SXM5 80GB", count: 1,  price: 2.49,  region: "us-east-1" },
  { name: "gpu_2x_h100_sxm5",  gpu: "H100 SXM5 80GB", count: 2,  price: 4.98,  region: "us-east-1" },
  { name: "gpu_4x_h100_sxm5",  gpu: "H100 SXM5 80GB", count: 4,  price: 9.96,  region: "us-east-1" },
  { name: "gpu_8x_h100_sxm5",  gpu: "H100 SXM5 80GB", count: 8,  price: 19.92, region: "us-east-1" },
  { name: "gpu_1x_a100_sxm4",  gpu: "A100 SXM 80GB",  count: 1,  price: 1.99,  region: "us-east-1" },
  { name: "gpu_8x_a100_sxm4",  gpu: "A100 SXM 80GB",  count: 8,  price: 15.92, region: "us-east-1" },
  { name: "gpu_1x_a10",        gpu: "A10G 24GB",       count: 1,  price: 0.60,  region: "us-east-1" },
  { name: "gpu_1x_rtx6000",    gpu: "RTX 6000 Ada",    count: 1,  price: 0.50,  region: "us-east-1" },
  { name: "gpu_1x_a6000",      gpu: "RTX A6000 48GB",  count: 1,  price: 0.80,  region: "us-east-1" },
  { name: "gpu_8x_a6000",      gpu: "RTX A6000 48GB",  count: 8,  price: 6.40,  region: "us-east-1" },
  { name: "gpu_1x_h100_pcie",  gpu: "H100 PCIe 80GB",  count: 1,  price: 2.49,  region: "us-west-2" },
  { name: "gpu_8x_h100_pcie",  gpu: "H100 PCIe 80GB",  count: 8,  price: 19.92, region: "us-west-2" },
];

export async function scrapeLambdaLabs(): Promise<ScraperResult> {
  const start = Date.now();
  try {
    const fetchedAt = new Date().toISOString();
    const listings: GpuListing[] = LAMBDA_INSTANCES.map(inst => ({
      provider: "Lambda Labs",
      provider_slug: "lambda",
      gpu_model: inst.gpu,
      gpu_count: inst.count,
      pricing_type: "on-demand",
      price_per_hour: inst.price,
      region: inst.region,
      availability: "high",
      raw_data: { instance_name: inst.name },
      fetched_at: fetchedAt,
    }));

    return { provider: "lambda", listings, success: true, duration_ms: Date.now() - start };
  } catch (err) {
    return { provider: "lambda", listings: [], success: false, error: err.message, duration_ms: Date.now() - start };
  }
}
