/**
 * vast.ai scraper
 * Docs: https://vast.ai/docs/api
 * Endpoint: GET https://console.vast.ai/api/v0/bundles/
 * No auth required for public listings; API key unlocks more detail
 */

import axios from "axios";
import type { GpuListing, ScraperResult } from "@/types";

const GPU_NAME_MAP: Record<string, string> = {
  "RTX_4090":     "RTX 4090 24GB",
  "RTX_3090":     "RTX 3090 24GB",
  "A100_SXM4":    "A100 SXM 80GB",
  "A100_PCIE":    "A100 PCIe 80GB",
  "H100_SXM5":    "H100 SXM5 80GB",
  "H100_SXM":     "H100 SXM 80GB",
  "H100_PCIE":    "H100 PCIe 80GB",
  "H100_NVL":     "H100 NVL 80GB",
  "L40S":         "L40S 48GB",
  "L40":          "L40 48GB",
  "A10G":         "A10G 24GB",
  "A10":          "A10G 24GB",
};

function normalizeGpuName(name: string): string {
  const upper = name.toUpperCase().replace(/\s+/g, "_");
  for (const [key, val] of Object.entries(GPU_NAME_MAP)) {
    if (upper.includes(key)) return val;
  }
  return name;
}

function getAvailability(numGpus: number): GpuListing["availability"] {
  if (numGpus >= 8) return "high";
  if (numGpus >= 2) return "medium";
  return "low";
}

export async function scrapeVastAi(): Promise<ScraperResult> {
  const start = Date.now();
  try {
    const params = {
      q: JSON.stringify({
        rentable: { eq: true },
        rented: { eq: false },
        num_gpus: { gte: 1 },
        // Filter to known high-end GPUs
        type: "bid",
      }),
      order: "dph_total asc",
      limit: 500,
    };

    const headers: Record<string, string> = {
      "Accept": "application/json",
    };
    if (process.env.VASTAI_API_KEY) {
      headers["Authorization"] = `Bearer ${process.env.VASTAI_API_KEY}`;
    }

    const { data } = await axios.get("https://console.vast.ai/api/v0/bundles/", {
      params,
      headers,
      timeout: 15000,
    });

    const offers: unknown[] = data.offers ?? [];
    const fetchedAt = new Date().toISOString();

    // Aggregate by GPU model — find best price per GPU model
    const bestByModel = new Map<string, GpuListing>();

    for (const offer of offers as Record<string, unknown>[]) {
      const rawModel = (offer.gpu_name as string) ?? "Unknown";
      const gpuModel = normalizeGpuName(rawModel);

      // Skip very old or weird GPUs
      if (gpuModel === rawModel && !rawModel.match(/H100|A100|L40|RTX/i)) continue;

      const pricePerHour = parseFloat(String(offer.dph_total ?? 0));
      if (pricePerHour <= 0) continue;

      const numGpus = parseInt(String(offer.num_gpus ?? 1));
      const pricePerGpuHour = pricePerHour / numGpus;

      const listing: GpuListing = {
        provider: "vast.ai",
        provider_slug: "vastai",
        gpu_model: gpuModel,
        gpu_count: numGpus,
        pricing_type: "spot",
        price_per_hour: parseFloat(pricePerHour.toFixed(4)),
        region: (offer.geolocation as string) ?? "Unknown",
        availability: getAvailability(numGpus),
        vcpus: parseInt(String(offer.cpu_cores_effective ?? 0)),
        ram_gb: parseFloat(String(offer.cpu_ram ?? 0)) / 1024,
        storage_gb: parseFloat(String(offer.disk_space ?? 0)),
        network_gbps: parseFloat(String(offer.inet_up ?? 0)) / 1000,
        raw_data: {
          id: offer.id,
          price_per_gpu_hour: pricePerGpuHour,
          reliability: offer.reliability2,
          inet_up: offer.inet_up,
          inet_down: offer.inet_down,
        },
        fetched_at: fetchedAt,
      };

      // Keep only the cheapest listing per GPU model
      const existing = bestByModel.get(gpuModel);
      if (!existing || listing.price_per_hour < existing.price_per_hour) {
        bestByModel.set(gpuModel, listing);
      }
    }

    const listings = Array.from(bestByModel.values());
    console.log(`[vast.ai] Fetched ${offers.length} raw offers → ${listings.length} GPU models`);

    return {
      provider: "vast.ai",
      listings,
      success: true,
      duration_ms: Date.now() - start,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[vast.ai] Error: ${error}`);
    return {
      provider: "vast.ai",
      listings: [],
      success: false,
      error,
      duration_ms: Date.now() - start,
    };
  }
}
