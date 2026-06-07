// @ts-nocheck
/**
 * GCP GPU pricing scraper
 * Uses GCP Cloud Billing Catalog API — public, no auth required
 * https://cloudbilling.googleapis.com/v1/services/{service}/skus
 *
 * GCP Compute Engine service: 6F81-5844-456A
 * We target a2 (A100) and a3 (H100) machine families
 */

import axios from "axios";
import type { GpuListing, ScraperResult } from "@/types";

const GCP_BILLING_BASE = "https://cloudbilling.googleapis.com/v1";
const COMPUTE_SERVICE_ID = "6F81-5844-456A";

const GPU_SKU_PATTERNS: Array<{
  pattern: RegExp;
  gpu: string;
  regions: string[];
}> = [
  {
    pattern: /A3 Instance Core.*running in/i,
    gpu: "H100 SXM5 80GB",
    regions: ["us-central1", "europe-west4", "asia-east1"],
  },
  {
    pattern: /A2 Ultra Instance Core.*running in/i,
    gpu: "A100 SXM 80GB",
    regions: ["us-central1", "us-east1", "europe-west4"],
  },
  {
    pattern: /A2 Instance Core.*running in/i,
    gpu: "A100 SXM 40GB",
    regions: ["us-central1", "us-east1", "us-west1", "europe-west4"],
  },
  {
    pattern: /Preemptible A3 Instance Core/i,
    gpu: "H100 SXM5 80GB",
    regions: ["us-central1"],
  },
];

// GCP machine type → GPU count
const A3_GPUS: Record<string, number> = {
  "a3-highgpu-8g": 8,
  "a3-megagpu-8g": 8,
};
const A2_GPUS: Record<string, number> = {
  "a2-highgpu-1g": 1,
  "a2-highgpu-2g": 2,
  "a2-highgpu-4g": 4,
  "a2-highgpu-8g": 8,
  "a2-megagpu-16g": 16,
  "a2-ultragpu-1g": 1,
  "a2-ultragpu-2g": 2,
  "a2-ultragpu-4g": 4,
  "a2-ultragpu-8g": 8,
};

export async function scrapeGCP(): Promise<ScraperResult> {
  const start = Date.now();
  try {
    const fetchedAt = new Date().toISOString();
    const listings: GpuListing[] = [];

    let pageToken: string | undefined;
    let page = 0;
    const MAX_PAGES = 20;

    do {
      const params: Record<string, string> = { pageSize: "500" };
      if (process.env.GCP_API_KEY) params.key = process.env.GCP_API_KEY;
      if (pageToken) params.pageToken = pageToken;

      const { data } = await axios.get(
        `${GCP_BILLING_BASE}/services/${COMPUTE_SERVICE_ID}/skus`,
        { params, timeout: 20000 }
      );

      const skus: unknown[] = data.skus ?? [];

      for (const sku of skus as Record<string, unknown>[]) {
        const desc = (sku.description as string) ?? "";

        // Only interested in GPU-related compute SKUs
        const match = GPU_SKU_PATTERNS.find((p) => p.pattern.test(desc));
        if (!match) continue;

        const isSpot = /Preemptible|Spot/i.test(desc);
        const pricingInfo = (sku.pricingInfo as Record<string, unknown>[]) ?? [];
        if (!pricingInfo.length) continue;

        const tier = (pricingInfo[0] as Record<string, unknown>)
          ?.pricingExpression as Record<string, unknown>;
        const tieredRates = (tier?.tieredRates as Record<string, unknown>[]) ?? [];
        if (!tieredRates.length) continue;

        const unitPrice = tieredRates[tieredRates.length - 1]?.unitPrice as Record<string, unknown>;
        if (!unitPrice) continue;

        const units = parseInt(String(unitPrice.units ?? 0));
        const nanos = parseInt(String(unitPrice.nanos ?? 0));
        const pricePerHour = units + nanos / 1e9;
        if (pricePerHour <= 0) continue;

        const serviceRegions = (sku.serviceRegions as string[]) ?? match.regions;

        for (const region of serviceRegions.slice(0, 4)) {
          listings.push({
            provider: "GCP",
            provider_slug: "gcp",
            gpu_model: match.gpu,
            gpu_count: match.gpu.includes("H100") ? 8 : 8, // A3/A2 standard config
            pricing_type: isSpot ? "spot" : "on-demand",
            price_per_hour: parseFloat(pricePerHour.toFixed(4)),
            region,
            availability: "high",
            raw_data: { sku_id: sku.skuId, description: desc },
            fetched_at: fetchedAt,
          });
        }
      }

      pageToken = data.nextPageToken;
      page++;
    } while (pageToken && page < MAX_PAGES);

    // Dedupe by model+region+type
    const seen = new Set<string>();
    const deduped = listings.filter((l) => {
      const key = `${l.gpu_model}|${l.region}|${l.pricing_type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`[GCP] Found ${deduped.length} GPU listings across ${page} pages`);

    return {
      provider: "GCP",
      listings: deduped,
      success: true,
      duration_ms: Date.now() - start,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[GCP] Error: ${error}`);
    return {
      provider: "GCP",
      listings: [],
      success: false,
      error,
      duration_ms: Date.now() - start,
    };
  }
}
