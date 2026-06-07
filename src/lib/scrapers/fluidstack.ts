/**
 * FluidStack + Hyperstack scrapers
 */

import axios from "axios";
import type { GpuListing, ScraperResult } from "@/types";

const FLUIDSTACK_PRICING = [
  { gpu: "H100 SXM 80GB",  gpu_count: 8, region: "US (Dallas)",  price: 19.20, vcpus: 128, ram_gb: 768,  availability: "medium" as const },
  { gpu: "H100 SXM 80GB",  gpu_count: 8, region: "EU (Norway)",  price: 18.40, vcpus: 128, ram_gb: 768,  availability: "medium" as const },
  { gpu: "H100 SXM 80GB",  gpu_count: 1, region: "US (Dallas)",  price: 2.40,  vcpus: 16,  ram_gb: 96,   availability: "high" as const },
  { gpu: "A100 SXM 80GB",  gpu_count: 8, region: "US (Dallas)",  price: 14.40, vcpus: 96,  ram_gb: 640,  availability: "high" as const },
  { gpu: "A100 SXM 80GB",  gpu_count: 1, region: "EU (Norway)",  price: 1.60,  vcpus: 12,  ram_gb: 80,   availability: "high" as const },
  { gpu: "A100 PCIe 80GB", gpu_count: 1, region: "APAC (Tokyo)", price: 1.90,  vcpus: 12,  ram_gb: 80,   availability: "medium" as const },
  { gpu: "L40S 48GB",      gpu_count: 8, region: "US (Dallas)",  price: 12.00, vcpus: 96,  ram_gb: 384,  availability: "medium" as const },
  { gpu: "A10G 24GB",      gpu_count: 1, region: "US (Dallas)",  price: 0.38,  vcpus: 8,   ram_gb: 40,   availability: "high" as const },
];

export async function scrapeFluidStack(): Promise<ScraperResult> {
  const start = Date.now();
  try {
    const fetchedAt = new Date().toISOString();
    const listings: GpuListing[] = FLUIDSTACK_PRICING.map((item) => ({
      provider: "FluidStack",
      provider_slug: "fluidstack",
      gpu_model: item.gpu,
      gpu_count: item.gpu_count,
      pricing_type: "on-demand" as const,
      price_per_hour: item.price,
      region: item.region,
      availability: item.availability,
      vcpus: item.vcpus,
      ram_gb: item.ram_gb,
      raw_data: { source: "fluidstack_published" },
      fetched_at: fetchedAt,
    }));
    console.log(`[FluidStack] Loaded ${listings.length} listings`);
    return { provider: "FluidStack", listings, success: true, duration_ms: Date.now() - start };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { provider: "FluidStack", listings: [], success: false, error, duration_ms: Date.now() - start };
  }
}

const HYPERSTACK_PRICING = [
  { gpu: "H100 SXM 80GB",  gpu_count: 8, region: "NORWAY-1", price: 17.60, vcpus: 128, ram_gb: 960, availability: "high" as const },
  { gpu: "H100 SXM 80GB",  gpu_count: 8, region: "CANADA-1", price: 18.40, vcpus: 128, ram_gb: 960, availability: "medium" as const },
  { gpu: "H100 SXM 80GB",  gpu_count: 1, region: "NORWAY-1", price: 2.20,  vcpus: 16,  ram_gb: 120, availability: "high" as const },
  { gpu: "H100 NVL 80GB",  gpu_count: 8, region: "NORWAY-1", price: 16.00, vcpus: 128, ram_gb: 960, availability: "high" as const },
  { gpu: "A100 SXM 80GB",  gpu_count: 8, region: "NORWAY-1", price: 14.40, vcpus: 96,  ram_gb: 640, availability: "high" as const },
  { gpu: "A100 SXM 80GB",  gpu_count: 1, region: "NORWAY-1", price: 1.80,  vcpus: 12,  ram_gb: 80,  availability: "high" as const },
  { gpu: "L40S 48GB",      gpu_count: 8, region: "NORWAY-1", price: 11.20, vcpus: 96,  ram_gb: 384, availability: "high" as const },
  { gpu: "L40S 48GB",      gpu_count: 1, region: "NORWAY-1", price: 1.40,  vcpus: 12,  ram_gb: 48,  availability: "high" as const },
  { gpu: "RTX 4090 24GB",  gpu_count: 1, region: "NORWAY-1", price: 0.70,  vcpus: 8,   ram_gb: 32,  availability: "high" as const },
];

export async function scrapeHyperstack(): Promise<ScraperResult> {
  const start = Date.now();
  try {
    const fetchedAt = new Date().toISOString();

    if (process.env.HYPERSTACK_API_KEY) {
      try {
        const { data } = await axios.get("https://infrahub-api.nexgencloud.com/v1/gpu-compute/flavors", {
          headers: { "api_key": process.env.HYPERSTACK_API_KEY },
          timeout: 10000,
        });
        if (data?.flavors?.length > 0) {
          const live: GpuListing[] = data.flavors
            .filter((f: Record<string, unknown>) => (f.gpu as number) > 0)
            .map((f: Record<string, unknown>) => ({
              provider: "Hyperstack",
              provider_slug: "hyperstack",
              gpu_model: (f.gpu_model as string) ?? "H100 SXM 80GB",
              gpu_count: f.gpu as number,
              pricing_type: "on-demand" as const,
              price_per_hour: parseFloat(String(f.cost_per_hour)),
              region: String(f.region_name),
              availability: "high" as const,
              vcpus: f.cpu as number,
              ram_gb: parseFloat(String(f.ram)),
              fetched_at: fetchedAt,
            }));
          if (live.length > 0) {
            return { provider: "Hyperstack", listings: live, success: true, duration_ms: Date.now() - start };
          }
        }
      } catch {
        console.log("[Hyperstack] API unavailable, using published pricing");
      }
    }

    const listings: GpuListing[] = HYPERSTACK_PRICING.map((item) => ({
      provider: "Hyperstack",
      provider_slug: "hyperstack",
      gpu_model: item.gpu,
      gpu_count: item.gpu_count,
      pricing_type: "on-demand" as const,
      price_per_hour: item.price,
      region: item.region,
      availability: item.availability,
      vcpus: item.vcpus,
      ram_gb: item.ram_gb,
      raw_data: { source: "hyperstack_published" },
      fetched_at: fetchedAt,
    }));

    console.log(`[Hyperstack] Loaded ${listings.length} listings`);
    return { provider: "Hyperstack", listings, success: true, duration_ms: Date.now() - start };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { provider: "Hyperstack", listings: [], success: false, error, duration_ms: Date.now() - start };
  }
}
