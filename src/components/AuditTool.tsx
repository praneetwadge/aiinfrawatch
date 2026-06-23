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

/* ── Result computation (pure) ── */
interface ComputedResult {
  baseline: GpuListing | null;
  recommendation: GpuListing;
  isReliable: boolean;
  currentMonthly: number | null;
  recommendedMonthly: number;
  savings: number | null;
  savingsPct: number | null;
  reliabilityRisk: "Low" | "Medium" | "High";
  isBatchFriendly: boolean;
  workloadLabel: string;
  advice: string;
}

function computeResult(
  listings: GpuListing[], family: GpuFamily, gpuCount: number, hours: number,
  situation: Situation, workload: WorkloadType,
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

  const currentMonthly     = baseline ? baseline.price_per_hour * gpuCount * hours : null;
  const recommendedMonthly = recommendation.price_per_hour * gpuCount * hours;
  const savings    = currentMonthly && currentMonthly > recommendedMonthly ? currentMonthly - recommendedMonthly : null;
  const savingsPct = currentMonthly && savings ? Math.round((savings / currentMonthly) * 100) : null;

  const workloadObj     = WORKLOAD_OPTIONS.find(w => w.value === workload);
  const isBatchFriendly = workloadObj?.batchFriendly ?? false;
  const reliabilityRisk = !isReliable ? "High" : capacityConfFromListings(familyListings) >= 60 ? "Low" : "Medium";

  let advice = "";
  if (savingsPct !== null && savingsPct >= 20 && isBatchFriendly) {
    advice = `Move ${workloadObj?.label.toLowerCase() ?? "this workload"} to ${getMeta(recommendation.provider).short} first — it's interruption-tolerant and the savings are material. Keep latency-critical production serving where it is.`;
  } else if (savingsPct !== null && savingsPct >= 10) {
    advice = `Savings are available but migration friction matters. Audit contract terms and reserved pricing before switching.${!isBatchFriendly ? " This workload type carries migration risk — move incrementally." : ""}`;
  } else if (savingsPct !== null) {
    advice = `You're near market floor for reliable ${family === "other" ? "GPU" : family}. Focus on utilisation and reserved pricing rather than provider switching.`;
  } else if (!baseline) {
    advice = `No ${situation} listings found for ${family === "other" ? "this GPU" : family} in the current snapshot. The full audit can surface region-specific options not in the daily index.`;
  }

  return {
    baseline, recommendation, isReliable, currentMonthly, recommendedMonthly,
    savings, savingsPct, reliabilityRisk, isBatchFriendly,
    workloadLabel: workloadObj?.label ?? "this workload", advice,
  };
}

