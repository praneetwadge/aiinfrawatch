"use client";

import React, { useMemo, useState } from "react";
import {
  GpuListing, HYPERSCALERS, fmtMoney, fmtP, getMeta,
} from "@/lib/market-helpers";

const MONO:  React.CSSProperties = { fontFamily: "var(--font-mono)" };
const SANS:  React.CSSProperties = { fontFamily: "var(--font-sans)" };
const SERIF: React.CSSProperties = { fontFamily: "var(--font-serif)" };

type Situation    = "hyperscaler" | "neocloud" | "marketplace" | "unsure";
type WorkloadType = "inference" | "batch" | "evals" | "finetuning" | "training" | "dev" | "unsure";
type GpuFamily    = "H100" | "A100" | "L40S" | "A10G" | "other";
type InputTab     = "describe" | "bill" | "diagram" | "manual";

const WORKLOAD_OPTIONS: { value: WorkloadType; label: string; batchFriendly: boolean }[] = [
  { value: "inference",  label: "Real-time inference",  batchFriendly: false },
  { value: "batch",      label: "Batch inference",      batchFriendly: true  },
  { value: "evals",      label: "Evals / benchmarking", batchFriendly: true  },
  { value: "finetuning", label: "Fine-tuning",          batchFriendly: true  },
  { value: "training",   label: "Training",             batchFriendly: false },
  { value: "dev",        label: "Dev notebooks",        batchFriendly: true  },
  { value: "unsure",     label: "Not sure",             batchFriendly: false },
];

const SETUP_OPTIONS: { value: Situation; label: string }[] = [
  { value: "hyperscaler", label: "AWS / GCP / Azure" },
  { value: "neocloud",    label: "CoreWeave / Lambda / Nebius" },
  { value: "marketplace", label: "RunPod / Vast.ai" },
  { value: "unsure",      label: "Mixed / not sure" },
];

interface AuditToolProps { listings: GpuListing[]; }

