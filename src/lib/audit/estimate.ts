// @ts-nocheck
// AIInfraWatch — instant cost-audit estimator
// Pure TS, no deps. Used by the ungated in-browser estimate on /cost-audit
// and to seed savings-anchored pricing on /pricing.
//
// Philosophy: this runs BEFORE any email gate. Its only job is to turn a
// pasted bill / quote / plain-English setup into a believable, workload-aware
// "you're likely overpaying by ~$X/mo" moment. It is deliberately conservative
// and always shows its assumptions. The precise migration plan is what's gated.

export type GpuModel = "H100" | "A100" | "L40S" | "A10G" | "B200";

export type ProviderClass = "hyperscaler" | "neocloud" | "marketplace" | "unknown";

// Market reference floors (reliable = availability "high"). Mirrors the live
// index; the client hydrates these from /api/gpu-prices at runtime when the
// shape matches, and falls back to these so the estimate never renders empty.
export const MARKET_FLOORS: Record<GpuModel, { observed: number; reliable: number }> = {
  H100: { observed: 1.49, reliable: 1.99 },
  A100: { observed: 0.73, reliable: 0.73 },
  L40S: { observed: 0.47, reliable: 0.79 },
  A10G: { observed: 0.6, reliable: 0.6 },
  B200: { observed: 3.49, reliable: 4.99 },
};

// Observed average premium hyperscalers carry over specialist clouds for the
// same GPU class (live index shows ~2.4x on H100). Used only when we can see
// the current provider is a hyperscaler.
export const HYPERSCALER_MULTIPLE = 2.4;

const HOURS_PER_MONTH = 730; // 24/7. Most production assumptions live here.

const HYPERSCALERS = ["aws", "amazon", "azure", "microsoft", "gcp", "google", "oracle", "oci", "ibm"];
const NEOCLOUDS = ["coreweave", "lambda", "nebius", "crusoe", "fluidstack", "voltagepark", "gmi", "paperspace"];
const MARKETPLACES = ["runpod", "vast", "vastai", "tensordock", "salad"];

export type ParsedSetup = {
  gpu: GpuModel | null;
  count: number | null;
  hoursPerMonth: number | null;
  currentRate: number | null; // $/hr if stated
  currentMonthly: number | null; // $/mo if stated directly
  providerClass: ProviderClass;
  providerName: string | null;
  alwaysOn: boolean;
};

export function parseSetup(raw: string): ParsedSetup {
  const text = (raw || "").toLowerCase();

  // GPU model
  let gpu: GpuModel | null = null;
  if (/\bh100\b/.test(text)) gpu = "H100";
  else if (/\bb200\b/.test(text)) gpu = "B200";
  else if (/\ba100\b/.test(text)) gpu = "A100";
  else if (/\bl40s?\b/.test(text)) gpu = "L40S";
  else if (/\ba10g?\b/.test(text)) gpu = "A10G";

  // Provider
  let providerName: string | null = null;
  let providerClass: ProviderClass = "unknown";
  for (const p of HYPERSCALERS) if (text.includes(p)) { providerName = p; providerClass = "hyperscaler"; break; }
  if (providerClass === "unknown") for (const p of NEOCLOUDS) if (text.includes(p)) { providerName = p; providerClass = "neocloud"; break; }
  if (providerClass === "unknown") for (const p of MARKETPLACES) if (text.includes(p)) { providerName = p; providerClass = "marketplace"; break; }

  // GPU count: "8x", "8 gpus", "8 cards", "x8"
  let count: number | null = null;
  const countMatch =
    text.match(/(\d{1,4})\s*(?:x|×)\s*(?:h100|a100|l40s?|a10g?|b200|gpus?|cards?)/) ||
    text.match(/(?:x|×)\s*(\d{1,4})\b/) ||
    text.match(/(\d{1,4})\s*(?:gpus?|cards?|instances?|nodes?)\b/);
  if (countMatch) count = clampInt(parseInt(countMatch[1], 10), 1, 100000);

  // $/hr
  let currentRate: number | null = null;
  const rateMatch = text.match(/\$?\s*(\d+(?:\.\d+)?)\s*(?:\/|per\s*)?\s*(?:hr|hour|hourly)\b/);
  if (rateMatch) currentRate = clampNum(parseFloat(rateMatch[1]), 0.01, 1000);

  // $/mo stated directly
  let currentMonthly: number | null = null;
  const moMatch = text.match(/\$?\s*([\d,]{2,})\s*(?:\/|per\s*)?\s*(?:mo|month|monthly|\/mo)\b/);
  if (moMatch) currentMonthly = clampNum(parseFloat(moMatch[1].replace(/,/g, "")), 1, 1e9);

  // Utilization signals
  const alwaysOn = /24\/?7|always[-\s]?on|around the clock|production serving|always running/.test(text);
  let hoursPerMonth: number | null = null;
  const hrsMatch = text.match(/(\d{1,4})\s*(?:hrs?|hours)\s*(?:\/|per\s*)?\s*(?:mo|month)\b/);
  if (hrsMatch) hoursPerMonth = clampInt(parseInt(hrsMatch[1], 10), 1, HOURS_PER_MONTH);
  else if (alwaysOn) hoursPerMonth = HOURS_PER_MONTH;

  return { gpu, count, hoursPerMonth, currentRate, currentMonthly, providerClass, providerName, alwaysOn };
}

export type Estimate = {
  ok: boolean;
  reason?: string;
  gpu: GpuModel;
  count: number;
  hoursPerMonth: number;
  assumedHours: boolean;
  assumedCount: boolean;
  currentMonthly: number;
  currentRateEff: number; // effective $/hr we're comparing against
  floorReliable: number;
  bestReliableMonthly: number;
  overpayMonthly: number;
  overpayPct: number; // 0..1
  overpayYearly: number;
  hyperscalerPremiumMonthly: number | null; // portion attributable to hyperscaler markup
  providerClass: ProviderClass;
  confidence: "high" | "medium" | "low";
};

