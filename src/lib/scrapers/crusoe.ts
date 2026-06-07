// @ts-nocheck
/**
 * Crusoe Cloud scraper
 * AI-only cloud powered by stranded natural gas + renewables
 * $3.4B valuation, 16,000+ H100s deployed, linked to Stargate capacity deals
 *
 * Notable: unique sustainability story, 100% AI-focused, Tier III facilities
 * Energy: stranded gas (methane capture), wind, solar, hydro, geothermal
 * Carbon: significantly lower intensity than grid-powered data centers
 *
 * H100 on-demand: $3.90/hr | H200: $4.29/hr | A100: $1.65/hr
 * Also has AMD MI300X, L40S, B200 (reserved/enterprise)
 *
 * API: https://api.crusoe.ai (requires key)
 * Public pricing: crusoe.ai/products/cloud
 */

import axios from "axios";
import type { GpuListing, ScraperResult } from "@/types";

const CRUSOE_API = "https://api.crusoe.ai/v1alpha5";

// Crusoe published pricing — May 2026
// Sources: spheron.network/blog/spheron-vs-crusoe, gridstackhub.ai, awesomeagents.ai
const CRUSOE_PRICING: Array<{
  gpu: string;
  gpu_count: number;
  pricing_type: "on-demand" | "spot" | "reserved-1yr";
  price_per_hour: number;
  region: string;
  vcpus: number;
  ram_gb: number;
  storage_gb: number;
  network_gbps: number;
  interconnect?: string;
  availability: "high" | "medium" | "low";
  carbon_note?: string;
}> = [
  // H100 SXM — primary product
  {
    gpu: "H100 SXM 80GB", gpu_count: 1,  pricing_type: "on-demand",
    price_per_hour: 3.90,  region: "us-west-1 (Denver)",
    vcpus: 24, ram_gb: 200, storage_gb: 1000, network_gbps: 100,
    interconnect: "InfiniBand", availability: "high",
    carbon_note: "stranded_gas+renewable",
  },
  {
    gpu: "H100 SXM 80GB", gpu_count: 8,  pricing_type: "on-demand",
    price_per_hour: 31.20, region: "us-west-1 (Denver)",
    vcpus: 192, ram_gb: 1600, storage_gb: 8000, network_gbps: 400,
    interconnect: "InfiniBand", availability: "high",
    carbon_note: "stranded_gas+renewable",
  },
  {
    gpu: "H100 SXM 80GB", gpu_count: 8,  pricing_type: "spot",
    price_per_hour: 20.80, region: "us-west-1 (Denver)",
    vcpus: 192, ram_gb: 1600, storage_gb: 8000, network_gbps: 400,
    interconnect: "InfiniBand", availability: "medium",
    carbon_note: "stranded_gas+renewable",
  },
  {
    gpu: "H100 SXM 80GB", gpu_count: 1,  pricing_type: "on-demand",
    price_per_hour: 3.90,  region: "us-central-1",
    vcpus: 24, ram_gb: 200, storage_gb: 1000, network_gbps: 100,
    interconnect: "InfiniBand", availability: "medium",
    carbon_note: "renewable",
  },
  // H200 SXM
  {
    gpu: "H200 SXM 141GB", gpu_count: 1,  pricing_type: "on-demand",
    price_per_hour: 4.29,  region: "us-west-1 (Denver)",
    vcpus: 24, ram_gb: 200, storage_gb: 1000, network_gbps: 200,
    interconnect: "InfiniBand", availability: "medium",
    carbon_note: "stranded_gas+renewable",
  },
  {
    gpu: "H200 SXM 141GB", gpu_count: 8,  pricing_type: "on-demand",
    price_per_hour: 34.32, region: "us-west-1 (Denver)",
    vcpus: 192, ram_gb: 1600, storage_gb: 8000, network_gbps: 800,
    interconnect: "InfiniBand", availability: "medium",
    carbon_note: "stranded_gas+renewable",
  },
  // A100 SXM
  {
    gpu: "A100 SXM 80GB", gpu_count: 1,  pricing_type: "on-demand",
    price_per_hour: 1.65,  region: "us-west-1 (Denver)",
    vcpus: 12, ram_gb: 100, storage_gb: 500, network_gbps: 25,
    availability: "high",
    carbon_note: "stranded_gas+renewable",
  },
  {
    gpu: "A100 SXM 80GB", gpu_count: 8,  pricing_type: "on-demand",
    price_per_hour: 13.20, region: "us-west-1 (Denver)",
    vcpus: 96, ram_gb: 800, storage_gb: 4000, network_gbps: 200,
    interconnect: "InfiniBand", availability: "high",
    carbon_note: "stranded_gas+renewable",
  },
  {
    gpu: "A100 SXM 80GB", gpu_count: 1,  pricing_type: "spot",
    price_per_hour: 1.20,  region: "us-west-1 (Denver)",
    vcpus: 12, ram_gb: 100, storage_gb: 500, network_gbps: 25,
    availability: "medium",
    carbon_note: "stranded_gas+renewable",
  },
  // L40S
  {
    gpu: "L40S 48GB",     gpu_count: 1,  pricing_type: "on-demand",
    price_per_hour: 1.80,  region: "us-west-1 (Denver)",
    vcpus: 12, ram_gb: 100, storage_gb: 500, network_gbps: 25,
    availability: "medium",
    carbon_note: "stranded_gas+renewable",
  },
  {
    gpu: "L40S 48GB",     gpu_count: 8,  pricing_type: "on-demand",
    price_per_hour: 14.40, region: "us-west-1 (Denver)",
    vcpus: 96, ram_gb: 800, storage_gb: 4000, network_gbps: 100,
    availability: "medium",
    carbon_note: "stranded_gas+renewable",
  },
  // AMD MI300X (expanding capacity 2026)
  {
    gpu: "AMD MI300X 192GB", gpu_count: 8, pricing_type: "on-demand",
    price_per_hour: 36.00, region: "us-west-1 (Denver)",
    vcpus: 192, ram_gb: 2048, storage_gb: 8000, network_gbps: 800,
    interconnect: "RDMA", availability: "low",
    carbon_note: "stranded_gas+renewable",
  },
  // B200 (Blackwell — enterprise/reserved, limited on-demand)
  {
    gpu: "B200 SXM 192GB", gpu_count: 8, pricing_type: "on-demand",
    price_per_hour: 48.00, region: "us-west-1 (Denver)",
    vcpus: 256, ram_gb: 2048, storage_gb: 16000, network_gbps: 1600,
    interconnect: "NVLink+InfiniBand", availability: "low",
    carbon_note: "stranded_gas+renewable",
  },
];

