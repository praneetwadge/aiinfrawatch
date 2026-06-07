/**
 * Azure GPU pricing scraper
 * Uses Azure Retail Prices API — public, no auth required
 * https://prices.azure.com/api/retail/prices
 *
 * Target SKUs: NDsrv5 (H100 SXM), NCv3 (V100), NCasv3 (A100), NVadsA10v5 (A10)
 * Docs: https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices
 */

import axios from "axios";
import type { GpuListing, ScraperResult } from "@/types";

const AZURE_RETAIL_API = "https://prices.azure.com/api/retail/prices";

// Azure VM series → GPU mapping
const AZURE_VM_GPU_MAP: Record<string, { gpu: string; count: number; network_gbps: number; vcpus: number; ram_gb: number }> = {
  // H100 series (NDsrv5)
  "Standard_ND96isr_H100_v5":  { gpu: "H100 SXM 80GB",  count: 8,  network_gbps: 400,  vcpus: 96,  ram_gb: 1900 },
  "Standard_ND96isrH100v5":    { gpu: "H100 SXM 80GB",  count: 8,  network_gbps: 400,  vcpus: 96,  ram_gb: 1900 },
  // H100 NVL NC series
  "Standard_NC40ads_H100_v5":  { gpu: "H100 NVL 80GB",  count: 1,  network_gbps: 80,   vcpus: 40,  ram_gb: 320  },
  "Standard_NC80adis_H100_v5": { gpu: "H100 NVL 80GB",  count: 2,  network_gbps: 160,  vcpus: 80,  ram_gb: 640  },
  // A100 series (NDv4)
  "Standard_ND96asr_v4":       { gpu: "A100 SXM 80GB",  count: 8,  network_gbps: 400,  vcpus: 96,  ram_gb: 900  },
  "Standard_ND96amsr_A100_v4": { gpu: "A100 SXM 80GB",  count: 8,  network_gbps: 400,  vcpus: 96,  ram_gb: 1900 },
  // A100 NC series (PCIe)
  "Standard_NC24ads_A100_v4":  { gpu: "A100 PCIe 80GB", count: 1,  network_gbps: 40,   vcpus: 24,  ram_gb: 220  },
  "Standard_NC48ads_A100_v4":  { gpu: "A100 PCIe 80GB", count: 2,  network_gbps: 80,   vcpus: 48,  ram_gb: 440  },
  "Standard_NC96ads_A100_v4":  { gpu: "A100 PCIe 80GB", count: 4,  network_gbps: 160,  vcpus: 96,  ram_gb: 880  },
  // A10 series (NVadsA10v5)
  "Standard_NV6ads_A10_v5":    { gpu: "A10G 24GB",      count: 1,  network_gbps: 10,   vcpus: 6,   ram_gb: 55   },
  "Standard_NV18ads_A10_v5":   { gpu: "A10G 24GB",      count: 1,  network_gbps: 20,   vcpus: 18,  ram_gb: 220  },
  "Standard_NV36ads_A10_v5":   { gpu: "A10G 24GB",      count: 1,  network_gbps: 40,   vcpus: 36,  ram_gb: 440  },
  "Standard_NV72ads_A10_v5":   { gpu: "A10G 24GB",      count: 2,  network_gbps: 80,   vcpus: 72,  ram_gb: 880  },
  // L40S series (NVadsL40sv5)
  "Standard_NV6adms_L40S_v5":  { gpu: "L40S 48GB",      count: 1,  network_gbps: 10,   vcpus: 6,   ram_gb: 55   },
  "Standard_NV72adms_L40S_v5": { gpu: "L40S 48GB",      count: 4,  network_gbps: 80,   vcpus: 72,  ram_gb: 880  },
};

const TARGET_REGIONS = ["eastus", "eastus2", "westus2", "westus3", "westeurope", "northeurope", "southeastasia"];

