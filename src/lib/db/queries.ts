import { supabaseAdmin } from "./supabase";
import type { GpuListing, EnergyPrice, LatencyBenchmark, MarketSummary } from "@/types";

// ─── GPU Listings ─────────────────────────────────────────────────────────────

export async function getLatestGpuListings(opts?: {
  gpu_model?: string;
  provider?: string;
  pricing_type?: string;
  limit?: number;
}): Promise<GpuListing[]> {
  // Get the most recent fetch timestamp, then return all listings from that batch
  const { data: latest } = await supabaseAdmin
    .from("gpu_listings")
    .select("fetched_at")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .single();

  if (!latest) return [];

  // Listings within 10 minutes of the latest fetch
  const cutoff = new Date(new Date(latest.fetched_at).getTime() - 10 * 60 * 1000).toISOString();

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

  // Also write to price history for trend tracking
  await supabaseAdmin.from("price_history").insert(
    listings.map((l) => ({
      provider: l.provider_slug,
      gpu_model: l.gpu_model,
      pricing_type: l.pricing_type,
      region: l.region,
      price_per_hour: l.price_per_hour,
      recorded_at: l.fetched_at,
    }))
  );
}

export async function getPriceHistory(gpu_model: string, hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("price_history")
    .select("provider, gpu_model, price_per_hour, recorded_at")
    .ilike("gpu_model", `%${gpu_model}%`)
    .gte("recorded_at", since)
    .order("recorded_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// ─── Energy ───────────────────────────────────────────────────────────────────

export async function getLatestEnergyPrices(): Promise<EnergyPrice[]> {
  const { data: latest } = await supabaseAdmin
    .from("energy_prices")
    .select("fetched_at")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .single();

  if (!latest) return [];
  const cutoff = new Date(new Date(latest.fetched_at).getTime() - 60 * 60 * 1000).toISOString();

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

// ─── Latency ──────────────────────────────────────────────────────────────────

export async function getLatencyBenchmarks(): Promise<LatencyBenchmark[]> {
  const { data, error } = await supabaseAdmin
    .from("latency_benchmarks")
    .select("*")
    .order("latency_p50_ms", { ascending: true });
  if (error) throw error;
  return (data as LatencyBenchmark[]) ?? [];
}

// ─── Market Summary ───────────────────────────────────────────────────────────

export async function computeMarketSummary(): Promise<MarketSummary> {
  const [listings, energy, latency] = await Promise.all([
    getLatestGpuListings(),
    getLatestEnergyPrices(),
    getLatencyBenchmarks(),
  ]);

  const h100 = listings.filter(
    (l) => l.gpu_model.includes("H100") && l.pricing_type === "spot"
  );
  const a100 = listings.filter(
    (l) => l.gpu_model.includes("A100") && l.pricing_type === "spot"
  );

  const avg = (arr: GpuListing[]) =>
    arr.length ? arr.reduce((s, l) => s + l.price_per_hour, 0) / arr.length : 0;

  const cheapestH100 = h100.sort((a, b) => a.price_per_hour - b.price_per_hour)[0] ?? null;
  const cheapestA100 = a100.sort((a, b) => a.price_per_hour - b.price_per_hour)[0] ?? null;
  const cheapestEnergy = energy[0] ?? null;
  const bestLatency = latency[0] ?? null;

  const providers = new Set(listings.map((l) => l.provider));

  return {
    h100_spot_avg: parseFloat(avg(h100).toFixed(4)),
    h100_spot_change_24h: 0, // populated by cron from price_history
    a100_spot_avg: parseFloat(avg(a100).toFixed(4)),
    a100_spot_change_24h: 0,
    cheapest_h100: cheapestH100,
    cheapest_a100: cheapestA100,
    active_providers: providers.size,
    total_listings: listings.length,
    energy_cheapest_region: cheapestEnergy?.region ?? "N/A",
    energy_cheapest_price: cheapestEnergy?.price_per_kwh ?? 0,
    latency_best_provider: bestLatency?.provider ?? "N/A",
    latency_best_ms: bestLatency?.latency_p50_ms ?? 0,
    last_updated: new Date().toISOString(),
  };
}