export async function scrapeCrusoe(): Promise<ScraperResult> {
  const start = Date.now();
  try {
    const fetchedAt = new Date().toISOString();

    // Attempt live API if key available
    if (process.env.CRUSOE_API_KEY) {
      try {
        const { data } = await axios.get(`${CRUSOE_API}/compute/vms/types`, {
          headers: {
            Authorization: `Bearer ${process.env.CRUSOE_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 12000,
        });

        if (data?.items?.length > 0) {
          console.log(`[Crusoe] Got ${data.items.length} live VM types from API`);
          const live: GpuListing[] = data.items
            .filter((t: Record<string, unknown>) => {
              const name = String(t.name ?? "");
              return name.includes("gpu") || name.includes("a100") || name.includes("h100");
            })
            .map((t: Record<string, unknown>) => ({
              provider: "Crusoe",
              provider_slug: "crusoe",
              gpu_model: (t.gpu_model as string) ?? "H100 SXM 80GB",
              gpu_count: (t.gpu_count as number) ?? 1,
              pricing_type: "on-demand" as const,
              price_per_hour: parseFloat(String(t.price_per_hour ?? 0)),
              region: (t.location as string) ?? "us-west-1 (Denver)",
              availability: "high" as const,
              vcpus: (t.cpu_count as number) ?? 0,
              ram_gb: parseFloat(String((t.memory_mib as number ?? 0) / 1024)),
              raw_data: { vm_type: t.name, source: "crusoe_api" },
              fetched_at: fetchedAt,
            }))
            .filter((l: GpuListing) => l.price_per_hour > 0);

          if (live.length > 0) {
            return { provider: "Crusoe", listings: live, success: true, duration_ms: Date.now() - start };
          }
        }
      } catch {
        console.log("[Crusoe] API request failed, using published pricing");
      }
    }

    // Use published pricing with carbon metadata
    const listings: GpuListing[] = CRUSOE_PRICING.map((item) => ({
      provider: "Crusoe",
      provider_slug: "crusoe",
      gpu_model: item.gpu,
      gpu_count: item.gpu_count,
      pricing_type: item.pricing_type,
      price_per_hour: item.price_per_hour,
      region: item.region,
      availability: item.availability,
      vcpus: item.vcpus,
      ram_gb: item.ram_gb,
      storage_gb: item.storage_gb,
      network_gbps: item.network_gbps,
      interconnect: item.interconnect,
      raw_data: {
        source: "crusoe_published_pricing",
        energy_source: item.carbon_note ?? "stranded_gas+renewable",
        // Carbon footprint is tracked separately in energy table
        sustainability_notes: "Powered by stranded natural gas and renewables. No flaring.",
      },
      fetched_at: fetchedAt,
    }));

    console.log(`[Crusoe] Loaded ${listings.length} listings`);
    return { provider: "Crusoe", listings, success: true, duration_ms: Date.now() - start };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[Crusoe] Error: ${error}`);
    return { provider: "Crusoe", listings: [], success: false, error, duration_ms: Date.now() - start };
  }
}