/* ── Result display ── */
function ResultSection({ r, family, gpuCount, hours, situation, workload }: {
  r: ComputedResult; family: GpuFamily; gpuCount: number; hours: number;
  situation: Situation; workload: WorkloadType;
}) {
  const { baseline, recommendation, isReliable, currentMonthly, recommendedMonthly, savings, savingsPct, reliabilityRisk, isBatchFriendly, workloadLabel, advice } = r;

  // Headline number — the artifact.
  let headline: React.ReactNode;
  if (savings && savingsPct) {
    headline = (
      <>
        <span style={{ ...MONO, fontSize: 34, fontWeight: 600, color: "var(--green)", letterSpacing: "-0.03em" }}>
          ≈ {fmtMoney(savings)}/mo
        </span>
        <span style={{ ...SANS, fontSize: 14, color: "var(--text-secondary)", marginLeft: 10 }}>
          over market for this workload ({savingsPct}% above the cheapest {isReliable ? "reliable" : "observed"} option)
        </span>
      </>
    );
  } else if (currentMonthly) {
    headline = (
      <span style={{ ...SANS, fontSize: 15, color: "var(--text-secondary)" }}>
        You're at market floor for reliable {family === "other" ? "GPU" : family}. The win here is utilisation and reserved pricing, not switching providers.
      </span>
    );
  } else {
    headline = (
      <span style={{ ...SANS, fontSize: 15, color: "var(--text-secondary)" }}>
        Add your current provider to size the gap — we couldn't find a {situation} baseline for {family === "other" ? "this GPU" : family} in today's snapshot.
      </span>
    );
  }

  // Keep-in-place line — the differentiator made explicit.
  const keepLine = !isBatchFriendly && workload !== "unsure";

  return (
    <div>
      {/* Headline */}
      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderTop: `3px solid ${savings ? "var(--green)" : "var(--border-mid)"}`, padding: "20px 24px", marginBottom: 1, display: "flex", alignItems: "baseline", flexWrap: "wrap" as const, gap: 4 }}>
        {headline}
      </div>

      {/* Numbers grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", background: "var(--panel)", border: "1px solid var(--border)", borderTop: "none", marginBottom: 1 }} className="result-grid">
        {/* Current */}
        <div style={{ padding: "20px 24px", borderRight: "1px solid var(--border)" }}>
          <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 8 }}>
            {baseline ? `Est. current (${situation === "unsure" ? "hyperscaler assumed" : situation})` : "No baseline found"}
          </div>
          {currentMonthly ? (
            <>
              <div style={{ ...MONO, fontSize: 28, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1 }}>
                {fmtMoney(currentMonthly)}<span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 300 }}>/mo</span>
              </div>
              <div style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
                {getMeta(baseline!.provider).short} · {fmtP(baseline!.price_per_hour)}/hr × {gpuCount} GPU{gpuCount !== 1 ? "s" : ""} × {hours}h
              </div>
            </>
          ) : (
            <div style={{ ...SANS, fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>
              No {family === "other" ? "GPU" : family} listings for this provider type in the current snapshot.
            </div>
          )}
        </div>

        {/* Recommended */}
        <div style={{ padding: "20px 24px", borderRight: "1px solid var(--border)" }}>
          <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: isReliable ? "var(--green)" : "var(--amber)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 8 }}>
            {isReliable ? "Cheapest reliable" : "Cheapest observed"}
            {!isReliable && <span style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 400, background: "rgba(151,90,22,0.08)", border: "1px solid rgba(151,90,22,0.2)", padding: "1px 5px", borderRadius: 2 }}>observed only</span>}
          </div>
          <div style={{ ...MONO, fontSize: 28, fontWeight: 500, color: isReliable ? "var(--green)" : "var(--amber)", letterSpacing: "-0.03em", lineHeight: 1 }}>
            {fmtMoney(recommendedMonthly)}<span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 300 }}>/mo</span>
          </div>
          <div style={{ ...SANS, fontSize: 11.5, color: "var(--text-secondary)", marginTop: 6 }}>
            {getMeta(recommendation.provider).short} · {recommendation.gpu_model} · {fmtP(recommendation.price_per_hour)}/hr
          </div>
        </div>

        {/* Savings */}
        <div style={{ padding: "20px 24px", minWidth: 130, textAlign: "center" as const, background: savings && savingsPct && savingsPct >= 10 ? "rgba(39,103,73,0.06)" : "var(--bg)", display: "flex", flexDirection: "column" as const, justifyContent: "center" }}>
          <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 8 }}>Savings</div>
          {savings ? (
            <>
              <div style={{ ...MONO, fontSize: 22, fontWeight: 600, color: "var(--green)", letterSpacing: "-0.02em", lineHeight: 1 }}>{fmtMoney(savings)}</div>
              <div style={{ ...MONO, fontSize: 13, color: "var(--green)", marginTop: 4 }}>{savingsPct}% less</div>
              <div style={{ ...SANS, fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>per month</div>
            </>
          ) : (
            <div style={{ ...SANS, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
              {currentMonthly ? "Near market floor" : "Needs baseline"}
            </div>
          )}
        </div>
      </div>

      {/* Risk + advice */}
      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderTop: "none", padding: "16px 24px", display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, alignItems: "start" }}>
        <div>
          <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 4 }}>Availability risk</div>
          <div style={{ ...MONO, fontSize: 14, fontWeight: 600, color: reliabilityRisk === "Low" ? "var(--green)" : reliabilityRisk === "High" ? "var(--red)" : "var(--amber)" }}>{reliabilityRisk}</div>
        </div>
        {advice && (
          <div style={{ ...SANS, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65, borderLeft: "2px solid var(--border-mid)", paddingLeft: 16 }}>{advice}</div>
        )}
      </div>

      {/* Keep-in-place — the line nobody else gives */}
      {keepLine && (
        <div style={{ background: "var(--elevated)", border: "1px solid var(--border)", borderTop: "none", borderLeft: "3px solid var(--amber)", padding: "14px 24px" }}>
          <div style={{ ...SANS, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            <strong style={{ color: "var(--text-primary)" }}>Don't move this one.</strong> {workloadLabel} is latency- or continuity-sensitive — keep it on production-stable capacity even if a cheaper listing exists. The savings above are for interruption-tolerant work.
          </div>
        </div>
      )}

      <style>{`@media (max-width:700px){.result-grid{grid-template-columns:1fr !important;}}`}</style>
    </div>
  );
}