const parseNum = (v: string, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

interface ParsedStack {
  family: GpuFamily | null;
  gpuCount: number | null;
  hours: number | null;
  situation: Situation | null;
  workload: WorkloadType | null;
  matchedTerms: string[];
}

function parseStackText(text: string): ParsedStack {
  const t = text.toLowerCase();
  const matched: string[] = [];

  let family: GpuFamily | null = null;
  const familyPatterns: [RegExp, GpuFamily][] = [
    [/\bh100\b/, "H100"], [/\ba100\b/, "A100"],
    [/\bl40s?\b/, "L40S"], [/\ba10g?\b/, "A10G"],
  ];
  for (const [re, fam] of familyPatterns) {
    if (re.test(t)) { family = fam; matched.push(fam); break; }
  }

  let gpuCount: number | null = null;
  const countMatch = t.match(/(\d+)\s*[x×]\s*(?:h100|a100|l40s?|a10g?|gpu)/)
    ?? t.match(/(\d+)\s+(?:h100|a100|l40s?|a10g?)s?\b/);
  if (countMatch) {
    const n = parseInt(countMatch[1], 10);
    if (n > 0 && n <= 10000) { gpuCount = n; matched.push(`${n}×`); }
  }

  let hours: number | null = null;
  const hoursMatch = t.match(/(\d+)\s*(?:-\s*\d+\s*)?\s*(?:hours?|hrs?)(?:\s*\/\s*month|\s*per\s*month|\/mo)?/);
  if (hoursMatch) {
    const n = parseInt(hoursMatch[1], 10);
    if (n > 0 && n <= 8760) { hours = n; matched.push(`${n}h/mo`); }
  }

  let situation: Situation | null = null;
  if (/\b(aws|amazon web services|gcp|google cloud|azure|microsoft azure)\b/.test(t)) {
    situation = "hyperscaler"; matched.push("hyperscaler");
  } else if (/\b(coreweave|lambda|lambda labs|nebius)\b/.test(t)) {
    situation = "neocloud"; matched.push("neocloud");
  } else if (/\b(runpod|vast\.?ai|vastai)\b/.test(t)) {
    situation = "marketplace"; matched.push("marketplace");
  }

  let workload: WorkloadType | null = null;
  if (/\b(real-?time|production serving|inference serving|live inference)\b/.test(t)) {
    workload = "inference"; matched.push("real-time inference");
  } else if (/\bbatch\b/.test(t)) {
    workload = "batch"; matched.push("batch");
  } else if (/\b(eval|evals|benchmark)/.test(t)) {
    workload = "evals"; matched.push("evals");
  } else if (/\bfine-?tun/.test(t)) {
    workload = "finetuning"; matched.push("fine-tuning");
  } else if (/\btraining\b/.test(t)) {
    workload = "training"; matched.push("training");
  } else if (/\b(notebook|dev|development)\b/.test(t)) {
    workload = "dev"; matched.push("dev");
  }

  return { family, gpuCount, hours, situation, workload, matchedTerms: matched };
}

function capacityConfFromListings(ls: GpuListing[]) {
  if (!ls.length) return 0;
  return Math.round(ls.filter(l => l.availability === "high").length / ls.length * 100);
}

/* ── Manual workload row type ── */
interface WorkloadRow {
  id: number;
  family: GpuFamily;
  gpuCountStr: string;
  hoursStr: string;
  situation: Situation;
  workload: WorkloadType;
}

/* ── Result computation (pure) ── */
interface ComputedResult {
  baseline: GpuListing | null;
  recommendation: GpuListing;
  isReliable: boolean;
  currentMonthly: number | null;
  recommendedMonthly: number;
  savings: number | null;
  savingsPct: number | null;
  annualSavings: number | null;
  currentRatePerHour: number | null;
  floorRatePerHour: number;
  sizingSuspect: boolean;
  gpuCount: number;
  hours: number;
  reliabilityRisk: "Low" | "Medium" | "High";
  isBatchFriendly: boolean;
  workloadLabel: string;
  advice: string;
}

function computeResult(
  listings: GpuListing[], family: GpuFamily, gpuCount: number, hours: number,
  situation: Situation, workload: WorkloadType,
  overrideCurrentMonthly?: number, // pass actual bill spend when available
): ComputedResult | null {
  const familyListings = family === "other"
    ? listings
    : listings.filter(l => l.gpu_model.toUpperCase().includes(family));
  if (!familyListings.length) return null;

  const sorted   = [...familyListings].sort((a, b) => a.price_per_hour - b.price_per_hour);
  const reliable = familyListings.filter(l => l.availability === "high").sort((a, b) => a.price_per_hour - b.price_per_hour);
  const cheapestObserved = sorted[0];
  const cheapestReliable = reliable[0] ?? null;
  const recommendation   = cheapestReliable ?? cheapestObserved;
  const isReliable       = !!cheapestReliable;

  let baseline: GpuListing | null = null;
  if (situation === "hyperscaler" || situation === "unsure") {
    baseline = familyListings.filter(l => HYPERSCALERS.includes(l.provider.toLowerCase()))
      .sort((a, b) => a.price_per_hour - b.price_per_hour)[0] ?? null;
  } else if (situation === "neocloud") {
    baseline = familyListings.filter(l => getMeta(l.provider).cat === "Neocloud")
      .sort((a, b) => a.price_per_hour - b.price_per_hour)[0] ?? null;
  } else if (situation === "marketplace") {
    baseline = familyListings.filter(l => getMeta(l.provider).cat === "Marketplace")
      .sort((a, b) => a.price_per_hour - b.price_per_hour)[0] ?? null;
  }

  // Guards: never divide by zero / multiply by garbage. Bill extraction can return
  // odd values; clamp to sane floors before any arithmetic.
  const safeGpu = gpuCount > 0 ? gpuCount : 1;
  const safeHrs = hours > 0 ? hours : 720;

  // Current spend. Bill path: the actual extracted spend is ground truth.
  // Other paths: derive from the cheapest listing for the stated provider type.
  const currentMonthly = overrideCurrentMonthly != null && overrideCurrentMonthly > 0
    ? overrideCurrentMonthly
    : baseline ? baseline.price_per_hour * safeGpu * safeHrs : null;

  // Recommended spend = the SAME GPU-hours costed at the reliable floor rate.
  // Critically, this is NEVER back-computed from the bill — doing so makes
  // recommended === current and forces savings to zero on every upload.
  const floorRatePerHour  = recommendation.price_per_hour;
  const recommendedMonthly = floorRatePerHour * safeGpu * safeHrs;

  // The customer's effective blended rate — the proof line. monthlySpend is real;
  // dividing by the bill's own GPU-hours gives what they actually pay per GPU-hour.
  const currentRatePerHour = currentMonthly != null && safeGpu > 0 && safeHrs > 0
    ? currentMonthly / (safeGpu * safeHrs)
    : null;

  // Credibility guard: if the implied per-GPU rate is >4× the entire observed market
  // for this family, the bill was almost certainly misread (wrong GPU count/hours).
  // Don't publish a fake "99% savings" — flag it so the UI can ask for confirmation.
  const observedMax = sorted.length ? sorted[sorted.length - 1].price_per_hour : floorRatePerHour;
  const sizingSuspect = currentRatePerHour != null && observedMax > 0 && currentRatePerHour > observedMax * 4;

  const savings    = !sizingSuspect && currentMonthly && currentMonthly > recommendedMonthly ? currentMonthly - recommendedMonthly : null;
  const savingsPct = currentMonthly && savings ? Math.round((savings / currentMonthly) * 100) : null;
  const annualSavings = savings != null ? savings * 12 : null;

  const workloadObj     = WORKLOAD_OPTIONS.find(w => w.value === workload);
  const isBatchFriendly = workloadObj?.batchFriendly ?? false;
  const reliabilityRisk = !isReliable ? "High" : capacityConfFromListings(familyListings) >= 60 ? "Low" : "Medium";

  let advice = "";
  if (sizingSuspect) {
    advice = `We read ${fmtMoney(currentMonthly!)}/mo but the detected ${gpuCount}× ${family === "other" ? "GPU" : family} doesn't square with that spend — likely a managed-service line or a mixed bill. Confirm the GPU count and we'll size the gap precisely in the full audit.`;
  } else if (savingsPct !== null && savingsPct >= 20 && isBatchFriendly) {
    advice = `${workloadObj?.label ?? "This workload"} is interruption-tolerant — it's the fastest line to move. Shift it to ${getMeta(recommendation.provider).short} at ${fmtP(floorRatePerHour)}/hr and keep latency-critical serving where it is. First action of the audit.`;
  } else if (savingsPct !== null && savingsPct >= 10) {
    advice = `The gap is real, but ${!isBatchFriendly ? "this workload is latency- or continuity-sensitive — don't lift-and-shift. " : ""}capture it through reserved pricing and committed-use discounts before re-platforming. The full audit prices the move against your contract terms.`;
  } else if (savingsPct !== null) {
    advice = `You're already at the reliable floor for ${family === "other" ? "GPU" : family}. The remaining win is utilisation, not provider switching — the audit checks idle spend and reservation coverage.`;
  } else if (!baseline) {
    advice = `No ${situation} listings found for ${family === "other" ? "this GPU" : family} in the current snapshot. The full audit surfaces region-specific options outside the daily index.`;
  }

  return {
    baseline, recommendation, isReliable, currentMonthly, recommendedMonthly,
    savings, savingsPct, annualSavings, currentRatePerHour, floorRatePerHour, sizingSuspect,
    gpuCount: safeGpu, hours: safeHrs,
    reliabilityRisk, isBatchFriendly,
    workloadLabel: workloadObj?.label ?? "this workload", advice,
  };
}

/* ── Result display ── */

// Annual numbers get large — give them M/k so the headline reads cleanly.
const fmtBigMoney = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `$${Math.round(n / 1000)}k`
  : `$${Math.round(n)}`;

/* The all-clouds comparison: every provider for the bill's GPU family, sorted
   cheapest→priciest, with the customer's effective rate dropped into the lineup
   and the reliable floor tagged. Same CSS-bar idiom as the homepage spread chart
   — no Recharts. Replaces the old gap bar + position strip. */
function FamilySpreadChart({ listings, family, currentRatePerHour, floorRate, floorProviderShort }: {
  listings: GpuListing[]; family: GpuFamily; currentRatePerHour: number; floorRate: number; floorProviderShort: string;
}) {
  if (family === "other") return null;
  const fam = listings.filter(l => l.gpu_model.toUpperCase().includes(family));
  if (fam.length < 2) return null;

  // Aggregate per provider: price band + whether any listing is reliable (high availability).
  const byProvider: Record<string, { min: number; max: number; cat: string; reliable: boolean }> = {};
  fam.forEach(l => {
    const m = getMeta(l.provider);
    const k = m.short;
    const p = l.price_per_hour;
    if (!byProvider[k]) byProvider[k] = { min: p, max: p, cat: m.cat, reliable: l.availability === "high" };
    else {
      byProvider[k].min = Math.min(byProvider[k].min, p);
      byProvider[k].max = Math.max(byProvider[k].max, p);
      byProvider[k].reliable = byProvider[k].reliable || l.availability === "high";
    }
  });
  const all = Object.entries(byProvider).map(([name, v]) => ({ name, ...v })).sort((a, b) => a.min - b.min);
  if (all.length < 2) return null;

  // How many clouds price below the customer's effective rate — the headline of the chart.
  const cheaperCount = all.filter(p => p.min < currentRatePerHour).length;

  // Render the cheapest ~7 providers, then ensure the customer marker has a home.
  type Row = { name: string; min: number; max: number; cat: string; reliable: boolean; you?: boolean };
  const shown: Row[] = all.slice(0, 7);
  const youRow: Row = { name: "Your bill", min: currentRatePerHour, max: currentRatePerHour, cat: "You", reliable: false, you: true };
  const rows: Row[] = [...shown, youRow].sort((a, b) => a.min - b.min);

  const scaleMax = Math.max(...rows.map(r => r.max), currentRatePerHour) * 1.06;
  const pct = (v: number) => Math.max(0, Math.min(100, (v / scaleMax) * 100));
  const youPos = pct(currentRatePerHour);
  const catColor = (cat: string) =>
    cat === "Hyperscaler" ? "var(--amber)" : cat === "Neocloud" ? "var(--blue)" : cat === "Marketplace" ? "var(--violet)" : "var(--text-muted)";

  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderTop: "none", padding: "18px 22px 16px", marginBottom: 1 }}>
      <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 3 }}>
        {family} — where your bill lands
      </div>
      <div style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)", marginBottom: 16 }}>Every cloud, cheapest to most expensive</div>

      {/* scale ticks */}
      <div style={{ display: "grid", gridTemplateColumns: "96px 1fr 56px", gap: 12, marginBottom: 8 }}>
        <div />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          {[0, scaleMax / 2, scaleMax].map((v, i) => <span key={i} style={{ ...MONO, fontSize: 9, color: "var(--text-muted)" }}>{fmtP(v)}</span>)}
        </div>
        <div />
      </div>

      <div style={{ position: "relative" as const }}>
        {/* faint vertical guide at the customer's rate — everything left of it is cheaper */}
        <div style={{ position: "absolute" as const, left: "96px", right: "56px", top: 0, bottom: 0, pointerEvents: "none" as const }}>
          <div style={{ position: "absolute" as const, left: `${youPos}%`, top: 0, bottom: 0, borderLeft: "1px dashed rgba(155,28,28,0.4)" }} />
        </div>

        {rows.map(r => {
          const isFloor = !r.you && r.reliable && r.name === floorProviderShort;
          const cc = r.you ? "var(--red)" : catColor(r.cat);
          const barLeft = pct(r.min);
          const barWidth = Math.max(pct(r.max) - pct(r.min), 0.8);
          return (
            <div key={r.name + (r.you ? "_you" : "")} style={{ display: "grid", gridTemplateColumns: "96px 1fr 56px", gap: 12, alignItems: "center", height: r.you ? 26 : 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: r.you ? 3 : 2, height: r.you ? 14 : 11, background: cc, flexShrink: 0 }} />
                <span style={{ ...SANS, fontSize: 12, color: r.you ? "var(--red)" : isFloor ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: r.you || isFloor ? 600 : 400, whiteSpace: "nowrap" as const }}>{r.name}</span>
                {isFloor && <span style={{ ...MONO, fontSize: 8.5, color: "var(--green)", background: "rgba(39,103,73,0.08)", border: "1px solid rgba(39,103,73,0.25)", padding: "0 4px", borderRadius: 2 }}>floor</span>}
              </div>
              <div style={{ position: "relative" as const, height: 6, background: r.you ? "transparent" : "var(--elevated)", borderRadius: 1 }}>
                {r.you ? (
                  <div style={{ position: "absolute" as const, left: `${youPos}%`, top: "50%", width: 9, height: 9, background: "var(--red)", borderRadius: "50%", transform: "translate(-50%,-50%)" }} />
                ) : (
                  <>
                    <div style={{ position: "absolute" as const, left: `${barLeft}%`, width: `${barWidth}%`, height: "100%", background: cc, opacity: 0.85, borderRadius: 1 }} />
                    {isFloor && <div style={{ position: "absolute" as const, left: `${barLeft}%`, top: -3, height: 12, width: 2, background: "var(--green)", transform: "translateX(-1px)" }} />}
                  </>
                )}
              </div>
              <span style={{ ...MONO, fontSize: 12, textAlign: "right" as const, fontWeight: r.you || isFloor ? 600 : 400, color: r.you ? "var(--red)" : isFloor ? "var(--green)" : "var(--text-secondary)" }}>{fmtP(r.min)}</span>
            </div>
          );
        })}
      </div>

      {/* legend + takeaway */}
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" as const, marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
        {[["Hyperscaler", "var(--amber)", false], ["Neocloud", "var(--blue)", false], ["Marketplace", "var(--violet)", false], ["You", "var(--red)", true]].map(([l, c, round]) => (
          <div key={l as string} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, background: c as string, borderRadius: round ? "50%" : 1 }} />
            <span style={{ ...SANS, fontSize: 11, color: "var(--text-muted)" }}>{l}</span>
          </div>
        ))}
      </div>
      {cheaperCount > 0 && (
        <div style={{ ...SANS, fontSize: 12.5, color: "var(--text-secondary)", marginTop: 12, lineHeight: 1.6 }}>
          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{cheaperCount} cloud{cheaperCount !== 1 ? "s" : ""}</span> price {family} below your effective <span style={{ ...MONO, color: "var(--red)", fontWeight: 600 }}>{fmtP(currentRatePerHour)}/hr</span>. The reliable floor is <span style={{ ...MONO, color: "var(--green)", fontWeight: 600 }}>{fmtP(floorRate)}/hr</span>{floorProviderShort ? ` (${floorProviderShort})` : ""}.
        </div>
      )}
    </div>
  );
}

