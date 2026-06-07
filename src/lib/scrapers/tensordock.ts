/**
 * TensorDock scraper
 * Distributed GPU marketplace — budget-friendly, good RTX + A100 selection
 * API: https://console.tensordock.com/api
 * Public endpoint: no auth required for listing
 */

import axios from "axios";
import type { GpuListing, ScraperResult } from "@/types";

const TENSORDOCK_API = "https://console.tensordock.com/api/v0/client/deploy/hostnodes";

const GPU_MODEL_MAP: Record<string, string> = {
  "A100_PCIE_80GB":  "A100 PCIe 80GB",
  "A100_SXM4_80GB":  "A100 SXM 80GB",
  "A100_PCIE_40GB":  "A100 SXM 40GB",
  "H100_PCIE_80GB":  "H100 PCIe 80GB",
  "H100_SXM_80GB":   "H100 SXM 80GB",
  "L40S":            "L40S 48GB",
  "L40":             "L40 48GB",
  "A10":             "A10G 24GB",
  "A10G":            "A10G 24GB",
  "RTX4090":         "RTX 4090 24GB",
  "RTX3090":         "RTX 3090 24GB",
  "RTX3090TI":       "RTX 3090 24GB",
};

export async function scrapeTensorDock(): Promise<ScraperResult> {
  const start = Date.now();
  try {
    const { data } = await axios.get(TENSORDOCK_API, {
      params: { minram: 20, mincpu: 4, minvram: 16 },
      timeout: 15000,
    });

    const hosts: Record<string, unknown>[] = data?.hostnodes
      ? Object.values(data.hostnodes)
      : [];

    const fetchedAt = new Date().toISOString();
    const bestByModel = new Map<string, GpuListing>();

    for (const host of hosts) {
      const gpus = (host.specs as Record<string, unknown>)?.gpu as Record<string, unknown>;
      if (!gpus) continue;

      for (const [gpuKey, gpuSpec] of Object.entries(gpus)) {
        const spec = gpuSpec as Record<string, unknown>;
        const amount = parseInt(String(spec.amount ?? 0));
        if (amount <= 0) continue;

        const rawModel = gpuKey.toUpperCase().replace(/\s+/g, "_");
        let gpuModel = "Unknown";
        for (const [key, val] of Object.entries(GPU_MODEL_MAP)) {
          if (rawModel.includes(key)) { gpuModel = val; break; }
        }
        if (gpuModel === "Unknown") continue;

        const pricePerGpuHour = parseFloat(String(spec.price ?? 0));
        if (pricePerGpuHour <= 0) continue;

        const location = (host.location as Record<string, string>) ?? {};
        const region = `${location.country ?? "US"} (${location.city ?? "Unknown"})`;

        const listing: GpuListing = {
          provider: "TensorDock",
          provider_slug: "tensordock",
          gpu_model: gpuModel,
          gpu_count: amount,
          pricing_type: "spot",
          price_per_hour: parseFloat((pricePerGpuHour * amount).toFixed(4)),
          region,
          availability: amount >= 4 ? "high" : amount >= 2 ? "medium" : "low",
          vcpus: parseInt(String((host.specs as Record<string, unknown>)?.cpu ?? 0)),
          ram_gb: parseFloat(String((host.specs as Record<string, unknown>)?.ram ?? 0)),
          raw_data: { gpu_key: gpuKey, price_per_gpu: pricePerGpuHour },
          fetched_at: fetchedAt,
        };

        const existing = bestByModel.get(gpuModel);
        if (!existing || listing.price_per_hour < existing.price_per_hour) {
          bestByModel.set(gpuModel, listing);
        }
      }
    }

    const listings = Array.from(bestByModel.values());
    console.log(`[TensorDock] Fetched ${hosts.length} hosts → ${listings.length} GPU models`);
    return { provider: "TensorDock", listings, success: true, duration_ms: Date.now() - start };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[TensorDock] Error: ${error}`);
    return { provider: "TensorDock", listings: [], success: false, error, duration_ms: Date.now() - start };
  }
}
