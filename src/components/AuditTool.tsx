"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  GpuListing, HYPERSCALERS, fmtMoney, fmtP, getMeta,
} from "@/lib/market-helpers";
import { computeMarketStats, computeDemoExample } from "@/lib/market-stats";

const MONO:  React.CSSProperties = { fontFamily: "var(--font-mono)" };
const SANS:  React.CSSProperties = { fontFamily: "var(--font-sans)" };
const SERIF: React.CSSProperties = { fontFamily: "var(--font-serif)" };

type Situation    = "hyperscaler" | "neocloud" | "marketplace" | "unsure";
type WorkloadType = "inference" | "batch" | "evals" | "finetuning" | "training" | "dev" | "unsure";
type GpuFamily    = "H100" | "A100" | "L40S" | "A10G" | "other";
type InputTab     = "describe" | "bill" | "manual";

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

interface AuditToolProps {
  listings: GpuListing[];
  // Compact mode: renders a single-row prefilled calculator (GPU + count +
  // hours + savings number) for use inside the /market-data hero stat strip.
  // No tabs, no bill upload, no describe box, no CTA capture forms, no
  // sessionStorage persistence — just the same computeResult() + prefill +
  // touched-gating logic as the full tool, in a smaller shell. See
  // "Interactive Hero Calculator" brief §4.
  compact?: boolean;
}

// Hardcoded provider deep-links for the secondary "Move it myself →" self-serve
// link (§2.5 — earns channel/referral, quieter than the primary "Start my
// move" lead-capture flow). No referral-link field exists in market-helpers/DB
// today — swap for real referral/affiliate URLs once those exist.
const PROVIDER_SIGNUP_URLS: Record<string, string> = {
  runpod: "https://www.runpod.io/console/signup",
  vastai: "https://cloud.vast.ai/",
  "vast.ai": "https://cloud.vast.ai/",
  aws: "https://aws.amazon.com/ec2/instance-types/p5/",
  azure: "https://azure.microsoft.com/en-us/pricing/details/virtual-machines/",
  gcp: "https://cloud.google.com/compute/gpus-pricing",
  "google cloud": "https://cloud.google.com/compute/gpus-pricing",
  coreweave: "https://www.coreweave.com/contact",
  lambda: "https://lambda.ai/service/gpu-cloud",
  "lambda labs": "https://lambda.ai/service/gpu-cloud",
  nebius: "https://nebius.com/contact",
  tensordock: "https://tensordock.com/",
  oci: "https://www.oracle.com/cloud/compute/gpu/",
  "oracle cloud": "https://www.oracle.com/cloud/compute/gpu/",
  paperspace: "https://www.paperspace.com/pricing",
  crusoe: "https://crusoe.ai/contact-us/",
  "crusoe energy": "https://crusoe.ai/contact-us/",
  fluidstack: "https://www.fluidstack.io/",
  ibm: "https://www.ibm.com/cloud/gpu",
  "ibm cloud": "https://www.ibm.com/cloud/gpu",
  gmi: "https://www.gmicloud.ai/",
  "gmi cloud": "https://www.gmicloud.ai/",
  voltagepark: "https://www.voltagepark.com/",
  "voltage park": "https://www.voltagepark.com/",
};
function getClientSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let sid = window.sessionStorage.getItem("aiw_sid");
    if (!sid) {
      sid = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : String(Date.now()) + Math.random().toString(36).slice(2);
      window.sessionStorage.setItem("aiw_sid", sid);
    }
    return sid;
  } catch { return ""; }
}

const REFERRAL_OVERRIDES: Record<string, string> = {
  ...(process.env.NEXT_PUBLIC_RUNPOD_REF ? { runpod: `https://runpod.io?ref=${process.env.NEXT_PUBLIC_RUNPOD_REF}` } : {}),
  ...(process.env.NEXT_PUBLIC_VASTAI_REF ? { vastai: `https://vast.ai/?ref=${process.env.NEXT_PUBLIC_VASTAI_REF}`, "vast.ai": `https://vast.ai/?ref=${process.env.NEXT_PUBLIC_VASTAI_REF}` } : {}),
};

