/**
 * GMI Cloud scraper
 * NVIDIA Reference Cloud Platform Partner — fast growing in 2026
 * Notable: H100 from $2.10/GPU-hr, H200, and Blackwell B200 access
 * API: https://gmicloud.ai (requires key)
 * Public pricing: gmicloud.ai/pricing
 */

import axios from "axios";
import type { GpuListing, ScraperResult } from "@/types";

const GMI_API = "https://gmicloud.ai/api/v1";

// GMI Cloud published pricing — April 2026
// Source: gmicloud.ai/en/blog/top-10-providers-for-ai-in-2026
const GMI_PRICING: Array<{
  gpu: string;
  gpu_count: number;
  pricing_type: "spot" | "on-demand" | "reserved-1yr";
  price_per_hour: number;
  region: string;
  vcpus: number;
  ram_gb: number;
  network_gbps: number;
  interconnect?: string;
  availability: "high" | "medium" | "low";
}> = [
  // H100 SXM — GMI's flagship
  { gpu: "H100 SXM 80GB",  gpu_count: 8,  pricing_type: "on-demand",   price_per_hour: 16.80, region: "us-west",   vcpus: 128, ram_gb: 768, network_gbps: 400, interconnect: "InfiniBand", availability: "high" },
  { gpu: "H100 SXM 80GB",  gpu_count: 8,  pricing_type: "spot",        price_per_hour: 11.20, region: "us-west",   vcpus: 128, ram_gb: 768, network_gbps: 400, interconnect: "InfiniBand", availability: "medium" },
  { gpu: "H100 SXM 80GB",  gpu_count: 8,  pricing_type: "reserved-1yr",price_per_hour: 12.00, region: "us-west",   vcpus: 128, ram_gb: 768, network_gbps: 400, interconnect: "InfiniBand", availability: "high" },
  { gpu: "H100 SXM 80GB",  gpu_count: 1,  pricing_type: "on-demand",   price_per_hour: 2.10,  region: "us-west",   vcpus: 16,  ram_gb: 96,  network_gbps: 50,  availability: "high" },
  { gpu: "H100 SXM 80GB",  gpu_count: 1,  pricing_type: "spot",        price_per_hour: 1.49,  region: "us-west",   vcpus: 16,  ram_gb: 96,  network_gbps: 50,  availability: "medium" },
  // H200 SXM — newer gen, growing availability
  { gpu: "H200 SXM 141GB", gpu_count: 8,  pricing_type: "on-demand",   price_per_hour: 22.40, region: "us-west",   vcpus: 128, ram_gb: 1024,network_gbps: 800, interconnect: "InfiniBand", availability: "medium" },
  { gpu: "H200 SXM 141GB", gpu_count: 1,  pricing_type: "on-demand",   price_per_hour: 3.35,  region: "us-west",   vcpus: 16,  ram_gb: 128, network_gbps: 100, availability: "medium" },
  // A100 SXM
  { gpu: "A100 SXM 80GB",  gpu_count: 8,  pricing_type: "on-demand",   price_per_hour: 12.00, region: "us-west",   vcpus: 96,  ram_gb: 640, network_gbps: 200, interconnect: "InfiniBand", availability: "high" },
  { gpu: "A100 SXM 80GB",  gpu_count: 1,  pricing_type: "on-demand",   price_per_hour: 1.50,  region: "us-west",   vcpus: 12,  ram_gb: 80,  network_gbps: 25,  availability: "high" },
  { gpu: "A100 SXM 80GB",  gpu_count: 1,  pricing_type: "spot",        price_per_hour: 0.90,  region: "us-west",   vcpus: 12,  ram_gb: 80,  network_gbps: 25,  availability: "medium" },
  // B200 (Blackwell — growing capacity)
  { gpu: "B200 SXM 192GB", gpu_count: 8,  pricing_type: "on-demand",   price_per_hour: 48.00, region: "us-west",   vcpus: 256, ram_gb: 2048,network_gbps: 1600,interconnect: "NVLink+IB",  availability: "low" },
  { gpu: "B200 SXM 192GB", gpu_count: 1,  pricing_type: "on-demand",   price_per_hour: 6.00,  region: "us-west",   vcpus: 32,  ram_gb: 256, network_gbps: 200, availability: "low" },
];

export async function scrapeGMI(): Promise<ScraperResult> {
  const start = Date.now();
  try {
    const fetchedAt = new Date().toISOString();
    let listings: GpuListing[] = [];

    // Attempt live API
    if (process.env.GMI_API_KEY) {
      try {
        const { data } = await axios.get(`${GMI_API}/instances/catalog`, {
          headers: { Authorization: `Bearer ${process.env.GMI_API_KEY}` },
          timeout: 10000,
        });
        if (data?.instances?.length > 0) {
          console.log(`[GMI] Got ${data.instances.length} live instances`);
          // Map live data to listings
          listings = data.instances.map((inst: Record<string, unknown>) => ({
            provider: "GMI Cloud",
            provider_slug: "gmi",
            gpu_model: inst.gpu_model as string,
            gpu_count: inst.gpu_count as number,
            pricing_type: inst.pricing_type as "spot" | "on-demand",
            price_per_hour: parseFloat(String(inst.price_per_hour)),
            region: inst.region as string,
            availability: inst.available ? "high" : "low",
            fetched_at: fetchedAt,
          }));
          return { provider: "GMI Cloud", listings, success: true, duration_ms: Date.now() - start };
        }
      } catch {
        console.log("[GMI] API request failed, using published pricing");
      }
    }

    // Use published pricing
    listings = GMI_PRICING.map((item) => ({
      provider: "GMI Cloud",
      provider_slug: "gmi",
      gpu_model: item.gpu,
      gpu_count: item.gpu_count,
      pricing_type: item.pricing_type,
      price_per_hour: item.price_per_hour,
      region: item.region,
      availability: item.availability,
      vcpus: item.vcpus,
      ram_gb: item.ram_gb,
      network_gbps: item.network_gbps,
      interconnect: item.interconnect,
      raw_data: { source: "gmi_published_pricing" },
      fetched_at: fetchedAt,
    }));

    console.log(`[GMI Cloud] Loaded ${listings.length} listings`);
    return { provider: "GMI Cloud", listings, success: true, duration_ms: Date.now() - start };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[GMI Cloud] Error: ${error}`);
    return { provider: "GMI Cloud", listings: [], success: false, error, duration_ms: Date.now() - start };
  }
}
