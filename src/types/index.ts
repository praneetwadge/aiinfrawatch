// ─── GPU / Compute ────────────────────────────────────────────────────────────

export type GpuModel =
  | "H100 SXM5 80GB"
  | "H100 SXM 80GB"
  | "H100 NVL 80GB"
  | "H100 PCIe 80GB"
  | "A100 SXM 80GB"
  | "A100 PCIe 80GB"
  | "A100 SXM 40GB"
  | "L40S 48GB"
  | "L40 48GB"
  | "A10G 24GB"
  | "RTX 4090 24GB"
  | "RTX 3090 24GB"
  | string;

export type PricingType = "spot" | "on-demand" | "reserved-1yr" | "reserved-3yr";
export type Availability = "high" | "medium" | "low" | "unavailable";

export interface GpuListing {
  id?: string;
  provider: string;           // e.g. "CoreWeave", "vast.ai"
  provider_slug: string;      // e.g. "coreweave", "vastai"
  gpu_model: GpuModel;
  gpu_count: number;
  pricing_type: PricingType;
  price_per_hour: number;     // USD
  region: string;             // e.g. "us-east-1", "EU-North"
  availability: Availability;
  vcpus?: number;
  ram_gb?: number;
  storage_gb?: number;
  network_gbps?: number;
  interconnect?: string;      // e.g. "NVLink", "InfiniBand"
  raw_data?: Record<string, unknown>;
  fetched_at: string;         // ISO timestamp
  price_change_24h?: number;  // percentage
}

// ─── Energy ───────────────────────────────────────────────────────────────────

export interface EnergyPrice {
  id?: string;
  region: string;
  grid_operator: string;      // e.g. "CAISO", "PJM", "ERCOT"
  price_per_kwh: number;      // USD
  carbon_intensity_gco2_kwh: number;
  renewable_pct: number;
  timestamp: string;
  source: string;
}

// ─── Latency ──────────────────────────────────────────────────────────────────

export interface LatencyBenchmark {
  id?: string;
  provider: string;
  provider_slug: string;
  region: string;
  latency_p50_ms: number;
  latency_p99_ms: number;
  bandwidth_gbps: number;
  tested_from: string;        // e.g. "us-west"
  tested_at: string;
}

// ─── Providers ────────────────────────────────────────────────────────────────

export interface Provider {
  slug: string;
  name: string;
  type: "hyperscaler" | "cloud-native" | "marketplace" | "bare-metal";
  website: string;
  api_available: boolean;
  logo_url?: string;
  description: string;
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  meta: {
    fetched_at: string;
    count: number;
    cache_ttl_seconds: number;
    source: "live" | "cached" | "seed";
  };
}

export interface MarketSummary {
  h100_spot_avg: number;
  h100_spot_change_24h: number;
  a100_spot_avg: number;
  a100_spot_change_24h: number;
  cheapest_h100: GpuListing | null;
  cheapest_a100: GpuListing | null;
  active_providers: number;
  total_listings: number;
  energy_cheapest_region: string;
  energy_cheapest_price: number;
  latency_best_provider: string;
  latency_best_ms: number;
  last_updated: string;
}

// ─── Scraper ──────────────────────────────────────────────────────────────────

export interface ScraperResult {
  provider: string;
  listings: GpuListing[];
  success: boolean;
  error?: string;
  duration_ms: number;
}
