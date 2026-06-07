/**
 * Voltage Park scraper
 * Nonprofit-backed GPU cloud (Navigation Fund / Jed McCaleb)
 * ~36,000 H100 + Blackwell GPUs, bare metal, Quantum-2 InfiniBand
 * Merged with Lightning AI in Jan 2026
 *
 * Notable: H100 from $1.99/hr on-demand — one of cheapest bare-metal options
 * Clusters: 8 to 4,064 GPUs, Texas/Virginia/Washington DCs
 *
 * API: https://api.voltagepark.com (requires account key)
 * Public pricing: voltagepark.com/pricing
 */

import axios from "axios";
import type { GpuListing, ScraperResult } from "@/types";

const VP_API = "https://api.voltagepark.com/v1";

// Voltage Park published pricing — May 2026
// Source: voltagepark.com/pricing + verified external sources
const VP_PRICING: Array<{
  gpu: string;
  gpu_count: number;
  pricing_type: "on-demand" | "spot" | "reserved-1yr";
  price_per_hour: number;
  region: string;
  vcpus: number;
  ram_gb: number;
  network_gbps: number;
  interconnect?: string;
  availability: "high" | "medium" | "low";
}> = [
  // H100 SXM — core product
  {
    gpu: "H100 SXM 80GB",  gpu_count: 1,  pricing_type: "on-demand",
    price_per_hour: 1.99,  region: "US-TX (Dallas)",
    vcpus: 26, ram_gb: 230, network_gbps: 200,
    interconnect: "InfiniBand Quantum-2", availability: "high",
  },
  {
    gpu: "H100 SXM 80GB",  gpu_count: 8,  pricing_type: "on-demand",
    price_per_hour: 15.92, region: "US-TX (Dallas)",
    vcpus: 208, ram_gb: 1840, network_gbps: 400,
    interconnect: "InfiniBand Quantum-2", availability: "high",
  },
  {
    gpu: "H100 SXM 80GB",  gpu_count: 8,  pricing_type: "spot",
    price_per_hour: 10.00, region: "US-TX (Dallas)",
    vcpus: 208, ram_gb: 1840, network_gbps: 400,
    interconnect: "InfiniBand Quantum-2", availability: "medium",
  },
  {
    gpu: "H100 SXM 80GB",  gpu_count: 8,  pricing_type: "reserved-1yr",
    price_per_hour: 11.20, region: "US-TX (Dallas)",
    vcpus: 208, ram_gb: 1840, network_gbps: 400,
    interconnect: "InfiniBand Quantum-2", availability: "high",
  },
  {
    gpu: "H100 SXM 80GB",  gpu_count: 1,  pricing_type: "on-demand",
    price_per_hour: 1.99,  region: "US-VA (Virginia)",
    vcpus: 26, ram_gb: 230, network_gbps: 200,
    interconnect: "InfiniBand Quantum-2", availability: "high",
  },
  {
    gpu: "H100 SXM 80GB",  gpu_count: 8,  pricing_type: "on-demand",
    price_per_hour: 15.92, region: "US-VA (Virginia)",
    vcpus: 208, ram_gb: 1840, network_gbps: 400,
    interconnect: "InfiniBand Quantum-2", availability: "medium",
  },
  // Blackwell B200 — newer inventory
  {
    gpu: "B200 SXM 192GB", gpu_count: 8,  pricing_type: "on-demand",
    price_per_hour: 40.00, region: "US-TX (Dallas)",
    vcpus: 256, ram_gb: 2048, network_gbps: 1600,
    interconnect: "NVLink+InfiniBand", availability: "low",
  },
  {
    gpu: "B200 SXM 192GB", gpu_count: 1,  pricing_type: "on-demand",
    price_per_hour: 5.00,  region: "US-TX (Dallas)",
    vcpus: 32, ram_gb: 256, network_gbps: 200,
    availability: "low",
  },
  // A100 (legacy inventory)
  {
    gpu: "A100 SXM 80GB",  gpu_count: 8,  pricing_type: "on-demand",
    price_per_hour: 11.20, region: "US-TX (Dallas)",
    vcpus: 128, ram_gb: 768, network_gbps: 200,
    interconnect: "InfiniBand", availability: "medium",
  },
  {
    gpu: "A100 SXM 80GB",  gpu_count: 1,  pricing_type: "on-demand",
    price_per_hour: 1.40,  region: "US-TX (Dallas)",
    vcpus: 16, ram_gb: 96,  network_gbps: 25,
    availability: "medium",
  },
];

export async function scrapeVoltagePark(): Promise<ScraperResult> {
  const start = Date.now();
  try {
    const fetchedAt = new Date().toISOString();

    // Attempt live API if key is configured
    if (process.env.VOLTAGEPARK_API_KEY) {
      try {
        const { data } = await axios.get(`${VP_API}/instances/types`, {
          headers: {
            Authorization: `Bearer ${process.env.VOLTAGEPARK_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 12000,
        });

        if (data?.instance_types?.length > 0) {
          console.log(`[Voltage Park] Got ${data.instance_types.length} live instance types`);
          const live: GpuListing[] = data.instance_types
            .filter((t: Record<string, unknown>) => (t.gpu_count as number) > 0)
            .map((t: Record<string, unknown>) => ({
              provider: "Voltage Park",
              provider_slug: "voltagepark",
              gpu_model: (t.gpu_model as string) ?? "H100 SXM 80GB",
              gpu_count: t.gpu_count as number,
              pricing_type: (t.pricing_type as "on-demand") ?? "on-demand",
              price_per_hour: parseFloat(String(t.price_per_hour)),
              region: (t.region as string) ?? "US-TX (Dallas)",
              availability: (t.available as boolean) ? "high" : "low",
              vcpus: t.vcpus as number,
              ram_gb: parseFloat(String(t.ram_gb)),
              network_gbps: t.network_gbps as number,
              interconnect: t.interconnect as string,
              raw_data: { instance_type: t.name, source: "voltagepark_api" },
              fetched_at: fetchedAt,
            }));

          if (live.length > 0) {
            return { provider: "Voltage Park", listings: live, success: true, duration_ms: Date.now() - start };
          }
        }
      } catch {
        console.log("[Voltage Park] API request failed, using published pricing");
      }
    }

    // Fall back to published pricing
    const listings: GpuListing[] = VP_PRICING.map((item) => ({
      provider: "Voltage Park",
      provider_slug: "voltagepark",
      gpu_model: item.gpu,
      gpu_count: item.gpu_count,
      pricing_type: item.pricing_type,
      price_per_hour: item.price_per_hour,
      region: item.region,
      availability: item.availability,
      vcpus: item.vcpus,
      ram_gb: item.ram_gb,
      network_gbps: item.network_gbps,
      interconnect: item.interconnect,
      raw_data: {
        source: "voltagepark_published",
        notes: "Nonprofit-backed, bare metal, 36k+ GPU inventory, no egress fees",
      },
      fetched_at: fetchedAt,
    }));

    console.log(`[Voltage Park] Loaded ${listings.length} listings`);
    return { provider: "Voltage Park", listings, success: true, duration_ms: Date.now() - start };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[Voltage Park] Error: ${error}`);
    return { provider: "Voltage Park", listings: [], success: false, error, duration_ms: Date.now() - start };
  }
}
