// @ts-nocheck
/**
 * RunPod scraper
 * Docs: https://docs.runpod.io/docs/graphql-api
 * Endpoint: POST https://api.runpod.io/graphql
 * Requires API key for community cloud; public cloud is queryable without auth
 */

import axios from "axios";
import type { GpuListing, ScraperResult } from "@/types";

const RUNPOD_GQL = "https://api.runpod.io/graphql";

const GPU_TYPES_QUERY = `
  query GpuTypes {
    gpuTypes {
      id
      displayName
      memoryInGb
      secureCloud
      communityCloud
      lowestPrice(input: { gpuCount: 1 }) {
        minimumBidPrice
        uninterruptablePrice
      }
      securePrice
      communityPrice
    }
  }
`;

function mapRunpodGpu(displayName: string, memGb: number): string {
  const name = displayName.toUpperCase();
  if (name.includes("H100") && name.includes("SXM")) return `H100 SXM 80GB`;
  if (name.includes("H100") && name.includes("NVL")) return `H100 NVL 80GB`;
  if (name.includes("H100")) return `H100 PCIe 80GB`;
  if (name.includes("A100") && memGb >= 80) return `A100 SXM 80GB`;
  if (name.includes("A100") && memGb <= 40) return `A100 SXM 40GB`;
  if (name.includes("A100")) return `A100 PCIe 80GB`;
  if (name.includes("L40S")) return `L40S 48GB`;
  if (name.includes("L40")) return `L40 48GB`;
  if (name.includes("A10G") || (name.includes("A10") && !name.includes("A100"))) return `A10G 24GB`;
  if (name.includes("4090")) return `RTX 4090 24GB`;
  if (name.includes("3090")) return `RTX 3090 24GB`;
  return displayName;
}

export async function scrapeRunPod(): Promise<ScraperResult> {
  const start = Date.now();
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (process.env.RUNPOD_API_KEY) {
      headers["Authorization"] = `Bearer ${process.env.RUNPOD_API_KEY}`;
    }

    const { data } = await axios.post(
      RUNPOD_GQL,
      { query: GPU_TYPES_QUERY },
      { headers, timeout: 15000 }
    );

    const gpuTypes = data?.data?.gpuTypes ?? [];
    const fetchedAt = new Date().toISOString();
    const listings: GpuListing[] = [];

    for (const gpu of gpuTypes) {
      const gpuModel = mapRunpodGpu(gpu.displayName, gpu.memoryInGb);

      // Secure cloud (on-demand)
      if (gpu.secureCloud && gpu.securePrice > 0) {
        listings.push({
          provider: "RunPod",
          provider_slug: "runpod",
          gpu_model: gpuModel,
          gpu_count: 1,
          pricing_type: "on-demand",
          price_per_hour: parseFloat(parseFloat(gpu.securePrice).toFixed(4)),
          region: "US/EU (Secure)",
          availability: "high",
          raw_data: { gpu_id: gpu.id, type: "secure" },
          fetched_at: fetchedAt,
        });
      }

      // Community cloud (spot)
      const spotPrice = gpu.lowestPrice?.minimumBidPrice ?? gpu.communityPrice;
      if (gpu.communityCloud && spotPrice > 0) {
        listings.push({
          provider: "RunPod",
          provider_slug: "runpod",
          gpu_model: gpuModel,
          gpu_count: 1,
          pricing_type: "spot",
          price_per_hour: parseFloat(parseFloat(String(spotPrice)).toFixed(4)),
          region: "US/EU (Community)",
          availability: "medium",
          raw_data: {
            gpu_id: gpu.id,
            type: "community",
            uninterruptable: gpu.lowestPrice?.uninterruptablePrice,
          },
          fetched_at: fetchedAt,
        });
      }
    }

    console.log(`[RunPod] Fetched ${gpuTypes.length} GPU types → ${listings.length} listings`);

    return {
      provider: "RunPod",
      listings,
      success: true,
      duration_ms: Date.now() - start,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[RunPod] Error: ${error}`);
    return {
      provider: "RunPod",
      listings: [],
      success: false,
      error,
      duration_ms: Date.now() - start,
    };
  }
}
