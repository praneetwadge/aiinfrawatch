// @ts-nocheck
import axios from "axios";
import type { GpuListing, ScraperResult } from "@/types";

const GPU_NAME_MAP = {
  "RTX_4090": "RTX 4090 24GB",
  "RTX_3090": "RTX 3090 24GB",
  "A100_SXM4": "A100 SXM 80GB",
  "A100_PCIE": "A100 PCIe 80GB",
  "H100_SXM5": "H100 SXM5 80GB",
  "H100_SXM": "H100 SXM 80GB",
  "H100_PCIE": "H100 PCIe 80GB",
  "H100_NVL": "H100 NVL 80GB",
  "L40S": "L40S 48GB",
  "L40": "L40 48GB",
  "A10G": "A10G 24GB",
  "A10": "A10G 24GB",
};

function normalizeGpuName(name) {
  if (!name) return null;
  const upper = name.toUpperCase().replace(/\s+/g, "_");
  for (const [key, val] of Object.entries(GPU_NAME_MAP)) {
    if (upper.includes(key)) return val;
  }
  return null;
}

export async function scrapeVastAi(): Promise<ScraperResult> {
  const start = Date.now();
  try {
    const headers = { "Accept": "application/json" };
    if (process.env.VASTAI_API_KEY) {
      headers["Authorization"] = `Bearer ${process.env.VASTAI_API_KEY}`;
    }

    // Use offers endpoint - public, no auth needed
    const { data } = await axios.get("https://console.vast.ai/api/v0/bundles/", {
      params: {
        q: JSON.stringify({
          rentable: { eq: true },
          rented: { eq: false },
          num_gpus: { gte: 1 },
        }),
        order: "dph_total asc",
        limit: 200,
      },
      headers,
      timeout: 20000,
    });

    const offers = data?.offers ?? data?.bundles ?? [];
    const fetchedAt = new Date().toISOString();
    const listings: GpuListing[] = [];

    for (const offer of offers) {
      const gpuName = normalizeGpuName(offer.gpu_name ?? offer.gpu_arch);
      if (!gpuName) continue;
      const pricePerGpu = offer.dph_total ?? offer.min_bid ?? 0;
      if (!pricePerGpu || pricePerGpu <= 0) continue;

      listings.push({
        provider: "vast.ai",
        provider_slug: "vastai",
        gpu_model: gpuName,
        gpu_count: offer.num_gpus ?? 1,
        pricing_type: "spot",
        price_per_hour: parseFloat(pricePerGpu.toFixed(4)),
        region: offer.geolocation ?? offer.location?.country ?? "global",
        availability: offer.num_gpus >= 8 ? "high" : offer.num_gpus >= 2 ? "medium" : "low",
        vcpus: offer.cpu_cores_effective ?? offer.vcpus,
        ram_gb: offer.cpu_ram ? Math.round(offer.cpu_ram / 1024) : undefined,
        raw_data: { id: offer.id, inet_up: offer.inet_up, inet_down: offer.inet_down },
        fetched_at: fetchedAt,
      });
    }

    return { provider: "vastai", listings, success: true, duration_ms: Date.now() - start };
  } catch (err) {
    return { provider: "vastai", listings: [], success: false, error: err.message, duration_ms: Date.now() - start };
  }
}
