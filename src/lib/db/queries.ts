// @ts-nocheck
import { supabaseAdmin } from "./supabase";
import type { GpuListing, EnergyPrice, LatencyBenchmark, MarketSummary } from "@/types";

export async function getLatestGpuListings(opts?: {
  gpu_model?: string;
  provider?: string;
  pricing_type?: string;
  limit?: number;
}): Promise<GpuListing[]> {
  // Return listings fetched in the last 25 hours from any provider
  const cutoff = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

  let query = supabaseAdmin
    .from("gpu_listings")
    .select("*")
    .gte("fetched_at", cutoff)
    .order("price_per_hour", { ascending: true });

  if (opts?.gpu_model) query = query.ilike("gpu_model", `%${opts.gpu_model}%`);
  if (opts?.provider) query = query.eq("provider", opts.provider);
  if (opts?.pricing_type) query = query.eq("pricing_type", opts.pricing_type);
  if (opts?.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) throw error;
  return (data as GpuListing[]) ?? [];
}

export async function upsertGpuListings(listings: GpuListing[]): Promise<void> {
  if (!listings.length) return;

  const { error } = await supabaseAdmin.from("gpu_listings").insert(
    listings.map((l) => ({
      provider: l.provider_slug,
      gpu_model: l.gpu_model,
      gpu_count: l.gpu_count,
      pricing_type: l.pricing_type,
      price_per_hour: l.price_per_hour,
      region: l.region,
      availability: l.availability,
      vcpus: l.vcpus,
      ram_gb: l.ram_gb,
      storage_gb: l.storage_gb,
      network_gbps: l.network_gbps,
      interconnect: l.interconnect,
      raw_data: l.raw_data,
      fetched_at: l.fetched_at,
    }))
  );
  if (error) throw error;
}

export async function getLatestEnergyPrices(): Promise<EnergyPrice[]> {
  const cutoff = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("energy_prices")
    .select("*")
    .gte("fetched_at", cutoff)
    .order("price_per_kwh", { ascending: true });
  if (error) throw error;
  return (data as EnergyPrice[]) ?? [];
}

export async function upsertEnergyPrices(prices: EnergyPrice[]): Promise<void> {
  if (!prices.length) return;
  const { error } = await supabaseAdmin.from("energy_prices").insert(prices);
  if (error) throw error;
}

export async function getLatencyBenchmarks(): Promise<LatencyBenchmark[]> {
  const { data, error } = await supabaseAdmin
    .from("latency_benchmarks")
    .select("*")
    .order("latency_p50_ms", { ascending: true });
  if (error) throw error;
  return (data as LatencyBenchmark[]) ?? [];\
}

export async function computeMarketSummary(): Promise<MarketSummary> {
  const [listings, energy, latency] = await Promise.all([
    getLatestGpuListings(),
    getLatestEnergyPrices(),
    getLatencyBenchmarks(),
  ]);

  const h100 = listings.filter((l) => l.gpu_model.includes("H100") && l.pricing_type === "spot");
  const a100 = listings.filter((l) => l.gpu_model.includes("A100") && l.pricing_type === "spot");
  const avg = (arr) => arr.length ? arr.reduce((s, l) => s + l.price_per_hour, 0) / arr.length : 0;

  return {
    h100_spot_avg: parseFloat(avg(h100).toFixed(4)),
    h100_spot_change_24h: 0,
    a100_spot_avg: parseFloat(avg(a100).toFixed(4)),
    a100_spot_change_24h: 0,
    cheapest_h100: h100.sort((a, b) => a.price_per_hour - b.price_per_hour)[0] ?? null,
    cheapest_a100: a100.sort((a, b) => a.price_per_hour - b.price_per_hour)[0] ?? null,
    active_providers: new Set(listings.map((l) => l.provider)).size,
    total_listings: listings.length,
    energy_cheapest_region: energy[0]?.region ?? "N/A",
    energy_cheapest_price: energy[0]?.price_per_kwh ?? 0,
    latency_best_provider: latency[0]?.provider ?? "N/A",
    latency_best_ms: latency[0]?.latency_p50_ms ?? 0,
    last_updated: new Date().toISOString(),
  };
}