// Build an estimate from a parsed setup plus optional manual overrides.
export function estimate(
  input: Partial<ParsedSetup> & { gpu?: GpuModel | null }
): Estimate {
  const gpu = (input.gpu as GpuModel) || null;
  if (!gpu) {
    return fail("Tell us the GPU (H100, A100, L40S, A10G, or B200) so we can compare against market.");
  }

  const floor = MARKET_FLOORS[gpu];
  const assumedCount = input.count == null;
  const count = input.count ?? 1;
  const assumedHours = input.hoursPerMonth == null;
  const hoursPerMonth = input.hoursPerMonth ?? HOURS_PER_MONTH;

  // Establish current monthly spend and an effective current $/hr.
  let currentMonthly: number;
  let currentRateEff: number;

  if (input.currentMonthly != null) {
    currentMonthly = input.currentMonthly;
    currentRateEff = currentMonthly / (count * hoursPerMonth);
  } else if (input.currentRate != null) {
    currentRateEff = input.currentRate;
    currentMonthly = currentRateEff * count * hoursPerMonth;
  } else if (input.providerClass === "hyperscaler") {
    // No price given but we know it's a hyperscaler: infer from specialist
    // floor x observed hyperscaler multiple. Lower confidence.
    currentRateEff = floor.reliable * HYPERSCALER_MULTIPLE;
    currentMonthly = currentRateEff * count * hoursPerMonth;
  } else {
    return fail("Add either a $/hr rate, a monthly figure, or your provider so we can anchor your current spend.");
  }

  const floorReliable = floor.reliable;
  const bestReliableMonthly = floorReliable * count * hoursPerMonth;
  const overpayMonthly = Math.max(0, currentMonthly - bestReliableMonthly);
  const overpayPct = currentMonthly > 0 ? overpayMonthly / currentMonthly : 0;

  let hyperscalerPremiumMonthly: number | null = null;
  if (input.providerClass === "hyperscaler") {
    const specialistEquivMonthly = (currentRateEff / HYPERSCALER_MULTIPLE) * count * hoursPerMonth;
    hyperscalerPremiumMonthly = Math.max(0, currentMonthly - specialistEquivMonthly);
  }

  // Confidence: high if they gave us real numbers; medium if we assumed
  // hours/count; low if we inferred the rate from provider class alone.
  let confidence: Estimate["confidence"] = "high";
  if (input.currentMonthly == null && input.currentRate == null) confidence = "low";
  else if (assumedHours || assumedCount) confidence = "medium";

  return {
    ok: true,
    gpu,
    count,
    hoursPerMonth,
    assumedHours,
    assumedCount,
    currentMonthly,
    currentRateEff,
    floorReliable,
    bestReliableMonthly,
    overpayMonthly,
    overpayPct,
    overpayYearly: overpayMonthly * 12,
    hyperscalerPremiumMonthly,
    providerClass: (input.providerClass as ProviderClass) || "unknown",
    confidence,
  };
}

export function estimateFromPaste(raw: string): Estimate {
  const parsed = parseSetup(raw);
  return estimate(parsed);
}

// Apply live floors fetched from /api/gpu-prices if the shape is recognizable.
// Defensive: silently keeps defaults on any mismatch.
export function applyLiveFloors(json: any): void {
  try {
    const rows = Array.isArray(json) ? json : json?.data || json?.listings || json?.prices;
    if (!Array.isArray(rows)) return;
    const best: Partial<Record<GpuModel, number>> = {};
    for (const r of rows) {
      const model = normalizeModel(r.gpu || r.model || r.name || "");
      if (!model) continue;
      const reliable =
        r.reliable ?? r.reliable_price ?? (String(r.availability).toLowerCase() === "high" ? r.price ?? r.usd_hr : null);
      const price = Number(reliable);
      if (!isFinite(price) || price <= 0) continue;
      if (best[model] == null || price < (best[model] as number)) best[model] = price;
    }
    (Object.keys(best) as GpuModel[]).forEach((m) => {
      if (best[m] != null) MARKET_FLOORS[m] = { observed: MARKET_FLOORS[m].observed, reliable: best[m] as number };
    });
  } catch {
    /* keep defaults */
  }
}

function normalizeModel(s: string): GpuModel | null {
  const t = String(s).toLowerCase();
  if (t.includes("h100")) return "H100";
  if (t.includes("b200")) return "B200";
  if (t.includes("a100")) return "A100";
  if (t.includes("l40")) return "L40S";
  if (t.includes("a10g") || t.includes("a10 ")) return "A10G";
  return null;
}

export function money(n: number): string {
  if (!isFinite(n)) return "$0";
  if (n >= 1000) return "$" + Math.round(n).toLocaleString("en-US");
  return "$" + n.toFixed(2);
}

export function pct(n: number): string {
  return Math.round(n * 100) + "%";
}

function fail(reason: string): Estimate {
  return {
    ok: false, reason, gpu: "H100", count: 0, hoursPerMonth: 0, assumedHours: false, assumedCount: false,
    currentMonthly: 0, currentRateEff: 0, floorReliable: 0, bestReliableMonthly: 0, overpayMonthly: 0,
    overpayPct: 0, overpayYearly: 0, hyperscalerPremiumMonthly: null, providerClass: "unknown", confidence: "low",
  };
}

function clampNum(n: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, n)); }
function clampInt(n: number, lo: number, hi: number) { return Math.round(clampNum(n, lo, hi)); }