function ResultSection({ r, family, gpuCount, hours, situation, workload, label, billActualSpend, billProvider, listings }: {
  r: ComputedResult; family: GpuFamily; gpuCount: number; hours: number;
  situation: Situation; workload: WorkloadType; label?: string;
  billActualSpend?: number; billProvider?: string; listings?: GpuListing[];
}) {
  const { baseline, recommendation, isReliable, currentMonthly, recommendedMonthly, savings, savingsPct, annualSavings, currentRatePerHour, floorRatePerHour, sizingSuspect, reliabilityRisk, isBatchFriendly, workloadLabel, advice } = r;
  const fromBill = billActualSpend != null && billActualSpend > 0;
  const hasGap = !!(savings && savingsPct && annualSavings);

  let headline: React.ReactNode;
  if (hasGap) {
    headline = (
      <>
        <span style={{ ...SANS, fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", width: "100%", marginBottom: 4 }}>
          You're overspending by
        </span>
        <span style={{ ...MONO, fontSize: 40, fontWeight: 700, color: "var(--red)", letterSpacing: "-0.03em", lineHeight: 1 }}>
          {fmtBigMoney(annualSavings!)}<span style={{ fontSize: 18, color: "var(--text-muted)", fontWeight: 400 }}>/yr</span>
        </span>
        <span style={{ ...SANS, fontSize: 14, color: "var(--text-secondary)", marginLeft: 12, alignSelf: "flex-end" as const }}>
          {savingsPct}% of your {family === "other" ? "GPU" : family} bill — same GPUs, same hours, at a price the market already clears.
        </span>
      </>
    );
  } else if (sizingSuspect && currentMonthly) {
    headline = (
      <span style={{ ...SANS, fontSize: 15, color: "var(--text-secondary)" }}>
        We read <span style={{ ...MONO, color: "var(--text-primary)", fontWeight: 600 }}>{fmtMoney(currentMonthly)}/mo</span>, but the detected GPU count doesn't square with that spend. Confirm your setup and we'll size the gap precisely.
      </span>
    );
  } else if (currentMonthly) {
    headline = (
      <span style={{ ...SANS, fontSize: 15, color: "var(--text-secondary)" }}>
        You're at the reliable market floor for {family === "other" ? "GPU" : family}. Switching providers won't help — the win here is utilisation and reserved pricing.
      </span>
    );
  } else {
    headline = (
      <span style={{ ...SANS, fontSize: 15, color: "var(--text-secondary)" }}>
        Add your current provider to size the gap — we couldn't find a {situation} baseline for {family === "other" ? "this GPU" : family} in today's snapshot.
      </span>
    );
  }

  const keepLine = !isBatchFriendly && workload !== "unsure";

  return (
    <div style={{ marginBottom: 2 }}>
      {label && (
        <div style={{ ...MONO, fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 6 }}>
          {label}
        </div>
      )}
      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderTop: `3px solid ${hasGap ? "var(--red)" : "var(--border-mid)"}`, padding: "20px 24px", marginBottom: 1, display: "flex", alignItems: "baseline", flexWrap: "wrap" as const, gap: 4 }}>
        {headline}
      </div>
      {hasGap && currentRatePerHour != null && (
        <FamilySpreadChart
          listings={listings ?? []}
          family={family}
          currentRatePerHour={currentRatePerHour}
          floorRate={floorRatePerHour}
          floorProviderShort={getMeta(recommendation.provider).short}
        />
      )}
      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderTop: "none", padding: "16px 24px", display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, alignItems: "start" }}>
        <div>
          <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 4 }}>Availability risk</div>
          <div style={{ ...MONO, fontSize: 14, fontWeight: 600, color: reliabilityRisk === "Low" ? "var(--green)" : reliabilityRisk === "High" ? "var(--red)" : "var(--amber)" }}>{reliabilityRisk}</div>
        </div>
        {advice && (
          <div style={{ ...SANS, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65, borderLeft: "2px solid var(--border-mid)", paddingLeft: 16 }}>{advice}</div>
        )}
      </div>
      {keepLine && (
        <div style={{ background: "var(--elevated)", border: "1px solid var(--border)", borderTop: "none", borderLeft: "3px solid var(--amber)", padding: "14px 24px" }}>
          <div style={{ ...SANS, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            <strong style={{ color: "var(--text-primary)" }}>Don't move this one.</strong> {workloadLabel} is latency- or continuity-sensitive — keep it on production-stable capacity even if a cheaper listing exists.
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Default workload row factory ── */
let _nextId = 1;
const newRow = (): WorkloadRow => ({
  id: _nextId++, family: "H100", gpuCountStr: "8", hoursStr: "720",
  situation: "hyperscaler", workload: "evals",
});

export default function AuditTool({ listings }: AuditToolProps) {
  const [activeTab,      setActiveTab]      = useState<InputTab>("describe");
  const [setupText,      setSetupText]      = useState("");
  const [billFileName,     setBillFileName]     = useState<string | null>(null);
  const [billFile,         setBillFile]         = useState<File | null>(null);
  const [billExtracting,   setBillExtracting]   = useState(false);
  const [billExtractError, setBillExtractError] = useState<string | null>(null);
  const [billExtracted,    setBillExtracted]    = useState<{
    family: string; gpuCount: number; hoursPerMonth: number;
    situation: string; workload: string; monthlySpend: number;
    provider: string; confidence: string;
  } | null>(null);
  const [diagramFileName, setDiagramFileName] = useState<string | null>(null);
  const [rows,           setRows]           = useState<WorkloadRow[]>([newRow()]);
  const [committed,      setCommitted]      = useState(false);
  const [email,          setEmail]          = useState("");
  const [wantsAlerts,    setWantsAlerts]    = useState(true);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState("");
  const [submitted,      setSubmitted]      = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [earlyAccessSent, setEarlyAccessSent] = useState(false);

  const parsed    = useMemo(() => parseStackText(setupText), [setupText]);
  const hasText   = setupText.trim().length > 0;
  const hasUpload = !!billFileName || !!diagramFileName;

  const firstRow = rows[0];
  const primarySnapshot = useMemo(() => {
    if (hasText) {
      return {
        family:     parsed.family    ?? firstRow.family,
        gpuCount:   parsed.gpuCount  ?? parseNum(firstRow.gpuCountStr, 8),
        hours:      parsed.hours     ?? parseNum(firstRow.hoursStr, 720),
        situation:  parsed.situation ?? firstRow.situation,
        workload:   parsed.workload  ?? firstRow.workload,
        fromParsed: parsed.matchedTerms.length > 0,
        hasFamily:  parsed.family !== null,
      };
    }
    return {
      family:     firstRow.family,
      gpuCount:   parseNum(firstRow.gpuCountStr, 8),
      hours:      parseNum(firstRow.hoursStr, 720),
      situation:  firstRow.situation,
      workload:   firstRow.workload,
      fromParsed: false,
      hasFamily:  true,
    };
  }, [hasText, parsed, firstRow]);

  const showGuard = committed && activeTab === "describe" && hasText && !primarySnapshot.hasFamily;

  const manualResults = useMemo(() =>
    rows.map(row => ({
      row,
      result: computeResult(
        listings, row.family,
        parseNum(row.gpuCountStr, 8),
        parseNum(row.hoursStr, 720),
        row.situation, row.workload,
      ),
    })),
  [rows, listings]);

  const primaryResult = useMemo(() =>
    committed && !showGuard
      ? computeResult(listings, primarySnapshot.family, primarySnapshot.gpuCount, primarySnapshot.hours, primarySnapshot.situation, primarySnapshot.workload)
      : null,
  [committed, showGuard, listings, primarySnapshot]);

  const showTextResult   = committed && activeTab === "describe" && hasText && !showGuard && !!primaryResult;
  const showManualResult = committed && activeTab === "manual" && rows.length > 0 && manualResults.some(r => !!r.result);
  const showUploadResult = committed && (activeTab === "bill" || activeTab === "diagram") && hasUpload;
  const showResult       = showTextResult || showManualResult || showUploadResult;

  const workedExample = useMemo(() => {
    const a100Hyper = listings.filter(l => l.gpu_model.includes("A100") && HYPERSCALERS.includes(l.provider.toLowerCase()) && l.availability === "high")
      .sort((a, b) => a.price_per_hour - b.price_per_hour)[0];
    if (!a100Hyper) return null;
    const specHigh = listings.filter(l => l.gpu_model.includes("A100") && !HYPERSCALERS.includes(l.provider.toLowerCase()) && l.availability === "high")
      .sort((a, b) => a.price_per_hour - b.price_per_hour)[0];
    const specAny  = listings.filter(l => l.gpu_model.includes("A100") && !HYPERSCALERS.includes(l.provider.toLowerCase()))
      .sort((a, b) => a.price_per_hour - b.price_per_hour)[0];
    const a100Spec = specHigh ?? specAny;
    if (!a100Spec) return null;
    const saving = (a100Hyper.price_per_hour - a100Spec.price_per_hour) * 8 * 500;
    if (saving <= 0) return null;
    return { baseline: a100Hyper.price_per_hour, recommended: a100Spec.price_per_hour, savings: saving, provider: getMeta(a100Spec.provider).short, isObserved: !specHigh };
  }, [listings]);

  const inputStyle: React.CSSProperties = {
    ...SANS, width: "100%", background: "var(--panel)", border: "1px solid var(--border-mid)",
    color: "var(--text-primary)", padding: "10px 12px", fontSize: 13.5, outline: "none", borderRadius: 3,
  };
  const labelStyle: React.CSSProperties = {
    ...SANS, display: "block", fontSize: 10.5, fontWeight: 650, color: "var(--text-muted)",
    textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6,
  };

  const buildNotes = (extra?: string) => {
    const lines: string[] = [];
    if (setupText.trim()) lines.push(setupText.trim());
    if (activeTab === "manual" || !hasText) {
      lines.push(rows.map(r => `${r.gpuCountStr}×${r.family} · ${r.hoursStr}h/mo · ${r.situation} · ${r.workload}`).join("\n"));
    }
    if (billFileName)    lines.push(`Bill: ${billFileName}`);
    if (diagramFileName) lines.push(`Diagram: ${diagramFileName}`);
    const flags = [wantsAlerts ? "wantsAlerts:true" : "wantsAlerts:false", extra ?? null].filter(Boolean).join(" · ");
    if (flags) lines.push(flags);
    return lines.filter(Boolean).join("\n\n");
  };

  const post = async (notes: string) => {
    const res = await fetch("/api/audit-request", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, monthlySpend: "Unknown / audit needed", workload: primarySnapshot.workload, notes, source: "cost-audit" }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error ?? "Something went wrong.");
  };

  const handleCapture = async () => {
    if (!email || !email.includes("@")) { setError("Enter a valid work email."); return; }
    setError(""); setLoading(true);
    try { await post(buildNotes()); setSubmittedEmail(email); setSubmitted(true); }
    catch (e: any) { setError(e?.message ?? "Network error — try again."); }
    finally { setLoading(false); }
  };

  const handleEarlyAccess = async () => {
    try { await post(buildNotes("EARLY_ACCESS_$99_MONITORING")); setEarlyAccessSent(true); }
    catch { setEarlyAccessSent(true); }
  };

  const handleRunAudit = async () => {
    if (activeTab === "bill" && billFile) {
      setBillExtracting(true);
      setBillExtractError(null);
      setBillExtracted(null);
      setCommitted(true);
      try {
        const isPdf = billFile.type === "application/pdf" || billFile.name.toLowerCase().endsWith(".pdf");
        let body: any;
        if (isPdf) {
          const ab = await billFile.arrayBuffer();
          const bytes = new Uint8Array(ab);
          // Chunk to avoid call stack overflow on large files
          let bin = "";
          const CHUNK = 8192;
          for (let i = 0; i < bytes.length; i += CHUNK) {
            bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
          }
          body = { base64: btoa(bin), mediaType: "application/pdf", fileName: billFile.name };
        } else {
          const text = await billFile.text();
          body = { text, fileName: billFile.name };
        }
        const res = await fetch("/api/extract-bill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (json.success && json.data) {
          setBillExtracted(json.data);
        } else if (json.error === "no_gpu_found") {
          setBillExtractError("No GPU line items found — try the Describe tab to enter details manually.");
        } else {
          // Surface the server-side reason so failures are debuggable in the UI, not silent.
          if (json.detail) console.error("[extract-bill]", json.error, json.detail);
          const diag = json.detail ? ` (${json.detail})` : "";
          setBillExtractError(`Could not read this file${diag} — try a CSV export or use the Describe tab.`);
        }
      } catch {
        setBillExtractError("Network error reading bill — try again.");
      } finally {
        setBillExtracting(false);
        setTimeout(() => {
          document.getElementById("audit-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 80);
      }
      return;
    }
    setCommitted(true);
    setTimeout(() => {
      document.getElementById("audit-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const updateRow = (id: number, patch: Partial<WorkloadRow>) =>
    setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));
  const addRow    = () => setRows(rs => [...rs, newRow()]);
  const removeRow = (id: number) => setRows(rs => rs.length > 1 ? rs.filter(r => r.id !== id) : rs);

  const TABS: { id: InputTab; label: string; dot: boolean }[] = [
    { id: "describe", label: "Describe",             dot: hasText },
    { id: "bill",     label: "Cloud bill",            dot: !!billFileName },
    { id: "diagram",  label: "Architecture diagram",  dot: !!diagramFileName },
    { id: "manual",   label: "Manual details",        dot: false },
  ];

  const tabBtn = (id: InputTab, label: string, dot: boolean) => (
    <button key={id} type="button" onClick={() => setActiveTab(id)} style={{
      ...SANS, fontSize: 12.5, fontWeight: activeTab === id ? 600 : 400,
      color: activeTab === id ? "var(--text-primary)" : "var(--text-muted)",
      background: activeTab === id ? "var(--panel)" : "var(--elevated)",
      border: "1px solid var(--border)",
      borderBottom: activeTab === id ? "1px solid var(--panel)" : "1px solid var(--border)",
      padding: "8px 16px", cursor: "pointer", borderRadius: "3px 3px 0 0",
      marginBottom: -1, position: "relative" as const, zIndex: activeTab === id ? 1 : 0,
      whiteSpace: "nowrap" as const,
    }}>
      {label}
      {dot && <span style={{ ...MONO, fontSize: 9, color: "var(--blue)", marginLeft: 5 }}>●</span>}
    </button>
  );

  return (
    <div>

      {/* ── Worked example ── */}
      {workedExample && (
        <div style={{ background: "var(--elevated)", border: "1px solid var(--border)", borderLeft: "3px solid var(--green)", padding: "14px 18px", marginBottom: 20 }}>
          <div style={{ ...MONO, fontSize: 10, color: "var(--green)", letterSpacing: "0.08em", marginBottom: 6 }}>EXAMPLE</div>
          <div style={{ ...SANS, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65 }}>
            Evals and batch inference on hyperscaler A100s (~{fmtP(workedExample.baseline)}/hr) pay a reliability premium they don't need for interruption-tolerant jobs. Moving to specialist A100s (~{fmtP(workedExample.recommended)}/hr at {workedExample.provider}{workedExample.isObserved ? ", observed" : ""}) ≈{" "}
            <strong style={{ color: "var(--green)" }}>{fmtMoney(workedExample.savings)}/mo saved</strong> for 8 GPUs × 500 hrs, while production serving stays put.{" "}
            <em style={{ color: "var(--text-muted)" }}>Your numbers will differ.</em>
          </div>
        </div>
      )}

      {/* ── Input card ── */}
      <div style={{ marginBottom: 16 }}>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" as const }}>
          {TABS.map(t => tabBtn(t.id, t.label, t.dot))}
        </div>

        {/* Tab panel */}
        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: "20px 24px" }}>

          {/* Describe */}
          {activeTab === "describe" && (
            <div>
              <label style={labelStyle}>Describe your current stack — or paste a quote</label>
              <textarea
                value={setupText}
                onChange={e => setSetupText(e.target.value)}
                placeholder="Example: We run 8×H100 on GCP for batch inference and evals, around 500–700 hours/month. Production serving stays on AWS. Want to know what can safely move."
                rows={6}
                style={{ ...inputStyle, minHeight: 140, resize: "vertical", lineHeight: 1.55 }}
              />
              {parsed.matchedTerms.length > 0 && (
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const, marginTop: 10 }}>
                  {parsed.matchedTerms.map(term => (
                    <span key={term} style={{ ...MONO, fontSize: 10, color: "var(--blue)", background: "rgba(43,108,176,0.07)", border: "1px solid rgba(43,108,176,0.18)", padding: "2px 7px", borderRadius: 2 }}>{term}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Cloud bill */}
          {activeTab === "bill" && (
            <div>
              <label style={labelStyle}>Upload your cloud bill</label>
              <p style={{ ...SANS, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 16 }}>
                CSV, PDF, or Excel export from AWS Cost Explorer, GCP Billing, or Azure Cost Management. We'll read line-item GPU spend against the live market.
              </p>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", ...SANS, fontSize: 13, color: "var(--blue)", border: "1px solid var(--border-mid)", padding: "10px 18px", borderRadius: 3, background: "var(--elevated)" }}>
                <input type="file" accept=".csv,.pdf,.xlsx,.xls" style={{ display: "none" }} onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) { setBillFileName(file.name); setBillFile(file); setBillExtracted(null); setBillExtractError(null); setCommitted(false); }
                }} />
                <span style={{ fontSize: 15 }}>⬆</span> Choose file
              </label>
              {billFileName && (
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ ...MONO, fontSize: 11.5, color: "var(--green)" }}>✓</span>
                  <span style={{ ...SANS, fontSize: 13, color: "var(--text-secondary)" }}>{billFileName}</span>
                  <button onClick={() => { setBillFileName(null); setBillFile(null); setBillExtracted(null); setBillExtractError(null); setCommitted(false); }} style={{ ...SANS, fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>remove</button>
                </div>
              )}
            </div>
          )}

          {/* Architecture diagram */}
          {activeTab === "diagram" && (
            <div>
              <label style={labelStyle}>Upload your architecture diagram</label>
              <p style={{ ...SANS, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 16 }}>
                PNG, JPG, or PDF. We'll extract GPU types, counts, and providers from your diagram and map them to current market pricing.
              </p>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", ...SANS, fontSize: 13, color: "var(--blue)", border: "1px solid var(--border-mid)", padding: "10px 18px", borderRadius: 3, background: "var(--elevated)" }}>
                <input type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) { setDiagramFileName(file.name); setCommitted(false); }
                }} />
                <span style={{ fontSize: 15 }}>⬆</span> Choose file
              </label>
              {diagramFileName && (
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ ...MONO, fontSize: 11.5, color: "var(--green)" }}>✓</span>
                  <span style={{ ...SANS, fontSize: 13, color: "var(--text-secondary)" }}>{diagramFileName}</span>
                  <button onClick={() => { setDiagramFileName(null); setCommitted(false); }} style={{ ...SANS, fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>remove</button>
                </div>
              )}
            </div>
          )}

          {/* Manual details */}
          {activeTab === "manual" && (
            <div>
              <label style={labelStyle}>Workload details — one row per GPU type or use case</label>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
                {rows.map((row, idx) => (
                  <div key={row.id} style={{ background: "var(--elevated)", border: "1px solid var(--border)", borderRadius: 3, padding: "16px 18px" }}>
                    <div style={{ ...MONO, fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.07em", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
                      WORKLOAD {idx + 1}
                      {rows.length > 1 && (
                        <button onClick={() => removeRow(row.id)} style={{ ...SANS, fontSize: 10.5, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                          remove
                        </button>
                      )}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }} className="manual-grid">
                      <div>
                        <label style={labelStyle}>Workload type</label>
                        <select value={row.workload} onChange={e => updateRow(row.id, { workload: e.target.value as WorkloadType })} style={{ ...inputStyle, appearance: "auto" }}>
                          {WORKLOAD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Current provider</label>
                        <select value={row.situation} onChange={e => updateRow(row.id, { situation: e.target.value as Situation })} style={{ ...inputStyle, appearance: "auto" }}>
                          {SETUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>GPU family</label>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const }}>
                          {(["H100","A100","L40S","A10G","other"] as GpuFamily[]).map(f => (
                            <button key={f} type="button" onClick={() => updateRow(row.id, { family: f })} style={{
                              ...MONO, fontSize: 11, padding: "6px 10px", borderRadius: 3, cursor: "pointer",
                              border: `1px solid ${row.family === f ? "var(--blue)" : "var(--border-mid)"}`,
                              background: row.family === f ? "rgba(43,108,176,0.08)" : "var(--panel)",
                              color: row.family === f ? "var(--blue)" : "var(--text-secondary)",
                            }}>{f}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={labelStyle}>GPU count</label>
                        <input type="number" min={1} value={row.gpuCountStr}
                          onChange={e => updateRow(row.id, { gpuCountStr: e.target.value })}
                          onBlur={() => updateRow(row.id, { gpuCountStr: String(parseNum(row.gpuCountStr, 1)) })}
                          style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Hours / month</label>
                        <input type="number" min={1} max={8760} value={row.hoursStr}
                          onChange={e => updateRow(row.id, { hoursStr: e.target.value })}
                          onBlur={() => updateRow(row.id, { hoursStr: String(parseNum(row.hoursStr, 720)) })}
                          style={inputStyle} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addRow} style={{
                ...SANS, fontSize: 12.5, color: "var(--blue)", background: "none",
                border: "1px dashed var(--border-mid)", borderRadius: 3, cursor: "pointer",
                padding: "10px 18px", marginTop: 10, width: "100%",
              }}>
                + Add another workload
              </button>
            </div>
          )}

        </div>{/* end tab panel */}

        {/* ── Run audit CTA — always visible ── */}
        <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 14 }}>
          <button
            type="button"
            onClick={handleRunAudit}
            style={{
              ...SANS, fontSize: 14, fontWeight: 600,
              color: "#F7F3EA", background: "#171717",
              padding: "13px 32px", borderRadius: 3, border: "none",
              cursor: "pointer", letterSpacing: "0.01em",
            }}
          >
            Run cost audit →
          </button>
          <span style={{ ...SANS, fontSize: 12, color: "var(--text-muted)" }}>
            No email required to see results
          </span>
        </div>

      </div>{/* end input card wrapper */}

      {/* ── Guard ── */}
      {showGuard && (
        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderLeft: "3px solid var(--amber)", padding: "18px 24px", marginBottom: 16 }}>
          <div style={{ ...SANS, fontSize: 13.5, color: "var(--text-primary)", fontWeight: 600, marginBottom: 4 }}>Add your GPU type and provider to get your number.</div>
          <div style={{ ...SANS, fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
            We won't guess — a number from assumptions isn't worth anything. Name a GPU (H100, A100, L40S, A10G) and a provider in the box above, or{" "}
            <button onClick={() => setActiveTab("manual")} style={{ ...SANS, fontSize: 12.5, color: "var(--blue)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>enter details manually</button>.
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {showResult && (
        <div id="audit-results" style={{ marginBottom: 16 }}>
          <div style={{ ...MONO, fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 10 }}>
            Audit preview — {activeTab === "bill" ? (billExtracted ? "bill read" : billExtractError ? "could not read" : "reading bill") : activeTab === "diagram" ? "diagram received" : primarySnapshot.fromParsed ? "detected from your text" : "your details"}
          </div>

          {showUploadResult && activeTab === "bill" && (() => {
            const ex = billExtracted;
            const VALID_FAMILIES = ["H100","A100","L40S","A10G","other"];
            const VALID_SITUATIONS = ["hyperscaler","neocloud","marketplace","unsure"];
            const VALID_WORKLOADS  = ["inference","batch","evals","finetuning","training","dev","unsure"];
            const exFamily    = ex && VALID_FAMILIES.includes(ex.family)   ? ex.family   as GpuFamily   : null;
            const exSituation = ex && VALID_SITUATIONS.includes(ex.situation) ? ex.situation as Situation : "hyperscaler";
            const exWorkload  = ex && VALID_WORKLOADS.includes(ex.workload)   ? ex.workload  as WorkloadType : "unsure";
            const safeGpuCount = (ex?.gpuCount > 0) ? ex.gpuCount : 1;
            const safeHours    = (ex?.hoursPerMonth > 0) ? ex.hoursPerMonth : 720;
            const safeSpend    = (ex?.monthlySpend > 0) ? ex.monthlySpend : undefined;
            const exResult = ex && exFamily
              ? computeResult(listings, exFamily, safeGpuCount, safeHours, exSituation, exWorkload, safeSpend)
              : null;
            
            const accentColor = billExtracting ? "var(--border-mid)" : ex ? "var(--green)" : billExtractError ? "var(--amber)" : "var(--border-mid)";
            return (
              <div>
                <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderTop: `3px solid ${accentColor}`, padding: "20px 24px", marginBottom: 1, display: "flex", alignItems: "baseline", flexWrap: "wrap" as const, gap: 8 }}>
                  {billExtracting ? (
                    <span style={{ ...SANS, fontSize: 15, color: "var(--text-muted)" }}>Reading your bill…</span>
                  ) : ex ? (
                    <>
                      <span style={{ ...MONO, fontSize: 28, fontWeight: 600, color: "var(--green)", letterSpacing: "-0.03em" }}>Bill read</span>
                      <span style={{ ...SANS, fontSize: 14, color: "var(--text-secondary)" }}>
                        {ex.provider} · {ex.family} · {ex.gpuCount} GPU{ex.gpuCount !== 1 ? "s" : ""} · ${ex.monthlySpend.toLocaleString()}/mo GPU spend
                        {ex.confidence !== "high" && (
                          <span style={{ ...MONO, fontSize: 10, color: "var(--amber)", marginLeft: 8, background: "rgba(151,90,22,0.08)", border: "1px solid rgba(151,90,22,0.2)", padding: "1px 6px", borderRadius: 2 }}>
                            {ex.confidence} confidence
                          </span>
                        )}
                      </span>
                    </>
                  ) : billExtractError ? (
                    <>
                      <span style={{ ...MONO, fontSize: 18, fontWeight: 600, color: "var(--amber)", letterSpacing: "-0.02em" }}>Could not read bill</span>
                      <span style={{ ...SANS, fontSize: 13, color: "var(--text-secondary)", marginLeft: 8 }}>{billExtractError}</span>
                    </>
                  ) : (
                    <>
                      <span style={{ ...MONO, fontSize: 28, fontWeight: 600, color: "var(--green)", letterSpacing: "-0.03em" }}>Bill received</span>
                      <span style={{ ...SANS, fontSize: 14, color: "var(--text-secondary)" }}>Reading line-item GPU spend against the live market…</span>
                    </>
                  )}
                </div>
                <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderTop: "none", padding: "14px 24px", display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, alignItems: "start", marginBottom: 1 }}>
                  <div>
                    <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 4 }}>File</div>
                    <div style={{ ...MONO, fontSize: 12, color: "var(--text-primary)" }}>{billFileName}</div>
                  </div>
                  <div style={{ ...SANS, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65, borderLeft: "2px solid var(--border-mid)", paddingLeft: 16 }}>
                    {ex
                      ? "Market comparison below. Enter your email for the full analyst-reviewed breakdown."
                      : billExtractError
                      ? "Try the Describe tab to enter your setup manually."
                      : "Enter your email below — we'll send a provider-by-provider breakdown within one business day."}
                  </div>
                </div>
                {exResult && exFamily && (
                  <ResultSection
                    r={exResult}
                    family={exFamily}
                    gpuCount={safeGpuCount}
                    hours={safeHours}
                    situation={exSituation}
                    workload={exWorkload}
                    billActualSpend={safeSpend}
                    billProvider={ex!.provider}
                    listings={listings}
                  />
                )}
              </div>
            );
          })()}

          {showUploadResult && activeTab === "diagram" && (
            <div>
              <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderTop: "3px solid var(--blue)", padding: "20px 24px", marginBottom: 1, display: "flex", alignItems: "baseline", flexWrap: "wrap" as const, gap: 8 }}>
                <span style={{ ...MONO, fontSize: 22, fontWeight: 600, color: "var(--blue)", letterSpacing: "-0.02em" }}>Diagram received</span>
                <span style={{ ...SANS, fontSize: 14, color: "var(--text-secondary)" }}>We'll map it to current market pricing and send your breakdown.</span>
              </div>
              <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderTop: "none", padding: "14px 24px", display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, alignItems: "start" }}>
                <div>
                  <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 4 }}>File</div>
                  <div style={{ ...MONO, fontSize: 12, color: "var(--text-primary)" }}>{diagramFileName}</div>
                </div>
                <div style={{ ...SANS, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65, borderLeft: "2px solid var(--border-mid)", paddingLeft: 16 }}>
                  Enter your email below — we'll extract GPU types, counts, and providers from your diagram and map them to live market pricing. Provider-by-provider, analyst reviewed.
                </div>
              </div>
            </div>
          )}

          {showTextResult && primaryResult && (
            <ResultSection
              r={primaryResult}
              family={primarySnapshot.family}
              gpuCount={primarySnapshot.gpuCount}
              hours={primarySnapshot.hours}
              situation={primarySnapshot.situation}
              workload={primarySnapshot.workload}
              listings={listings}
            />
          )}

          {showManualResult && manualResults.map(({ row, result }, idx) =>
            result ? (
              <div key={row.id} style={{ marginBottom: idx < manualResults.length - 1 ? 20 : 0 }}>
                <ResultSection
                  r={result}
                  family={row.family}
                  gpuCount={parseNum(row.gpuCountStr, 8)}
                  hours={parseNum(row.hoursStr, 720)}
                  situation={row.situation}
                  workload={row.workload}
                  listings={listings}
                  label={rows.length > 1 ? `Workload ${idx + 1} — ${row.family} · ${row.gpuCountStr}× · ${row.hoursStr}h/mo` : undefined}
                />
              </div>
            ) : null
          )}
        </div>
      )}

      {/* ── Email capture ── */}
      {(showResult || (committed && hasUpload)) && !submitted && (
        <div style={{ marginTop: 16, background: "#171717", padding: "20px 24px" }}>
          <div style={{ ...SANS, fontSize: 13.5, fontWeight: 600, color: "#F7F3EA", marginBottom: 4 }}>
            {hasUpload ? "Get your bill read against the live market" : "Get the full breakdown"}
          </div>
          <div style={{ ...SANS, fontSize: 11.5, color: "rgba(247,243,234,0.55)", lineHeight: 1.55, marginBottom: 14 }}>
            {hasUpload
              ? `Provider-by-provider analysis from your actual ${billFileName ?? diagramFileName} — region options, what to move first, what to keep. Analyst reviewed.`
              : "Provider-by-provider analysis, region options, and what to move first — analyst reviewed."}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, cursor: "pointer" }}>
            <input type="checkbox" checked={wantsAlerts} onChange={e => setWantsAlerts(e.target.checked)} />
            <span style={{ ...SANS, fontSize: 12.5, color: "rgba(247,243,234,0.85)" }}>Also alert me when prices for my stack move</span>
          </label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const, alignItems: "flex-start" }}>
            <input type="email" placeholder="you@company.com" value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ ...inputStyle, width: "auto", flex: "1 1 240px", background: "rgba(247,243,234,0.06)", border: "1px solid rgba(247,243,234,0.2)", color: "#F7F3EA" }} />
            <button onClick={handleCapture} disabled={loading} style={{
              ...SANS, fontSize: 13, fontWeight: 600, color: "#171717",
              background: loading ? "rgba(247,243,234,0.5)" : "#F7F3EA",
              padding: "10px 22px", borderRadius: 3, border: "none", cursor: loading ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const,
            }}>
              {loading ? "Sending…" : "Email me the full breakdown"}
            </button>
          </div>
          {error && <p style={{ ...SANS, fontSize: 12, color: "#F2B5B5", marginTop: 8 }}>{error}</p>}
        </div>
      )}

      {/* ── Success ── */}
      {submitted && (
        <div style={{ marginTop: 16, background: "var(--panel)", border: "1px solid var(--border)", padding: "28px 24px", textAlign: "center" as const }}>
          <div style={{ fontSize: 22, color: "var(--green)", marginBottom: 10 }}>✓</div>
          <div style={{ ...SERIF, fontSize: 22, fontWeight: 400, color: "var(--text-primary)", marginBottom: 8 }}>On its way.</div>
          <div style={{ ...SANS, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, maxWidth: 460, margin: "0 auto" }}>
            We'll send the full breakdown to <strong style={{ color: "var(--text-primary)" }}>{submittedEmail}</strong> within one business day.
            {hasUpload && <> Reply to that email with <strong style={{ color: "var(--text-primary)" }}>{billFileName ?? diagramFileName}</strong> attached and we'll price it against the live market.</>}
          </div>
          {!earlyAccessSent ? (
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
              <div style={{ ...SANS, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 12 }}>
                Automated weekly monitoring of your stack launches at <strong style={{ color: "var(--text-primary)" }}>$99/mo</strong> — we alert you the moment a cheaper reliable option appears. Want in early?
              </div>
              <button onClick={handleEarlyAccess} style={{
                ...SANS, fontSize: 13, fontWeight: 600, color: "#F7F3EA", background: "#171717",
                padding: "10px 22px", borderRadius: 3, border: "none", cursor: "pointer",
              }}>
                Yes, I want early access →
              </button>
            </div>
          ) : (
            <div style={{ ...SANS, fontSize: 12.5, color: "var(--green)", marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
              Noted — you're on the early-access list. We'll be in touch before launch.
            </div>
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 760px) { .manual-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
