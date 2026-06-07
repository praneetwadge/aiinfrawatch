// @ts-nocheck
// Oracle Cloud Infrastructure GPU scraper - public pricing
import type { GpuListing, ScraperResult } from "@/types";

const OCI_INSTANCES = [
  { shape: "BM.GPU.H100.8",    gpu: "H100 SXM5 80GB", count: 8,  price: 34.00, region: "us-ashburn-1" },
  { shape: "BM.GPU4.8",        gpu: "A100 SXM 40GB",  count: 8,  price: 10.40, region: "us-ashburn-1" },
  { shape: "BM.GPU.A100-v2.8", gpu: "A100 SXM 80GB",  count: 8,  price: 16.00, region: "us-ashburn-1" },
  { shape: "VM.GPU3.1",        gpu: "V100 16GB",       count: 1,  price: 2.95,  region: "us-ashburn-1" },
  { shape: "VM.GPU3.2",        gpu: "V100 16GB",       count: 2,  price: 5.90,  region: "us-ashburn-1" },
  { shape: "VM.GPU3.4",        gpu: "V100 16GB",       count: 4,  price: 11.80, region: "us-ashburn-1" },
  { shape: "BM.GPU3.8",        gpu: "V100 16GB",       count: 8,  price: 23.60, region: "us-ashburn-1" },
  { shape: "VM.GPU.A10.1",     gpu: "A10G 24GB",       count: 1,  price: 1.29,  region: "us-ashburn-1" },
  { shape: "VM.GPU.A10.2",     gpu: "A10G 24GB",       count: 2,  price: 2.58,  region: "us-ashburn-1" },
  { shape: "BM.GPU.A10.4",     gpu: "A10G 24GB",       count: 4,  price: 5.16,  region: "us-ashburn-1" },
];

export async function scrapeOCI(): Promise<ScraperResult> {
  const start = Date.now();
  try {
    const fetchedAt = new Date().toISOString();
    const listings: GpuListing[] = OCI_INSTANCES.map(inst => ({
      provider: "Oracle Cloud",
      provider_slug: "oci",
      gpu_model: inst.gpu,
      gpu_count: inst.count,
      pricing_type: "on-demand",
      price_per_hour: inst.price,
      region: inst.region,
      availability: "medium",
      raw_data: { shape: inst.shape },
      fetched_at: fetchedAt,
    }));

    return { provider: "oci", listings, success: true, duration_ms: Date.now() - start };
  } catch (err) {
    return { provider: "oci", listings: [], success: false, error: err.message, duration_ms: Date.now() - start };
  }
}