export default function AuditTool({ listings }: AuditToolProps) {
  const [setupText,      setSetupText]      = useState("");
  const [showManual,     setShowManual]     = useState(false);
  const [manualTouched,  setManualTouched]  = useState(false);
  // Upload (routes to emailed full audit — source of truth on real spend)
  const [billFileName,   setBillFileName]   = useState<string | null>(null);
  // Structured fields
  const [family,         setFamily]         = useState<GpuFamily>("H100");
  const [gpuCountStr,    setGpuCount]       = useState("8");
  const [hoursStr,       setHours]          = useState("720");
  const [situation,      setSituation]      = useState<Situation>("hyperscaler");
  const [workload,       setWorkload]       = useState<WorkloadType>("evals");
  // Email capture
  const [email,          setEmail]          = useState("");
  const [wantsAlerts,    setWantsAlerts]    = useState(true);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState("");
  const [submitted,      setSubmitted]      = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  // WTP anchor
  const [earlyAccessSent, setEarlyAccessSent] = useState(false);

  const gpuCount = parseNum(gpuCountStr, 1);
  const hours    = parseNum(hoursStr, 720);
  const parsed   = useMemo(() => parseStackText(setupText), [setupText]);

  const touchManual = () => { if (!manualTouched) setManualTouched(true); };

  // Auto-render: result exists whenever there's real input (no button).
  const hasTextOrManual = setupText.trim().length > 0 || (showManual && manualTouched);
  const hasUpload       = !!billFileName;

  // Effective stack + whether we can show a confident number.
  const snapshot = useMemo(() => {
    if (showManual && manualTouched) {
      return { family, gpuCount, hours, situation, workload, fromParsed: false, hasFamily: true };
    }
    return {
      family:    parsed.family    ?? family,
      gpuCount:  parsed.gpuCount  ?? gpuCount,
      hours:     parsed.hours     ?? hours,
      situation: parsed.situation ?? situation,
      workload:  parsed.workload  ?? workload,
      fromParsed: parsed.matchedTerms.length > 0,
      hasFamily:  parsed.family !== null,
    };
  }, [showManual, manualTouched, parsed, family, gpuCount, hours, situation, workload]);

  const computed = useMemo(
    () => hasTextOrManual ? computeResult(listings, snapshot.family, snapshot.gpuCount, snapshot.hours, snapshot.situation, snapshot.workload) : null,
    [hasTextOrManual, listings, snapshot],
  );

  // Data-integrity guard: typed text that parsed nothing must NOT yield a defaults-derived number.
  const showGuard  = hasTextOrManual && !showManual && !snapshot.hasFamily;
  const showResult = hasTextOrManual && !showGuard && !!computed;

  // Worked example — live A100 data.
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
    const isObserved = !specHigh;
    const saving = (a100Hyper.price_per_hour - a100Spec.price_per_hour) * 8 * 500;
    if (saving <= 0) return null;
    return { baseline: a100Hyper.price_per_hour, recommended: a100Spec.price_per_hour, savings: saving, provider: getMeta(a100Spec.provider).short, isObserved };
  }, [listings]);

  const inputStyle: React.CSSProperties = {
    ...SANS, width: "100%", background: "var(--panel)", border: "1px solid var(--border-mid)",
    color: "var(--text-primary)", padding: "10px 12px", fontSize: 13.5, outline: "none", borderRadius: 3,
  };
  const labelStyle: React.CSSProperties = {
    ...SANS, display: "block", fontSize: 10.5, fontWeight: 650, color: "var(--text-muted)",
    textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6,
  };

  // Build the concierge notes payload (also carries alert + bill intent for manual fulfilment).
  const buildNotes = (extra?: string) => {
    const snap = `Stack: ${snapshot.gpuCount}×${snapshot.family}, ${snapshot.hours}h/mo, ${snapshot.situation}, ${snapshot.workload}`;
    const flags = [
      wantsAlerts ? "wantsAlerts:true" : "wantsAlerts:false",
      hasUpload ? `billAttached:${billFileName}` : null,
      extra ?? null,
    ].filter(Boolean).join(" · ");
    return [setupText.trim(), snap, flags].filter(Boolean).join("\n\n");
  };

  const post = async (notes: string) => {
    const res = await fetch("/api/audit-request", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email, monthlySpend: "Unknown / audit needed",
        workload: snapshot.workload, notes, source: "cost-audit",
      }),
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
    catch { /* non-blocking */ setEarlyAccessSent(true); }
  };

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
      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", marginBottom: 16, padding: "20px 24px" }}>
        <label style={labelStyle}>Describe your current stack — or paste a quote</label>
        <textarea
          value={setupText}
          onChange={e => setSetupText(e.target.value)}
          placeholder="Example: We run 8×H100 on GCP for batch inference and evals, around 500–700 hours/month. Production serving stays on AWS. Want to know what can safely move."
          rows={6}
          style={{ ...inputStyle, minHeight: 140, resize: "vertical", lineHeight: 1.55 }}
        />

        {/* Detected chips */}
        {!showManual && parsed.matchedTerms.length > 0 && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const, marginTop: 10 }}>
            {parsed.matchedTerms.map(term => (
              <span key={term} style={{ ...MONO, fontSize: 10, color: "var(--blue)", background: "rgba(43,108,176,0.07)", border: "1px solid rgba(43,108,176,0.18)", padding: "2px 7px", borderRadius: 2 }}>{term}</span>
            ))}
          </div>
        )}

        {/* Secondary affordances: bill upload + manual */}
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" as const, alignItems: "center", marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
          <label style={{ ...SANS, fontSize: 12.5, color: "var(--blue)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <input type="file" accept=".csv,.pdf,.xlsx,.xls,image/*" style={{ display: "none" }} onChange={e => {
              const file = e.target.files?.[0];
              if (file) setBillFileName(file.name);
            }} />
            <span style={{ fontSize: 14 }}>⬆</span> Upload cloud bill or diagram
          </label>
          {billFileName && (
            <span style={{ ...SANS, fontSize: 12, color: "var(--text-secondary)" }}>
              ✓ {billFileName}
              <button onClick={() => setBillFileName(null)} style={{ ...SANS, fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", marginLeft: 8 }}>remove</button>
            </span>
          )}
          <button type="button" onClick={() => { setShowManual(s => !s); }} style={{ ...SANS, fontSize: 12.5, color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            {showManual ? "− Hide manual details" : "+ Enter details manually"}
          </button>
        </div>

        {/* Structured panel */}
        {showManual && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }} className="manual-grid">
              <div>
                <label style={labelStyle}>Workload type</label>
                <select value={workload} onChange={e => { setWorkload(e.target.value as WorkloadType); touchManual(); }} style={{ ...inputStyle, appearance: "auto" }}>
                  {WORKLOAD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Current provider</label>
                <select value={situation} onChange={e => { setSituation(e.target.value as Situation); touchManual(); }} style={{ ...inputStyle, appearance: "auto" }}>
                  {SETUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>GPU family</label>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const }}>
                  {(["H100","A100","L40S","A10G","other"] as GpuFamily[]).map(f => (
                    <button key={f} type="button" onClick={() => { setFamily(f); touchManual(); }} style={{
                      ...MONO, fontSize: 11, padding: "6px 10px", borderRadius: 3, cursor: "pointer",
                      border: `1px solid ${family === f ? "var(--blue)" : "var(--border-mid)"}`,
                      background: family === f ? "rgba(43,108,176,0.08)" : "var(--panel)",
                      color: family === f ? "var(--blue)" : "var(--text-secondary)",
                    }}>{f}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={labelStyle}>GPU count</label>
                <input type="number" min={1} value={gpuCountStr}
                  onChange={e => { setGpuCount(e.target.value); touchManual(); }}
                  onBlur={() => setGpuCount(String(parseNum(gpuCountStr, 1)))}
                  style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Hours / month</label>
                <input type="number" min={1} max={8760} value={hoursStr}
                  onChange={e => { setHours(e.target.value); touchManual(); }}
                  onBlur={() => setHours(String(parseNum(hoursStr, 720)))}
                  style={inputStyle} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Guard: input present but nothing parsed ── */}
      {showGuard && !hasUpload && (
        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderLeft: "3px solid var(--amber)", padding: "18px 24px", marginBottom: 16 }}>
          <div style={{ ...SANS, fontSize: 13.5, color: "var(--text-primary)", fontWeight: 600, marginBottom: 4 }}>Add your GPU type and provider to get your number.</div>
          <div style={{ ...SANS, fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
            We won't guess — a number from assumptions isn't worth anything. Name a GPU (H100, A100, L40S, A10G) and a provider in the box above, or{" "}
            <button onClick={() => { setShowManual(true); }} style={{ ...SANS, fontSize: 12.5, color: "var(--blue)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>enter details manually</button>.
          </div>
        </div>
      )}

      {/* ── Result ── */}
      {showResult && computed && (
        <div id="audit-results">
          <div style={{ ...MONO, fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 10 }}>
            Audit preview — {snapshot.fromParsed ? "detected from your text" : "your details"} · {snapshot.gpuCount}×{snapshot.family} · {snapshot.hours}h/mo · {snapshot.situation}
          </div>
          <ResultSection r={computed} family={snapshot.family} gpuCount={snapshot.gpuCount} hours={snapshot.hours} situation={snapshot.situation} workload={snapshot.workload} />
        </div>
      )}

      {/* ── Email + alerts (always below result/upload, never before) ── */}
      {(showResult || hasUpload) && !submitted && (
        <div style={{ marginTop: 16, background: "#171717", padding: "20px 24px" }}>
          <div style={{ ...SANS, fontSize: 13.5, fontWeight: 600, color: "#F7F3EA", marginBottom: 4 }}>
            {hasUpload ? "Get your bill read against the live market" : "Get the full breakdown"}
          </div>
          <div style={{ ...SANS, fontSize: 11.5, color: "rgba(247,243,234,0.55)", lineHeight: 1.55, marginBottom: 14 }}>
            {hasUpload
              ? `Provider-by-provider analysis from your actual ${billFileName} — region options, what to move first, what to keep. Analyst reviewed.`
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

      {/* ── Success + WTP anchor ── */}
      {submitted && (
        <div style={{ marginTop: 16, background: "var(--panel)", border: "1px solid var(--border)", padding: "28px 24px", textAlign: "center" as const }}>
          <div style={{ fontSize: 22, color: "var(--green)", marginBottom: 10 }}>✓</div>
          <div style={{ ...SERIF, fontSize: 22, fontWeight: 400, color: "var(--text-primary)", marginBottom: 8 }}>On its way.</div>
          <div style={{ ...SANS, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, maxWidth: 460, margin: "0 auto" }}>
            We'll send the full breakdown to <strong style={{ color: "var(--text-primary)" }}>{submittedEmail}</strong> within one business day.
            {hasUpload && <> Reply to that email with <strong style={{ color: "var(--text-primary)" }}>{billFileName}</strong> attached and we'll price it against the live market.</>}
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
