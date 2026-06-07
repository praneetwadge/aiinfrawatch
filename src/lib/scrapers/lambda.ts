// @ts-nocheck
/**
 * Lambda Labs scraper
 * Docs: https://docs.lambdalabs.com/on-demand-cloud/cloud-api
 * Endpoint: GET https://cloud.lambdalabs.com/api/v1/instance-types
 * Requires API key
 */

import axios from "axios";
import type { GpuListing, ScraperResult } from "@/types";

interface LambdaInstanceType {
  instance_type: {
    name: string;
    description: string;
    gpu_description: string;
    price_cents_per_hour: number;
    specs: {
      vcpus: number;
      memory_gib: number;
      storage_gib: number;
    };
    gpus: number;
  };
  regions_with_capacity_available: Array<{ name: string; description: string }>;
}

function mapLambdaGpu(gpuDesc: string): string {
  if (gpuDesc.includes("H100") && gpuDesc.includes("SXM5")) return "H100 SXM5 80GB";
  if (gpuDesc.includes("H100")) return "H100 SXM 80GB";
  if (gpuDesc.includes("A100") && gpuDesc.includes("80")) return "A100 SXM 80GB";
  if (gpuDesc.includes("A100")) return "A100 SXM 40GB";
  if (gpuDesc.includes("A10G")) return "A10G 24GB";
  return gpuDesc;
}

export async function scrapeLambdaLabs(): Promise<ScraperResult> {
  const start = Date.now();
  try {
    if (!process.env.LAMBDA_API_KEY) {
      throw new Error("LAMBDA_API_KEY not set");
    }

    const { data } = await axios.get(
      "https://cloud.lambdalabs.com/api/v1/instance-types",
      {
        headers: {
          Authorization: `Basic ${Buffer.from(process.env.LAMBDA_API_KEY + ":").toString("base64")}`,
        },
        timeout: 15000,
      }
    );

    const instanceTypes: Record<string, LambdaInstanceType> = data.data ?? {};
    const fetchedAt = new Date().toISOString();
    const listings: GpuListing[] = [];

    for (const [, info] of Object.entries(instanceTypes)) {
      const it = info.instance_type;
      if (!it || it.price_cents_per_hour <= 0) continue;

      const hasCapacity = info.regions_with_capacity_available.length > 0;
      const regions = hasCapacity
        ? info.regions_with_capacity_available.map((r) => r.name)
        : ["us-west-1"]; // fallback — still show pricing even if no capacity

      for (const region of regions) {
        listings.push({
          provider: "Lambda Labs",
          provider_slug: "lambda",
          gpu_model: mapLambdaGpu(it.gpu_description),
          gpu_count: it.gpus,
          pricing_type: "on-demand",
          price_per_hour: parseFloat((it.price_cents_per_hour / 100).toFixed(4)),
          region,
          availability: hasCapacity ? "high" : "unavailable",
          vcpus: it.specs.vcpus,
          ram_gb: it.specs.memory_gib,
          storage_gb: it.specs.storage_gib,
          raw_data: { instance_type: it.name, description: it.description },
          fetched_at: fetchedAt,
        });
      }
    }

    console.log(`[Lambda Labs] Fetched ${Object.keys(instanceTypes).length} types → ${listings.length} listings`);

    return {
      provider: "Lambda Labs",
      listings,
      success: true,
      duration_ms: Date.now() - start,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[Lambda Labs] Error: ${error}`);
    return {
      provider: "Lambda Labs",
      listings: [],
      success: false,
      error,
      duration_ms: Date.now() - start,
    };
  }
}