export async function scrapeAzure(): Promise<ScraperResult> {
  const start = Date.now();
  try {
    const fetchedAt = new Date().toISOString();
    const listings: GpuListing[] = [];

    const vmNames = Object.keys(AZURE_VM_GPU_MAP);

    // Azure Retail API supports OData filter — batch by VM name patterns
    // We query for Linux (most common for AI), consumption pricing
    const filter = [
      `serviceName eq 'Virtual Machines'`,
      `priceType eq 'Consumption'`,
      // Filter to target VM names using OR
      `(${vmNames.slice(0, 10).map(n => `armSkuName eq '${n}'`).join(" or ")})`,
    ].join(" and ");

    let nextPage: string | null = `${AZURE_RETAIL_API}?api-version=2023-01-01-preview&$filter=${encodeURIComponent(filter)}`;
    let pageCount = 0;
    const MAX_PAGES = 10;

    while (nextPage && pageCount < MAX_PAGES) {
      const { data } = await axios.get(nextPage, { timeout: 20000 });
      const items: Record<string, unknown>[] = data.Items ?? [];

      for (const item of items) {
        const skuName = item.armSkuName as string;
        const gpuInfo = AZURE_VM_GPU_MAP[skuName];
        if (!gpuInfo) continue;

        // Only Linux (Spot or standard consumption)
        const productName = item.productName as string;
        if (!productName.includes("Linux") && !productName.includes("linux")) continue;

        const isSpot = (item.skuName as string)?.toLowerCase().includes("spot");
        const region = item.armRegionName as string;
        if (!TARGET_REGIONS.includes(region)) continue;

        const price = parseFloat(String(item.retailPrice ?? 0));
        if (price <= 0) continue;

        listings.push({
          provider: "Azure",
          provider_slug: "azure",
          gpu_model: gpuInfo.gpu,
          gpu_count: gpuInfo.count,
          pricing_type: isSpot ? "spot" : "on-demand",
          price_per_hour: parseFloat(price.toFixed(4)),
          region,
          availability: region.startsWith("east") || region.startsWith("west") ? "high" : "medium",
          vcpus: gpuInfo.vcpus,
          ram_gb: gpuInfo.ram_gb,
          network_gbps: gpuInfo.network_gbps,
          interconnect: gpuInfo.count >= 8 ? "InfiniBand" : undefined,
          raw_data: { sku: skuName, product_name: productName, sku_id: item.skuId },
          fetched_at: fetchedAt,
        });
      }

      nextPage = data.NextPageLink ?? null;
      pageCount++;
    }

    // Also fetch the second batch of VM names
    const filter2 = [
      `serviceName eq 'Virtual Machines'`,
      `priceType eq 'Consumption'`,
      `(${vmNames.slice(10).map(n => `armSkuName eq '${n}'`).join(" or ")})`,
    ].join(" and ");

    try {
      const { data: data2 } = await axios.get(
        `${AZURE_RETAIL_API}?api-version=2023-01-01-preview&$filter=${encodeURIComponent(filter2)}`,
        { timeout: 20000 }
      );
      for (const item of (data2.Items ?? []) as Record<string, unknown>[]) {
        const skuName = item.armSkuName as string;
        const gpuInfo = AZURE_VM_GPU_MAP[skuName];
        if (!gpuInfo) continue;
        const productName = item.productName as string;
        if (!productName.includes("Linux")) continue;
        const isSpot = (item.skuName as string)?.toLowerCase().includes("spot");
        const region = item.armRegionName as string;
        if (!TARGET_REGIONS.includes(region)) continue;
        const price = parseFloat(String(item.retailPrice ?? 0));
        if (price <= 0) continue;
        listings.push({
          provider: "Azure",
          provider_slug: "azure",
          gpu_model: gpuInfo.gpu,
          gpu_count: gpuInfo.count,
          pricing_type: isSpot ? "spot" : "on-demand",
          price_per_hour: parseFloat(price.toFixed(4)),
          region,
          availability: "high",
          vcpus: gpuInfo.vcpus,
          ram_gb: gpuInfo.ram_gb,
          network_gbps: gpuInfo.network_gbps,
          raw_data: { sku: skuName },
          fetched_at: fetchedAt,
        });
      }
    } catch { /* ignore second batch errors */ }

    // Dedupe by model + region + type
    const seen = new Set<string>();
    const deduped = listings.filter((l) => {
      const key = `${l.gpu_model}|${l.region}|${l.pricing_type}|${l.gpu_count}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`[Azure] Fetched ${deduped.length} GPU listings across ${pageCount} pages`);

    return { provider: "Azure", listings: deduped, success: true, duration_ms: Date.now() - start };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[Azure] Error: ${error}`);
    return { provider: "Azure", listings: [], success: false, error, duration_ms: Date.now() - start };
  }
}