const referralUrl = (provider: string) => {
  const key = provider.toLowerCase();
  const base =
    REFERRAL_OVERRIDES[key] ??
    PROVIDER_SIGNUP_URLS[key] ??
    ("https://www.google.com/search?q=" + encodeURIComponent(provider + " GPU cloud pricing"));
  const sep = base.includes("?") ? "&" : "?";
  const sid = getClientSessionId();
  return `${base}${sep}utm_source=aiinfrawatch&utm_medium=audit&utm_campaign=move_yourself${sid ? `&aiw_sid=${encodeURIComponent(sid)}` : ""}`;
};

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
  // RELIABLE FLOOR = confirmed high availability AND NOT spot. Spot prices are
  // interruptible; surfacing a spot rate as the "reliable floor" mislabels an
  // interruptible $0.73 listing as a production-stable price and attributes it
  // to whichever provider happens to own it. A reliable floor an enterprise can
  // actually commit to must be on-demand or reserved, never spot.
  const reliable = familyListings
    .filter(l => l.availability === "high" && l.pricing_type !== "spot")
    .sort((a, b) => a.price_per_hour - b.price_per_hour);
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
    advice = `We see ${fmtMoney(currentMonthly!)}/mo but ${gpuCount}× ${family === "other" ? "GPU" : family} doesn't quite add up to that — could be a managed-service line item or a mixed bill. Confirm the GPU count for an exact number.`;
  } else if (savingsPct !== null && savingsPct >= 20 && isBatchFriendly) {
    advice = `${workloadObj?.label ?? "This workload"} can tolerate interruptions, so it's a good fit to move to ${getMeta(recommendation.provider).short} at ${fmtP(floorRatePerHour)}/hr. Leave anything latency-sensitive where it is.`;
  } else if (savingsPct !== null && savingsPct >= 10) {
    advice = `That gap is real money.${!isBatchFriendly ? " This workload is latency-sensitive, so don't just move it — " : " "}Lock in reserved pricing first, then move when you're ready.`;
  } else if (savingsPct !== null) {
    advice = `You're already paying close to the best price for ${family === "other" ? "this GPU" : family}. The bigger opportunity now is using more of what you're paying for, not switching providers.`;
  } else if (!baseline) {
    advice = `We don't have ${situation} prices for ${family === "other" ? "this GPU" : family} yet. Run the full audit and we'll find region-specific options.`;
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
function FamilySpreadChart({ listings, family, currentRatePerHour, floorRate, floorProviderShort, bare }: {
  listings: GpuListing[]; family: GpuFamily; currentRatePerHour: number; floorRate: number; floorProviderShort: string; bare?: boolean;
}) {
  if (family === "other") return null;
  const fam = listings.filter(l => l.gpu_model.toUpperCase().includes(family));
  if (fam.length < 2) return null;

  // Aggregate per provider. Track the overall price band AND a separate
  // "reliable" minimum that excludes spot — a provider is only treated as a
  // reliable floor candidate on a non-spot, high-availability listing. Without
  // this, an interruptible spot rate leaks in as the provider's floor price.
  const byProvider: Record<string, { min: number; max: number; cat: string; reliable: boolean; reliableMin: number | null }> = {};
  fam.forEach(l => {
    const m = getMeta(l.provider);
    const k = m.short;
    const p = l.price_per_hour;
    const isReliableListing = l.availability === "high" && l.pricing_type !== "spot";
    if (!byProvider[k]) {
      byProvider[k] = { min: p, max: p, cat: m.cat, reliable: isReliableListing, reliableMin: isReliableListing ? p : null };
    } else {
      byProvider[k].min = Math.min(byProvider[k].min, p);
      byProvider[k].max = Math.max(byProvider[k].max, p);
      byProvider[k].reliable = byProvider[k].reliable || isReliableListing;
      if (isReliableListing) byProvider[k].reliableMin = byProvider[k].reliableMin == null ? p : Math.min(byProvider[k].reliableMin!, p);
    }
  });
  const all = Object.entries(byProvider).map(([name, v]) => ({ name, ...v })).sort((a, b) => a.min - b.min);
  if (all.length < 2) return null;

  // How many clouds price below the customer's effective rate — the headline of the chart.
  const cheaperCount = all.filter(p => p.min < currentRatePerHour).length;

  // Render the cheapest ~7 providers, then ensure the customer marker has a home.
  type Row = { name: string; min: number; max: number; cat: string; reliable: boolean; reliableMin: number | null; you?: boolean };
  const shown: Row[] = all.slice(0, 7);
  const youRow: Row = { name: "Your bill", min: currentRatePerHour, max: currentRatePerHour, cat: "You", reliable: false, reliableMin: null, you: true };
  const rows: Row[] = [...shown, youRow].sort((a, b) => a.min - b.min);

  const scaleMax = Math.max(...rows.map(r => r.max), currentRatePerHour) * 1.06;
  const pct = (v: number) => Math.max(0, Math.min(100, (v / scaleMax) * 100));
  const youPos = pct(currentRatePerHour);
  const catColor = (cat: string) =>
    cat === "Hyperscaler" ? "var(--amber)" : cat === "Neocloud" ? "var(--blue)" : cat === "Marketplace" ? "var(--violet)" : "var(--text-muted)";

  return (
    <div style={bare
      ? { background: "var(--panel)", padding: "18px 22px 16px" }
      : { background: "var(--panel)", border: "1px solid var(--border)", borderTop: "none", padding: "18px 22px 16px", marginBottom: 1 }
    }>
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
        {/* prominent red dashed divider dropping straight down from the customer's
            rate marker, through every provider row, to maximise visual contrast */}
        <div style={{ position: "absolute" as const, left: "96px", right: "56px", top: 0, bottom: 0, pointerEvents: "none" as const, zIndex: 2 }}>
          <div style={{ position: "absolute" as const, left: `${youPos}%`, top: 0, bottom: 0, borderLeft: "2px dashed rgba(155,28,28,0.55)" }} />
        </div>

        {rows.map(r => {
          const isFloor = !r.you && r.reliable && r.name === floorProviderShort;
          const cc = r.you ? "var(--red)" : catColor(r.cat);
          // For the floor row, show the reliable (non-spot) price — never a spot
          // leak. floorRate is the engine's authoritative reliable floor.
          const displayMin = isFloor ? (r.reliableMin ?? floorRate) : r.min;
          const barLeft = pct(displayMin);
          const barWidth = isFloor ? 0.8 : Math.max(pct(r.max) - pct(r.min), 0.8);
          return (
            <div key={r.name + (r.you ? "_you" : "")} style={{ display: "grid", gridTemplateColumns: "96px 1fr 56px", gap: 12, alignItems: "center", height: (r.you || (!r.you && r.reliable && r.name === floorProviderShort)) ? 34 : 22, position: "relative" as const, zIndex: 1 }}>
              <div style={{ display: "flex", flexDirection: "column" as const, justifyContent: "center", gap: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: r.you ? 3 : 2, height: r.you ? 14 : 11, background: cc, flexShrink: 0 }} />
                  <span style={{ ...SANS, fontSize: 12, color: r.you ? "var(--red)" : isFloor ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: r.you || isFloor ? 600 : 400, whiteSpace: "nowrap" as const }}>
                    {r.you ? "Your rate" : r.name}
                  </span>
                  {isFloor && <span style={{ ...MONO, fontSize: 8.5, color: "var(--green)", background: "rgba(39,103,73,0.08)", border: "1px solid rgba(39,103,73,0.25)", padding: "0 4px", borderRadius: 2 }}>floor</span>}
                </div>
                {(r.you || isFloor) && (
                  <span style={{ ...SANS, fontSize: 8.5, color: "var(--text-muted)", whiteSpace: "nowrap" as const, paddingLeft: r.you ? 9 : 8, lineHeight: 1.2 }}>
                    {r.you ? "On-demand / pay-as-you-go" : "Committed / reliable-availability floor"}
                  </span>
                )}
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
              <span style={{ ...MONO, fontSize: 12, textAlign: "right" as const, fontWeight: r.you || isFloor ? 600 : 400, color: r.you ? "var(--red)" : isFloor ? "var(--green)" : "var(--text-secondary)" }}>{fmtP(displayMin)}</span>
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
          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{cheaperCount} cloud{cheaperCount !== 1 ? "s" : ""}</span> {cheaperCount !== 1 ? "sell" : "sells"} {family} cheaper than the <span style={{ ...MONO, color: "var(--red)", fontWeight: 600 }}>{fmtP(currentRatePerHour)}/hr</span> you're paying. The best price right now is <span style={{ ...MONO, color: "var(--green)", fontWeight: 600 }}>{fmtP(floorRate)}/hr</span>{floorProviderShort ? ` (${floorProviderShort})` : ""}.
        </div>
      )}
    </div>
  );
}

// Fire-and-forget: logs the anonymized, normalized economics for this result
// to audit_observations. Never blocks or surfaces errors to the visitor.
function logAuditObservation(payload: {
  input_mode: "describe" | "bill" | "manual";
  gpu_type: string;
  current_provider?: string;
  region?: string;
  pricing_type?: string;
  effective_rate_usd_hr?: number | null;
  gpu_count: number;
  monthly_spend_usd?: number | null;
  workload_class: string;
  reliable_floor_usd_hr: number;
  overpay_pct?: number | null;
  recommended_provider?: string;
  recommended_rate_usd_hr?: number | null;
}) {
  try {
    fetch("/api/audit-observation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, session_id: getClientSessionId() }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* never block the UI on telemetry */ }
}

// Fire-and-forget: §4 funnel instrumentation events.
function logEvent(event_name: string, kind?: string, meta?: Record<string, unknown>) {
  try {
    fetch("/api/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_name, kind, meta, session_id: getClientSessionId() }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* never block the UI on telemetry */ }
}

function ResultSection({ r, family, gpuCount, hours, situation, workload, label, billActualSpend, billProvider, listings, inputMode, isDemoState, compact }: {
  r: ComputedResult; family: GpuFamily; gpuCount: number; hours: number;
  situation: Situation; workload: WorkloadType; label?: string;
  billActualSpend?: number; billProvider?: string; listings?: GpuListing[];
  inputMode: "describe" | "bill" | "manual";
  // isDemoState: true while this result reflects the unedited, pre-filled
  // market example rather than a real user-entered setup. Per the hero
  // calculator brief: no telemetry writes and no lead-capture submissions
  // are allowed to fire while this is true — it's the same "fabricated,
  // not real" situation the old static DemoAuditPreview was in.
  isDemoState?: boolean;
  // compact: smaller shell for the /market-data hero stat tile — headline
  // number only, no chart, no CTA capture panel.
  compact?: boolean;
}) {
  const { baseline, recommendation, isReliable, currentMonthly, recommendedMonthly, savings, savingsPct, annualSavings, currentRatePerHour, floorRatePerHour, sizingSuspect, reliabilityRisk, isBatchFriendly, workloadLabel, advice } = r;
  const hasGap = !!(savings && savingsPct && annualSavings);

  // Compact-mode font scale — same headline logic/copy, smaller shell.
  const bigNum   = compact ? 22 : 40;
  const bigSub   = compact ? 10 : 18;
  const bodyFont = compact ? 11.5 : 14;
  const labelFont = compact ? 10 : 12;
  const cardPad  = compact ? "12px 14px" : "20px 24px";

  // The premium over the reliable floor, expressed as a percent of the floor rate.
  // Dynamic: derived from the customer's own effective rate vs the live floor —
  // never hardcoded. e.g. paying $2.12 against a $0.73 floor reads as +190%.
  const premiumOverFloorPct =
    currentRatePerHour != null && floorRatePerHour > 0
      ? Math.round((currentRatePerHour / floorRatePerHour - 1) * 100)
      : null;
  const providerLabel = billProvider ?? getMeta(baseline?.provider ?? recommendation.provider).short;
  const floorProviderLabel = getMeta(recommendation.provider).short;

  let headline: React.ReactNode;
  if (hasGap) {
    headline = (
      <>
        <span style={{ ...SANS, fontSize: labelFont, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", width: "100%", marginBottom: 4 }}>
          You could save:
        </span>
        <span style={{ ...MONO, fontSize: bigNum, fontWeight: 700, color: "var(--red)", letterSpacing: "-0.03em", lineHeight: 1 }}>
          {fmtBigMoney(annualSavings!)}<span style={{ fontSize: bigSub, color: "var(--text-muted)", fontWeight: 400 }}>/yr</span>
        </span>
        <span style={{ ...SANS, fontSize: bodyFont, color: "var(--text-secondary)", marginLeft: compact ? 8 : 12, alignSelf: "flex-end" as const, lineHeight: 1.5 }}>
          {currentRatePerHour != null ? (
            <>
              You're paying <span style={{ ...MONO, color: "var(--red)", fontWeight: 600 }}>{fmtP(currentRatePerHour)}/hr</span>
              {premiumOverFloorPct != null && premiumOverFloorPct > 0 ? <>, which is <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{premiumOverFloorPct}% more</span></> : ", more"} than the best available price for the same {family === "other" ? "GPU" : family} setup right now.
            </>
          ) : (
            <>That's {savingsPct}% of your {family === "other" ? "GPU" : family} bill — same GPUs, same hours, at a price other providers already offer.</>
          )}
        </span>
      </>
    );
  } else if (sizingSuspect && currentMonthly) {
    headline = (
      <span style={{ ...SANS, fontSize: bodyFont + 1, color: "var(--text-secondary)" }}>
        We see <span style={{ ...MONO, color: "var(--text-primary)", fontWeight: 600 }}>{fmtMoney(currentMonthly)}/mo</span>, but that doesn't quite match the GPU count you gave us. Double-check your setup below and we'll pin down the exact number.
      </span>
    );
  } else if (currentMonthly) {
    headline = (
      <span style={{ ...SANS, fontSize: bodyFont + 1, color: "var(--text-secondary)" }}>
        You're already paying close to the best available rate for {family === "other" ? "GPU" : family}. Switching providers won't save much — the bigger win here is using what you're paying for more fully.
      </span>
    );
  } else {
    headline = (
      <span style={{ ...SANS, fontSize: bodyFont + 1, color: "var(--text-secondary)" }}>
        Tell us who you're with now and we'll size the savings — we don't have a {situation} price to compare for {family === "other" ? "this GPU" : family} yet.
      </span>
    );
  }

  // Log the observation + the overpay_shown event once per rendered result —
  // re-fires whenever any input to the logged payload changes. Skipped
  // entirely while isDemoState — a live, unedited market example is not a
  // real user input and must never be written to audit_observations/events.
  useEffect(() => {
    if (isDemoState) return;
    logAuditObservation({
      input_mode: inputMode,
      gpu_type: family === "other" ? "other" : family,
      current_provider: providerLabel,
      pricing_type: recommendation.pricing_type,
      region: recommendation.region,
      effective_rate_usd_hr: currentRatePerHour ?? undefined,
      gpu_count: gpuCount,
      monthly_spend_usd: currentMonthly ?? undefined,
      workload_class: workload,
      reliable_floor_usd_hr: floorRatePerHour,
      overpay_pct: premiumOverFloorPct ?? (savingsPct ?? undefined),
      recommended_provider: floorProviderLabel,
      recommended_rate_usd_hr: floorRatePerHour,
    });
    logEvent("audit_run", inputMode);
    if (hasGap) logEvent("overpay_shown");
  }, [family, gpuCount, currentRatePerHour, floorRatePerHour, currentMonthly, situation, workload, inputMode, hasGap, providerLabel, premiumOverFloorPct, savingsPct, isDemoState]);

  // ── "Start my move" capture (primary, performance-based) ──
  const [moveOpen, setMoveOpen]       = useState(false);
  const [moveEmail, setMoveEmail]     = useState("");
  const [moveConsent, setMoveConsent] = useState(false);
  const [moveLoading, setMoveLoading] = useState(false);
  const [moveError, setMoveError]     = useState("");
  const [moveDone, setMoveDone]       = useState(false);
  const [demoPromptMove, setDemoPromptMove] = useState(false);

  const openMove = () => {
    // Guard: clicking the primary CTA while still on the untouched, prefilled
    // example must never open the real capture form — it would let a demo
    // click write to `engagements`. Surface a one-line nudge instead.
    if (isDemoState) { setDemoPromptMove(true); return; }
    setMoveOpen(true); setMoveError(""); logEvent("move_with_us_click");
  };

  const submitMove = async () => {
    if (!moveEmail || !moveEmail.includes("@")) { setMoveError("Enter a valid work email."); return; }
    if (!moveConsent) { setMoveError("Consent is required to proceed."); return; }
    setMoveError(""); setMoveLoading(true);
    try {
      const res = await fetch("/api/engagement", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "savings_share",
          session_id: getClientSessionId(),
          email: moveEmail,
          current_provider: providerLabel,
          gpu_type: family === "other" ? "other" : family,
          est_monthly_spend_usd: currentMonthly ?? undefined,
          est_annual_savings_usd: annualSavings ?? undefined,
          target_provider: floorProviderLabel,
          consent: moveConsent,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Something went wrong.");
      setMoveDone(true); setMoveOpen(false);
    } catch (e: any) { setMoveError(e?.message ?? "Network error — try again."); }
    finally { setMoveLoading(false); }
  };

  // ── "Notify me" capture (retention, demoted) ──
  const [monitorOpen, setMonitorOpen]   = useState(false);
  const [monitorEmail, setMonitorEmail] = useState("");
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [monitorError, setMonitorError] = useState("");
  const [monitorDone, setMonitorDone]   = useState(false);
  const [demoPromptMonitor, setDemoPromptMonitor] = useState(false);

  const openMonitor = () => {
    if (isDemoState) { setDemoPromptMonitor(true); return; }
    setMonitorOpen(true); setMonitorError(""); logEvent("monitor_click");
  };

  const submitMonitor = async () => {
    if (!monitorEmail || !monitorEmail.includes("@")) { setMonitorError("Enter a valid work email."); return; }
    setMonitorError(""); setMonitorLoading(true);
    try {
      const res = await fetch("/api/engagement", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "monitor",
          session_id: getClientSessionId(),
          email: monitorEmail,
          current_provider: providerLabel,
          gpu_type: family === "other" ? "other" : family,
          est_monthly_spend_usd: currentMonthly ?? undefined,
          est_annual_savings_usd: annualSavings ?? undefined,
          target_provider: floorProviderLabel,
          consent: true,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Something went wrong.");
      setMonitorDone(true); setMonitorOpen(false);
      // "Watch my bill" now also covers routing-beta interest (folded from the separate
      // roadmap-line signup) — fire-and-forget, never blocks or surfaces errors to the visitor.
      post(buildNotes("EARLY_ACCESS_ROUTING_BETA")).catch(() => {});
    } catch (e: any) { setMonitorError(e?.message ?? "Network error — try again."); }
    finally { setMonitorLoading(false); }
  };

  const handleSelfServeClick = () => { if (!isDemoState) logEvent("self_serve_click", undefined, { provider: floorProviderLabel }); };

  const inputStyleLocal: React.CSSProperties = {
    ...SANS, width: "100%", background: "rgba(247,243,234,0.06)", border: "1px solid rgba(247,243,234,0.22)",
    color: "#F7F3EA", padding: "10px 12px", fontSize: 13, outline: "none", borderRadius: 3,
  };

  return (
    <div style={{ marginBottom: 2 }}>
      {label && (
        <div style={{ ...MONO, fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 6 }}>
          {label}
        </div>
      )}
      {isDemoState && (
        <div style={{
          ...SANS, fontSize: 9.5, fontWeight: 650, color: "var(--amber)",
          textTransform: "uppercase" as const, letterSpacing: "0.08em",
          border: "1px solid var(--border-mid)", padding: "2px 7px", borderRadius: 3,
          display: "inline-block", marginBottom: 6,
        }}>
          Demo · Live Market Prices
        </div>
      )}
      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderTop: `3px solid ${hasGap ? "var(--red)" : "var(--border-mid)"}`, padding: cardPad, marginBottom: compact ? 0 : 1, display: "flex", alignItems: "baseline", flexWrap: "wrap" as const, gap: compact ? 2 : 4 }}>
        {headline}
      </div>
      {!compact && hasGap && currentRatePerHour != null ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 1, background: "var(--border)", border: "1px solid var(--border)", borderTop: "none", alignItems: "stretch" }}>

          {/* Left: chart */}
          <div style={{ background: "var(--panel)" }}>
            <FamilySpreadChart
              listings={listings ?? []}
              family={family}
              currentRatePerHour={currentRatePerHour}
              floorRate={floorRatePerHour}
              floorProviderShort={floorProviderLabel}
              bare
            />
          </div>

          {/* Right: move copy + CTA, one cohesive block */}
          <div style={{ background: "#171717", padding: "20px 20px 22px", display: "flex", flexDirection: "column" as const, gap: 14 }}>
            <div style={{ ...SANS, fontSize: 13, color: "rgba(247,243,234,0.9)", lineHeight: 1.55 }}>
              We'll move this to <strong style={{ color: "#F7F3EA" }}>{floorProviderLabel}</strong> at{" "}
              <span style={{ ...MONO, color: "var(--green)", fontWeight: 600 }}>{fmtP(floorRatePerHour)}/hr</span> — save ~
              <span style={{ ...MONO, color: "var(--green)", fontWeight: 600 }}>{fmtBigMoney(annualSavings!)}/yr</span>.{" "}
              <span style={{ color: "rgba(247,243,234,0.6)" }}>Performance-based, you only pay from savings.</span>
            </div>

            {!moveDone ? (
              !moveOpen ? (
                <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
                  <button
                    type="button"
                    onClick={openMove}
                    style={{
                      ...SANS, fontSize: 13.5, fontWeight: 600, color: "#171717", background: "#F7F3EA",
                      padding: "12px 16px", borderRadius: 3, border: "none", cursor: "pointer", letterSpacing: "0.01em",
                      width: "100%",
                    }}
                  >
                    Start My Move →
                  </button>
                  <a
                    href={referralUrl(recommendation.provider)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleSelfServeClick}
                    style={{
                      ...SANS, fontSize: 13.5, fontWeight: 600, color: "#F7F3EA", background: "transparent",
                      padding: "12px 16px", borderRadius: 3, border: "1px solid #F7F3EA", cursor: "pointer",
                      letterSpacing: "0.01em", textDecoration: "none", display: "flex", alignItems: "center",
                      justifyContent: "center", width: "100%", boxSizing: "border-box" as const,
                    }}
                  >
                    Move It Yourself →
                  </a>
                  {demoPromptMove && (
                    <div style={{ ...SANS, fontSize: 11.5, color: "rgba(247,243,234,0.6)", lineHeight: 1.5 }}>
                      Adjust the numbers above to match your setup first.
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                  <input type="email" placeholder="you@company.com" value={moveEmail} onChange={e => setMoveEmail(e.target.value)} style={inputStyleLocal} />
                  <label style={{ ...SANS, fontSize: 11.5, color: "rgba(247,243,234,0.6)", display: "flex", alignItems: "flex-start" as const, gap: 7, lineHeight: 1.5 }}>
                    <input type="checkbox" checked={moveConsent} onChange={e => setMoveConsent(e.target.checked)} style={{ marginTop: 2 }} />
                    I consent to AIInfraWatch contacting me about moving this workload. We'll help coordinate the move — terms confirmed off-page, no automated provisioning.
                  </label>
                  <button onClick={submitMove} disabled={moveLoading} style={{
                    ...SANS, fontSize: 13, fontWeight: 600, color: "#171717", background: moveLoading ? "rgba(247,243,234,0.5)" : "#F7F3EA",
                    padding: "11px 18px", borderRadius: 3, border: "none", cursor: moveLoading ? "not-allowed" : "pointer",
                  }}>{moveLoading ? "Submitting…" : "Confirm — Start My Move"}</button>
                  {moveError && <p style={{ ...SANS, fontSize: 12, color: "#F2B5B5", margin: 0 }}>{moveError}</p>}
                </div>
              )
            ) : (
              <div style={{ ...SANS, fontSize: 13, color: "var(--green)", lineHeight: 1.55 }}>
                ✓ Got it — we'll reach out to scope the move and confirm terms.
              </div>
            )}

            {/* RETENTION — monitoring, demoted */}
            <div style={{ paddingTop: 14, borderTop: "1px solid rgba(247,243,234,0.1)" }}>
              {monitorDone ? (
                <div style={{ ...SANS, fontSize: 12, color: "var(--green)" }}>✓ We'll watch your bill and alert you.</div>
              ) : !monitorOpen ? (
                <div style={{ ...SANS, fontSize: 12, color: "rgba(247,243,234,0.55)" }}>
                  Watch my bill — we'll alert you when you're overpaying.{" "}
                  <button onClick={openMonitor} style={{ ...SANS, fontSize: 12, color: "var(--blue)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                    Notify Me
                  </button>
                  {demoPromptMonitor && (
                    <div style={{ ...SANS, fontSize: 11.5, color: "rgba(247,243,234,0.6)", marginTop: 6, lineHeight: 1.5 }}>
                      Adjust the numbers above to match your setup first.
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                  <input type="email" placeholder="you@company.com" value={monitorEmail} onChange={e => setMonitorEmail(e.target.value)}
                    style={inputStyleLocal} />
                  <button onClick={submitMonitor} disabled={monitorLoading} style={{
                    ...SANS, fontSize: 12, fontWeight: 600, color: "var(--blue)", background: "transparent",
                    border: "1px solid var(--blue)", padding: "8px 14px", borderRadius: 3, cursor: monitorLoading ? "not-allowed" : "pointer",
                    width: "100%",
                  }}>{monitorLoading ? "Submitting…" : "Notify Me"}</button>
                  {monitorError && <p style={{ ...SANS, fontSize: 11.5, color: "#F2B5B5", margin: 0 }}>{monitorError}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        !compact && !hasGap && advice && (
          <div style={{ background: "#171717", border: "1px solid #171717", borderTop: "none", padding: "16px 24px 18px" }}>
            <div style={{ ...SANS, fontSize: 12.5, color: "rgba(247,243,234,0.7)", lineHeight: 1.6 }}>{advice}</div>
          </div>
        )
      )}
    </div>
  );
}

/* ── Default workload row factory ── */
let _nextId = 1;
const newRow = (prefill?: Partial<Pick<WorkloadRow, "family" | "gpuCountStr" | "hoursStr" | "situation" | "workload">>): WorkloadRow => ({
  id: _nextId++,
  family: prefill?.family ?? "H100",
  gpuCountStr: prefill?.gpuCountStr ?? "8",
  hoursStr: prefill?.hoursStr ?? "720",
  situation: prefill?.situation ?? "hyperscaler",
  workload: prefill?.workload ?? "evals",
});

// Builds the initial manual-tab row from the SAME live-market computation the
// homepage ticker/AuditStatStrip/old DemoAuditPreview all shared —
// computeMarketStats() → computeDemoExample() — never a hardcoded number.
// Falls back to the function's own sane defaults (8 GPUs / 720 hrs) only when
// there's no positive premium to derive a prefill from right now.
function buildDemoRow(listings: GpuListing[]): WorkloadRow {
  const stats = computeMarketStats(listings);
  const demo = computeDemoExample(stats);
  return newRow({
    family: "H100",
    gpuCountStr: demo ? String(demo.gpuCount) : undefined,
    hoursStr: demo ? String(demo.hoursPerMonth) : undefined,
    situation: "hyperscaler",
  });
}

export default function AuditTool({ listings, compact = false }: AuditToolProps) {
  // ── sessionStorage helpers (all access client-side only; skipped entirely
  // in compact mode — a hero-tile instance must never read or clobber the
  // full-page audit tool's persisted state) ─────────────────────────────────
  const SS_KEY = "aiw_audit_state";
  const ssRead = () => {
    if (compact || typeof window === "undefined") return null;
    try { const r = sessionStorage.getItem(SS_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
  };
  const ssWrite = (data: Record<string, unknown>) => {
    if (compact || typeof window === "undefined") return;
    try { sessionStorage.setItem(SS_KEY, JSON.stringify(data)); } catch { /* quota / private */ }
  };
  // ─────────────────────────────────────────────────────────────────────────

  // Single-input model: tabs removed from UI. activeTab stays as an internal
  // enum for the bill-upload code path; setupText is prefilled with a live
  // demo example so results render on first paint without any interaction.
  const DEMO_TEXT = "8x H100 on AWS, 720 hrs/mo, training";
  const [activeTab,      setActiveTab]      = useState<InputTab>(() => { const s = ssRead(); return (s?.activeTab as InputTab) ?? "describe"; });
  const [setupText,      setSetupText]      = useState<string>(() => ssRead()?.setupText ?? DEMO_TEXT);
  const [billFileName,     setBillFileName]     = useState<string | null>(() => ssRead()?.billFileName ?? null);
  const [billFile,         setBillFile]         = useState<File | null>(null); // File not serializable — never persisted
  const [billExtracting,   setBillExtracting]   = useState(false);
  const [billExtractError, setBillExtractError] = useState<string | null>(null);
  const [billExtracted,    setBillExtracted]    = useState<{
    family: string; gpuCount: number; hoursPerMonth: number;
    situation: string; workload: string; monthlySpend: number;
    provider: string; confidence: string;
  } | null>(() => ssRead()?.billExtracted ?? null);
  const [rows,           setRows]           = useState<WorkloadRow[]>(() => ssRead()?.rows ?? [buildDemoRow(listings)]);
  const [committed,      setCommitted]      = useState<boolean>(() => ssRead()?.committed ?? true);
  const [wantsAlerts,    setWantsAlerts]    = useState(true);

  // userEdited: flips true when the visitor edits the text or uploads a file.
  // While false, the on-screen result is a demo derived from live market data —
  // real numbers, but not user input. Prevents funnel logging on demo state
  // (see ResultSection's isDemoState guard).
  const [manualTouched,  setManualTouched]  = useState<boolean>(() => ssRead()?.manualTouched ?? false);

  // Results render into a page-level portal target (#audit-results-portal) so they can sit
  // full-width below the hero instead of being trapped in the narrow input column. Falls back
  // to inline rendering (null-safe — portal only fires once the node exists) if the target
  // isn't present, e.g. if AuditTool is ever used somewhere without the portal div. Not used
  // in compact mode — the compact tile renders its result inline, in place.
  const [resultsPortalNode, setResultsPortalNode] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (compact) return;
    setResultsPortalNode(document.getElementById("audit-results-portal"));
  }, [compact]);

  // Persist audit state whenever the fields that matter change. Skipped in
  // compact mode (see SS_KEY note above).
  // useRef guards against writing on the very first render (no-op — just read back what we wrote).
  const mountedRef = useRef(false);
  useEffect(() => {
    if (compact) return;
    if (!mountedRef.current) { mountedRef.current = true; return; }
    ssWrite({ activeTab, setupText, billFileName, billExtracted, rows, committed, manualTouched });
  }, [activeTab, setupText, billFileName, billExtracted, rows, committed, manualTouched, compact]);

  const parsed    = useMemo(() => parseStackText(setupText), [setupText]);
  const hasText   = setupText.trim().length > 0;
  const hasUpload = !!billFileName;

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

  const showGuard = activeTab === "describe" && hasText && !primarySnapshot.hasFamily;

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
    !showGuard
      ? computeResult(listings, primarySnapshot.family, primarySnapshot.gpuCount, primarySnapshot.hours, primarySnapshot.situation, primarySnapshot.workload)
      : null,
  [showGuard, listings, primarySnapshot]);

  // Auto-render: no "committed" gate. As soon as there's parseable input,
  // results appear.
  const showTextResult   = !compact && activeTab === "describe" && hasText && !showGuard && !!primaryResult;
  const showManualResult = compact && rows.length > 0 && manualResults.some(r => !!r.result);
  const showUploadResult = !compact && activeTab === "bill" && hasUpload;
  const showResult       = showTextResult || showManualResult || showUploadResult;

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
    const flags = [wantsAlerts ? "wantsAlerts:true" : "wantsAlerts:false", extra ?? null].filter(Boolean).join(" · ");
    if (flags) lines.push(flags);
    return lines.filter(Boolean).join("\n\n");
  };

  const post = async (notes: string) => {
    const res = await fetch("/api/audit-request", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "", monthlySpend: "Unknown / audit needed", workload: primarySnapshot.workload, notes, source: "cost-audit" }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error ?? "Something went wrong.");
  };


  // ── Compact shell (used inside the /market-data hero stat strip) ──
  // Same computeResult()/prefill/touched-gating as the full tool above —
  // deliberately NOT a separate copy of that logic — just a much smaller
  // input row and no chart/CTA panel. See brief §4.
  if (compact) {
    const updateRow = (id: number, patch: Partial<WorkloadRow>) => {
      setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));
      setManualTouched(true);
    };
    const compactSelectStyle: React.CSSProperties = {
      ...inputStyle, padding: "7px 8px", fontSize: 12.5, appearance: "auto",
    };
    const compactNumStyle: React.CSSProperties = {
      ...inputStyle, padding: "7px 8px", fontSize: 12.5,
    };
    const compactLabel: React.CSSProperties = {
      ...SANS, fontSize: 9, fontWeight: 600, color: "var(--text-muted)",
      textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 3, display: "block",
    };
    const row = rows[0];
    const compactResult = manualResults[0]?.result ?? null;
    return (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 64px 72px", gap: 8, marginBottom: 10 }}>
          <div>
            <label style={compactLabel}>GPU</label>
            <select value={row.family} onChange={e => updateRow(row.id, { family: e.target.value as GpuFamily })} style={compactSelectStyle}>
              {(["H100", "A100", "L40S", "A10G"] as GpuFamily[]).map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label style={compactLabel}>Count</label>
            <input type="number" min={1} value={row.gpuCountStr}
              onChange={e => updateRow(row.id, { gpuCountStr: e.target.value })}
              onBlur={() => updateRow(row.id, { gpuCountStr: String(parseNum(row.gpuCountStr, 1)) })}
              style={compactNumStyle} />
          </div>
          <div>
            <label style={compactLabel}>Hrs/mo</label>
            <input type="number" min={1} max={8760} value={row.hoursStr}
              onChange={e => updateRow(row.id, { hoursStr: e.target.value })}
              onBlur={() => updateRow(row.id, { hoursStr: String(parseNum(row.hoursStr, 720)) })}
              style={compactNumStyle} />
          </div>
        </div>
        {compactResult && (
          <ResultSection
            r={compactResult}
            family={row.family}
            gpuCount={parseNum(row.gpuCountStr, 8)}
            hours={parseNum(row.hoursStr, 720)}
            situation={row.situation}
            workload={row.workload}
            listings={listings}
            inputMode="manual"
            isDemoState={!manualTouched}
            compact
          />
        )}
      </div>
    );
  }

  return (
    <div>

      {/* ── Input card ── */}
      <div style={{ marginBottom: 16 }}>

        {/* Single unified input surface — no tabs. Textarea prefilled with a
            live demo example so results appear on first paint. Inline upload
            link swaps to a bill-uploaded state that auto-fires extraction. */}
        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: "20px 24px" }}>

          {billFileName ? (
            /* ── Bill uploaded state ── */
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ ...MONO, fontSize: 13, color: "var(--green)" }}>✓</span>
                <span style={{ ...SANS, fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>{billFileName}</span>
                {billExtracting && <span style={{ ...SANS, fontSize: 12, color: "var(--text-muted)" }}>reading…</span>}
                <button
                  onClick={() => {
                    setBillFileName(null); setBillFile(null); setBillExtracted(null); setBillExtractError(null);
                    setActiveTab("describe");
                  }}
                  style={{ ...SANS, fontSize: 12, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0, marginLeft: "auto", textDecoration: "underline" }}
                >
                  Use text instead
                </button>
              </div>
              {billExtractError && (
                <div style={{ ...SANS, fontSize: 12.5, color: "var(--red)", marginTop: 6, lineHeight: 1.5 }}>{billExtractError}</div>
              )}
            </div>
          ) : (
            /* ── Text input state (default) ── */
            <div>
              <div style={{ position: "relative" as const }}>
                <textarea
                  value={setupText}
                  onChange={e => { setSetupText(e.target.value); setManualTouched(true); }}
                  placeholder="e.g. 8x H100 on AWS, 720 hrs/mo, training"
                  rows={4}
                  style={{
                    ...inputStyle, minHeight: 96, resize: "vertical", lineHeight: 1.55,
                    border: "1px solid var(--border-mid)", background: "var(--panel)",
                  }}
                />
              </div>

              <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" as const, gap: 8 }}>
                <label style={{
                  ...SANS, fontSize: 12.5, color: "var(--blue)", cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "underline",
                }}>
                  <input
                    type="file"
                    accept=".csv,.pdf,.xlsx,.xls"
                    style={{ display: "none" }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setBillFileName(file.name); setBillFile(file);
                      setBillExtracted(null); setBillExtractError(null);
                      setActiveTab("bill"); setManualTouched(true);
                      // Auto-fire extraction — no separate Run button.
                      setBillExtracting(true);
                      try {
                        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
                        let body: any;
                        if (isPdf) {
                          const ab = await file.arrayBuffer();
                          const bytes = new Uint8Array(ab);
                          let bin = "";
                          const CHUNK = 8192;
                          for (let i = 0; i < bytes.length; i += CHUNK) {
                            bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
                          }
                          body = { base64: btoa(bin), mediaType: "application/pdf", fileName: file.name };
                        } else {
                          const text = await file.text();
                          body = { text, fileName: file.name };
                        }
                        const res = await fetch("/api/extract-bill", {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(body),
                        });
                        const json = await res.json();
                        if (json.success && json.data) {
                          setBillExtracted(json.data);
                        } else if (json.error === "no_gpu_found") {
                          setBillExtractError("No GPU line items found — try describing your setup as text.");
                        } else {
                          if (json.detail) console.error("[extract-bill]", json.error, json.detail);
                          setBillExtractError("Could not read this file — try a CSV export or describe as text.");
                        }
                      } catch {
                        setBillExtractError("Network error — try again.");
                      } finally {
                        setBillExtracting(false);
                      }
                    }}
                  />
                  📎 or upload a bill
                </label>

                <div style={{ ...SANS, fontSize: 11, color: "var(--text-muted)" }}>
                  Never saved · <a href="/privacy" style={{ color: "var(--text-muted)", textDecoration: "underline" }}>Privacy</a>
                </div>
              </div>

              {/* Parsed terms — confirmation the parser understood the input */}
              {hasText && parsed.matchedTerms.length > 0 && (
                <div style={{ marginTop: 12, display: "flex", gap: 5, flexWrap: "wrap" as const, alignItems: "center" }}>
                  <span style={{ ...MONO, fontSize: 9.5, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" as const, marginRight: 4 }}>
                    Parsed
                  </span>
                  {parsed.matchedTerms.map(term => (
                    <span key={term} style={{
                      ...MONO, fontSize: 10.5, color: "var(--blue)",
                      background: "rgba(43,108,176,0.08)",
                      border: "1px solid rgba(43,108,176,0.2)",
                      padding: "2px 7px", borderRadius: 2,
                    }}>
                      {term}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>{/* end input card wrapper */}

      {(() => {
        const guardAndResults = (
          <>
      {/* ── Guard ── */}
      {showGuard && (
        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderLeft: "3px solid var(--amber)", padding: "18px 24px", marginBottom: 16 }}>
          <div style={{ ...SANS, fontSize: 13.5, color: "var(--text-primary)", fontWeight: 600, marginBottom: 4 }}>Name a GPU to get your number.</div>
          <div style={{ ...SANS, fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
            Include a GPU family (H100, A100, L40S, A10G) in your description.
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {showResult && (
        <div id="audit-results" style={{ marginBottom: 16 }}>
          <div style={{ ...MONO, fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 10 }}>
            Results
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
                <div style={{ background: "var(--elevated)", border: "1px solid var(--border)", borderLeft: `3px solid ${accentColor}`, padding: "10px 16px", marginBottom: 12, display: "flex", alignItems: "center", flexWrap: "wrap" as const, gap: 6 }}>
                  {billExtracting ? (
                    <span style={{ ...SANS, fontSize: 13, color: "var(--text-muted)" }}>Reading your bill…</span>
                  ) : ex ? (
                    <span style={{ ...SANS, fontSize: 13, color: "var(--text-secondary)" }}>
                      <strong style={{ color: "var(--green)" }}>Your bill summary:</strong>{" "}
                      {ex.provider} · {ex.family} · {ex.gpuCount} GPU{ex.gpuCount !== 1 ? "s" : ""} · ${ex.monthlySpend.toLocaleString()}/mo
                      {ex.confidence !== "high" && (
                        <span style={{ color: "var(--text-muted)" }}> (best guess — double-check below)</span>
                      )}
                    </span>
                  ) : billExtractError ? (
                    <span style={{ ...SANS, fontSize: 13, color: "var(--text-secondary)" }}>
                      <strong style={{ color: "var(--amber)" }}>Couldn't read that file.</strong> {billExtractError} Try the Describe tab instead.
                    </span>
                  ) : (
                    <span style={{ ...SANS, fontSize: 13, color: "var(--text-secondary)" }}>Bill received — comparing it to today's prices…</span>
                  )}
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
                    inputMode="bill"
                  />
                )}
              </div>
            );
          })()}

          {showTextResult && primaryResult && (
            <ResultSection
              r={primaryResult}
              family={primarySnapshot.family}
              gpuCount={primarySnapshot.gpuCount}
              hours={primarySnapshot.hours}
              situation={primarySnapshot.situation}
              workload={primarySnapshot.workload}
              listings={listings}
              inputMode="describe"
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
                  inputMode="manual"
                  isDemoState={!manualTouched}
                />
              </div>
            ) : null
          )}
        </div>
      )}
          </>
        );
        return resultsPortalNode ? createPortal(guardAndResults, resultsPortalNode) : guardAndResults;
      })()}

      <style>{`
        @media (max-width: 760px) {
          .sandbox-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
