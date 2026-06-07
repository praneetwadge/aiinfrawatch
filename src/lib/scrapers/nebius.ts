// @ts-nocheck
/**
 * Nebius AI Cloud scraper
 * Nebius is a spin-off from Yandex Cloud, EU-based, strong H100 cluster offering
 * API: https://console.nebius.ai/ (requires key for full access)
 * Public pricing: https://nebius.com/prices
 *
 * Notable: competitive H100 pricing, EU data residency, fast interconnect
 */

import axios from "axios";
import type { GpuListing, ScraperResult } from "@/types";

// Nebius published pricing — April 2026
// Source: nebius.com/prices
const NEBIUS_PRICING: Array<{
  gpu: string;
  gpu_count: number;
  platform: string;
  region: string;
  on_demand_usd: number;
  vcpus: number;
  ram_gb: number;
  network_gbps: number;
  interconnect?: string;
}> = [
  // H100 SXM clusters
  { gpu: "H100 SXM 80GB",  gpu_count: 8,  platform: "gpu-h100-sxm",     region: "eu-north1",    on_demand_usd: 21.60, vcpus: 160, ram_gb: 1280, network_gbps: 400,  interconnect: "InfiniBand" },
  { gpu: "H100 SXM 80GB",  gpu_count: 8,  platform: "gpu-h100-sxm",     region: "eu-west1",     on_demand_usd: 22.80, vcpus: 160, ram_gb: 1280, network_gbps: 400,  interconnect: "InfiniBand" },
  { gpu: "H100 SXM 80GB",  gpu_count: 1,  platform: "gpu-h100-sxm",     region: "eu-north1",    on_demand_usd: 2.70,  vcpus: 20,  ram_gb: 160,  network_gbps: 50 },
  // H100 NVL
  { gpu: "H100 NVL 80GB",  gpu_count: 8,  platform: "gpu-h100-nvl",     region: "eu-north1",    on_demand_usd: 19.20, vcpus: 160, ram_gb: 1280, network_gbps: 200 },
  { gpu: "H100 NVL 80GB",  gpu_count: 1,  platform: "gpu-h100-nvl",     region: "eu-north1",    on_demand_usd: 2.40,  vcpus: 20,  ram_gb: 160,  network_gbps: 25 },
  // A100 SXM
  { gpu: "A100 SXM 80GB",  gpu_count: 8,  platform: "gpu-a100",         region: "eu-north1",    on_demand_usd: 16.00, vcpus: 128, ram_gb: 768,  network_gbps: 200,  interconnect: "InfiniBand" },
  { gpu: "A100 SXM 80GB",  gpu_count: 8,  platform: "gpu-a100",         region: "eu-west1",     on_demand_usd: 17.20, vcpus: 128, ram_gb: 768,  network_gbps: 200,  interconnect: "InfiniBand" },
  { gpu: "A100 SXM 80GB",  gpu_count: 1,  platform: "gpu-a100",         region: "eu-north1",    on_demand_usd: 2.00,  vcpus: 16,  ram_gb: 96,   network_gbps: 25 },
  // L40S
  { gpu: "L40S 48GB",      gpu_count: 8,  platform: "gpu-l40s",         region: "eu-north1",    on_demand_usd: 13.60, vcpus: 128, ram_gb: 512,  network_gbps: 100 },
  { gpu: "L40S 48GB",      gpu_count: 1,  platform: "gpu-l40s",         region: "eu-north1",    on_demand_usd: 1.70,  vcpus: 16,  ram_gb: 64,   network_gbps: 12 },
  // H200 (newer)
  { gpu: "H200 SXM 141GB", gpu_count: 8,  platform: "gpu-h200-sxm",     region: "eu-north1",    on_demand_usd: 24.00, vcpus: 160, ram_gb: 1600, network_gbps: 800,  interconnect: "InfiniBand" },
];

export async function scrapeNebius(): Promise<ScraperResult> {
  const start = Date.now();
  try {
    const fetchedAt = new Date().toISOString();

    // Attempt live API if key provided
    if (process.env.NEBIUS_API_KEY) {
      try {
        const { data } = await axios.get(
          "https://billing.api.nebius.ai/v1/skus?filter=gpu",
          {
            headers: { Authorization: `Bearer ${process.env.NEBIUS_API_KEY}` },
            timeout: 10000,
          }
        );
        // Parse live data if available — structure varies by API version
        if (data?.skus?.length > 0) {
          console.log(`[Nebius] Got ${data.skus.length} live SKUs from API`);
          // TODO: parse Nebius API response format when key available
        }
      } catch {
        console.log("[Nebius] API key present but request failed, using published pricing");
      }
    }

    const listings: GpuListing[] = NEBIUS_PRICING.map((item) => ({
      provider: "Nebius",
      provider_slug: "nebius",
      gpu_model: item.gpu,
      gpu_count: item.gpu_count,
      pricing_type: "on-demand" as const,
      price_per_hour: item.on_demand_usd,
      region: item.region,
      availability: item.region === "eu-north1" ? "medium" : "low" as const,
      vcpus: item.vcpus,
      ram_gb: item.ram_gb,
      network_gbps: item.network_gbps,
      interconnect: item.interconnect,
      raw_data: { platform: item.platform, source: "nebius_published_pricing" },
      fetched_at: fetchedAt,
    }));

    console.log(`[Nebius] Loaded ${listings.length} GPU listings`);
    return { provider: "Nebius", listings, success: true, duration_ms: Date.now() - start };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[Nebius] Error: ${error}`);
    return { provider: "Nebius", listings: [], success: false, error, duration_ms: Date.now() - start };
  }
}
