// @ts-nocheck
import { HYPERSCALERS, getMeta } from "@/lib/market-helpers";
import type { GpuListing } from "@/lib/market-helpers";

export interface MarketStats {
  activeProviders: number;
  cheapestH100High: GpuListing | undefined;
  h100Prices: number[];
  premiumPct: number | null;
  a100PremiumPct: number | null;
}

export function computeMarketStats(listings: GpuListing[]): MarketStats {
  const activeProviders = new Set(listings.map(l => l.provider)).size;

  const h100Spot = listings.filter(l => l.gpu_model.includes("H100") && l.pricing_type === "spot");
  const h100High = listings.filter(l => l.gpu_model.includes("H100") && l.availability === "high");
  const h100Prices = h100Spot.map(l => l.price_per_hour).sort((a, b) => a - b);
  const cheapestH100High = [...h100High].sort((a, b) => a.price_per_hour - b.price_per_hour)[0];

  const h100Hyper = listings.filter(l => l.gpu_model.includes("H100") && HYPERSCALERS.includes(l.provider.toLowerCase()));
  const h100Spec  = listings.filter(l => l.gpu_model.includes("H100") && !HYPERSCALERS.includes(l.provider.toLowerCase()));
  const hyperAvg  = h100Hyper.length ? h100Hyper.reduce((s, l) => s + l.price_per_hour, 0) / h100Hyper.length : 0;
  const specAvg   = h100Spec.length  ? h100Spec.reduce((s, l)  => s + l.price_per_hour, 0) / h100Spec.length  : 0;
  const premiumPct = specAvg > 0 && hyperAvg > 0 ? ((hyperAvg / specAvg - 1) * 100) : null;

  const a100Hyper = listings.filter(l => l.gpu_model.includes("A100") && HYPERSCALERS.includes(l.provider.toLowerCase()));
  const a100Spec  = listings.filter(l => l.gpu_model.includes("A100") && !HYPERSCALERS.includes(l.provider.toLowerCase()));
  const a100HyperAvg = a100Hyper.length ? a100Hyper.reduce((s, l) => s + l.price_per_hour, 0) / a100Hyper.length : 0;
  const a100SpecAvg  = a100Spec.length  ? a100Spec.reduce((s, l)  => s + l.price_per_hour, 0) / a100Spec.length  : 0;
  const a100PremiumPct = a100SpecAvg > 0 && a100HyperAvg > 0 ? ((a100HyperAvg / a100SpecAvg - 1) * 100) : null;

  return { activeProviders, cheapestH100High, h100Prices, premiumPct, a100PremiumPct };
}

// ── Demo scenario ────────────────────────────────────────────────────────────
// Derives a landing-page demo example strictly from MarketStats — never a new
// computation, never a hand-picked provider. Reuses the SAME floor price and
// SAME hyperscaler premium % already shown in the ticker and AuditStatStrip,
// so the demo card can't numerically disagree with anything else on the page.
// Returns null if there's no positive premium to show right now (e.g. an H100
// data gap) — silent is better than a fabricated number.
export interface DemoExample {
  gpuCount: number;
  hoursPerMonth: number;
  floorRatePerHour: number;
  floorProviderShort: string;
  hyperscalerRatePerHour: number;
  currentMonthly: number;
  recommendedMonthly: number;
  annualSavings: number;
  savingsPct: number;
}

export function computeDemoExample(
  stats: MarketStats, gpuCount = 8, hoursPerMonth = 720,
): DemoExample | null {
  const floorListing = stats.cheapestH100High;
  const floorRate = floorListing ? floorListing.price_per_hour : (stats.h100Prices[0] ?? null);
  if (floorRate == null || stats.premiumPct == null || stats.premiumPct <= 0) return null;

  const hyperscalerRatePerHour = floorRate * (1 + stats.premiumPct / 100);
  const recommendedMonthly = floorRate * gpuCount * hoursPerMonth;
  const currentMonthly = hyperscalerRatePerHour * gpuCount * hoursPerMonth;
  const savings = currentMonthly - recommendedMonthly;
  if (savings <= 0) return null;

  return {
    gpuCount, hoursPerMonth,
    floorRatePerHour: floorRate,
    floorProviderShort: floorListing ? getMeta(floorListing.provider).short : "specialist cloud",
    hyperscalerRatePerHour,
    currentMonthly, recommendedMonthly,
    annualSavings: savings * 12,
    savingsPct: Math.round((savings / currentMonthly) * 100),
  };
}
