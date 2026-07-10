// @ts-nocheck
/**
 * AWS GPU pricing scraper
 * Uses AWS public pricing API — no credentials required
 * https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEC2/current/index.json
 *
 * We target p4d, p4de, p5, g5 instance families (GPU instances)
 */

import axios from "axios";
import type { GpuListing, ScraperResult } from "@/types";

// AWS bulk pricing index is huge — use the filtered regional endpoint
const AWS_PRICING_BASE = "https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEC2/current";

const TARGET_FAMILIES = ["p4d", "p4de", "p5", "g5", "g6"];
// Was 4 regions fetched in parallel. AWS's regional EC2 pricing index is the
// FULL catalog (every instance type, not just GPUs) — tens of MB per region.
// Fetching + parsing 4 of them concurrently in one serverless invocation was
// blowing past the cron route's internal timeout every single day (confirmed:
// aws.gpu_listings hadn't refreshed in 7 days while every other provider
// refreshed daily). Trimmed to us-east-1 only — it's AWS's primary/cheapest
// GPU region and typically has the broadest instance-type coverage, so this
// keeps real, live AWS pricing flowing without the payload blowing the budget.
const TARGET_REGIONS = ["us-east-1"];

// Map AWS instance families to GPU models
const INSTANCE_GPU_MAP: Record<string, { gpu: string; count: number }> = {
  "p5.48xlarge":     { gpu: "H100 SXM5 80GB", count: 8 },
  "p4de.24xlarge":   { gpu: "A100 SXM 80GB",  count: 8 },
  "p4d.24xlarge":    { gpu: "A100 SXM 40GB",  count: 8 },
  "g5.xlarge":       { gpu: "A10G 24GB",       count: 1 },
  "g5.2xlarge":      { gpu: "A10G 24GB",       count: 1 },
  "g5.4xlarge":      { gpu: "A10G 24GB",       count: 1 },
  "g5.8xlarge":      { gpu: "A10G 24GB",       count: 1 },
  "g5.16xlarge":     { gpu: "A10G 24GB",       count: 1 },
  "g5.12xlarge":     { gpu: "A10G 24GB",       count: 4 },
  "g5.48xlarge":     { gpu: "A10G 24GB",       count: 8 },
  "g6.xlarge":       { gpu: "L40S 48GB",        count: 1 },
  "g6.12xlarge":     { gpu: "L40S 48GB",        count: 4 },
  "g6.48xlarge":     { gpu: "L40S 48GB",        count: 8 },
};

export async function scrapeAWS(): Promise<ScraperResult> {
  const start = Date.now();
  try {
    const fetchedAt = new Date().toISOString();
    const listings: GpuListing[] = [];

    // Fetch pricing for each region in parallel
    await Promise.all(
      TARGET_REGIONS.map(async (region) => {
        try {
          const url = `${AWS_PRICING_BASE}/${region}/index.json`;
          const { data } = await axios.get(url, {
            timeout: 20000,
            // AWS pricing JSON is large — we only need a slice
            responseType: "json",
          });

          const products = data.products ?? {};
          const terms = data.terms?.OnDemand ?? {};

          for (const [sku, product] of Object.entries(products) as [string, Record<string, unknown>][]) {
            const attrs = product.attributes as Record<string, string>;
            if (!attrs) continue;

            const instanceType = attrs.instanceType ?? "";
            const gpuInfo = INSTANCE_GPU_MAP[instanceType];
            if (!gpuInfo) continue;

            // Check OS and tenancy
            if (attrs.operatingSystem !== "Linux") continue;
            if (attrs.tenancy !== "Shared") continue;
            if (attrs.preInstalledSw !== "NA") continue;
            if (attrs.capacitystatus !== "Used") continue;

            // Find on-demand price
            const skuTerms = terms[sku];
            if (!skuTerms) continue;

            for (const term of Object.values(skuTerms) as Record<string, unknown>[]) {
              const priceDimensions = (term as Record<string, Record<string, unknown>>).priceDimensions;
              if (!priceDimensions) continue;
              for (const dim of Object.values(priceDimensions) as Record<string, unknown>[]) {
                const pricePerUnit = parseFloat(
                  (dim as Record<string, Record<string, string>>).pricePerUnit?.USD ?? "0"
                );
                if (pricePerUnit <= 0) continue;

                listings.push({
                  provider: "AWS",
                  provider_slug: "aws",
                  gpu_model: gpuInfo.gpu,
                  gpu_count: gpuInfo.count,
                  pricing_type: "on-demand",
                  price_per_hour: parseFloat(pricePerUnit.toFixed(4)),
                  region,
                  availability: "high",
                  vcpus: parseInt(attrs.vcpu ?? "0"),
                  ram_gb: parseFloat((attrs.memory ?? "0").replace(" GiB", "")),
                  network_gbps: parseFloat(attrs.networkPerformance ?? "0") || undefined,
                  raw_data: { instance_type: instanceType, sku },
                  fetched_at: fetchedAt,
                });
                break; // one price per product
              }
            }
          }

          console.log(`[AWS] ${region}: found ${listings.filter((l) => l.region === region).length} GPU listings`);
        } catch (regionErr) {
          console.warn(`[AWS] Failed for region ${region}:`, regionErr);
        }
      })
    );

    return {
      provider: "AWS",
      listings,
      success: true,
      duration_ms: Date.now() - start,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[AWS] Error: ${error}`);
    return {
      provider: "AWS",
      listings: [],
      success: false,
      error,
      duration_ms: Date.now() - start,
    };
  }
}
