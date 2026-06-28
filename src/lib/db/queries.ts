// @ts-nocheck
import { supabaseAdmin } from "./supabase";
import type { GpuListing, EnergyPrice, LatencyBenchmark, MarketSummary } from "@/types";

// DC-class GPU keywords — must appear in gpu_model for priority fetch
const DC_KEYWORDS = ["H100", "H200", "A100", "L40S", "L40", "A10G", "A10", "A30", "A40", "B200", "MI300"];

export async function getLatestGpuListings(opts?: {
  gpu_model?: string;
  provider?: string;
  pricing_type?: string;
  limit?: number;
}): Promise<GpuListing[]> {
  const cutoff = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  const totalLimit = opts?.limit ?? 2000;

  // If a specific gpu_model or provider filter is set, run a plain filtered query
  if (opts?.gpu_model || opts?.provider) {
    let query = supabaseAdmin
      .from("gpu_listings")
      .select("*")
      .gte("fetched_at", cutoff)
      .order("price_per_hour", { ascending: true })
      .limit(totalLimit);

    if (opts?.gpu_model)     query = query.ilike("gpu_model", `%${opts.gpu_model}%`);
    if (opts?.provider)      query = query.eq("provider", opts.provider);
    if (opts?.pricing_type)  query = query.eq("pricing_type", opts.pricing_type);

    const { data, error } = await query;
    if (error) throw error;
    return (data as GpuListing[]) ?? [];
  }

  // Dual-priority fetch: DC-class GPUs first (60% of limit), then everything else (40%)
  // Prevents price-ascending sort + row limit from cutting off H100/A100 listings
  const dcLimit      = Math.ceil(totalLimit * 0.6);
  const consumerLimit = totalLimit - dcLimit;

  // Build OR filter for DC keywords
  const dcFilter = DC_KEYWORDS.map(k => `gpu_model.ilike.%${k}%`).join(",");

  const [dcRes, consumerRes] = await Promise.all([
    supabaseAdmin
      .from("gpu_listings")
      .select("*")
      .gte("fetched_at", cutoff)
      .or(dcFilter)
      .order("price_per_hour", { ascending: true })
      .limit(dcLimit),
    supabaseAdmin
      .from("gpu_listings")
      .select("*")
      .gte("fetched_at", cutoff)
      .not("gpu_model", "ilike", `%H100%`)
      .not("gpu_model", "ilike", `%H200%`)
      .not("gpu_model", "ilike", `%A100%`)
      .not("gpu_model", "ilike", `%L40S%`)
      .not("gpu_model", "ilike", `%B200%`)
      .not("gpu_model", "ilike", `%MI300%`)
      .order("price_per_hour", { ascending: true })
      .limit(consumerLimit),
  ]);

  if (dcRes.error)       throw dcRes.error;
  if (consumerRes.error) throw consumerRes.error;

  // Merge, deduplicate by id, sort by price
  const seen = new Set<string>();
  const merged: GpuListing[] = [];
  for (const row of [...(dcRes.data ?? []), ...(consumerRes.data ?? [])]) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      merged.push(row as GpuListing);
    }
  }

  if (opts?.pricing_type) {
    return merged.filter(l => l.pricing_type === opts.pricing_type)
      .sort((a, b) => a.price_per_hour - b.price_per_hour);
  }

  return merged.sort((a, b) => a.price_per_hour - b.price_per_hour);
}

// ── Validation gate ──────────────────────────────────────────────────────────
// A single bad scraper run can poison the market floor (NaN prices, a decimal
// shift turning $7.35 into $0.0735, an empty provider string). With
// ignoreBuildErrors + @ts-nocheck across lib, nothing else catches this — so we
// validate here, drop bad rows, and LOG every rejection so a broken scrape is
// visible instead of silently corrupting the floor.
//
// Bounds are deliberately wide: the goal is to catch garbage, not to second-guess
// real market prices. Anything genuinely priced outside these is almost certainly
// a parse error, not a real listing.
const PRICE_MIN = 0.01;     // below this is a parse/decimal-shift artifact
const PRICE_MAX = 1000;     // per-hour, even a 8x B200 reserved node is < this
const COUNT_MAX = 100000;

export interface UpsertReport {
  attempted: number;
  inserted: number;
  rejected: number;
  rejections: { reason: string; sample: Partial<GpuListing> }[];
}

function validateListing(l: GpuListing): string | null {
  if (!l) return "null row";
  if (!l.provider_slug && !l.provider) return "missing provider";
  if (!l.gpu_model || typeof l.gpu_model !== "string") return "missing gpu_model";
  const p = Number(l.price_per_hour);
  if (!Number.isFinite(p)) return "non-numeric price";
  if (p < PRICE_MIN) return `price below floor (${p}) — likely decimal-shift error`;
  if (p > PRICE_MAX) return `price above ceiling (${p}) — likely parse error`;
  const c = Number(l.gpu_count);
  if (l.gpu_count != null && (!Number.isFinite(c) || c < 1 || c > COUNT_MAX)) return `implausible gpu_count (${l.gpu_count})`;
  if (!l.fetched_at) return "missing fetched_at";
  return null;
}

export async function upsertGpuListings(listings: GpuListing[]): Promise<UpsertReport> {
  const report: UpsertReport = { attempted: listings?.length ?? 0, inserted: 0, rejected: 0, rejections: [] };
  if (!listings?.length) return report;

  const clean: GpuListing[] = [];
  for (const l of listings) {
    const reason = validateListing(l);
    if (reason) {
      report.rejected++;
      // Cap stored samples so a fully-broken scrape doesn't balloon the log.
      if (report.rejections.length < 25) {
        report.rejections.push({ reason, sample: { provider: l?.provider, gpu_model: l?.gpu_model, price_per_hour: l?.price_per_hour, pricing_type: l?.pricing_type } });
      }
      continue;
    }
    clean.push(l);
  }

  if (report.rejected > 0) {
    console.warn(`[upsertGpuListings] Rejected ${report.rejected}/${report.attempted} listings as invalid:`);
    console.table(report.rejections);
  }

  // Safety brake: if a scrape that normally returns plenty comes back almost
  // entirely invalid, do NOT write — a near-empty/garbage write can empty the
  // floor for the whole 25h window. Surface it loudly instead.
  if (report.attempted >= 20 && clean.length < report.attempted * 0.25) {
    console.error(`[upsertGpuListings] ABORT: only ${clean.length}/${report.attempted} rows valid (<25%). Refusing to write a likely-corrupt batch.`);
    return report;
  }

  if (!clean.length) return report;

  const { error } = await supabaseAdmin.from("gpu_listings").insert(
    clean.map((l) => ({
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
  report.inserted = clean.length;
  return report;
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
  return (data as LatencyBenchmark[]) ?? [];
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
