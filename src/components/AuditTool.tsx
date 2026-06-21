"use client";

import React, { useMemo, useState } from "react";
import {
  GpuListing, HYPERSCALERS, fmtMoney, fmtP, getMeta,
} from "@/lib/market-helpers";

const MONO:  React.CSSProperties = { fontFamily: "var(--font-mono)" };
const SANS:  React.CSSProperties = { fontFamily: "var(--font-sans)" };
const SERIF: React.CSSProperties = { fontFamily: "var(--font-serif)" };

type Situation = "hyperscaler" | "neocloud" | "marketplace" | "unsure";
type WorkloadType = "inference" | "batch" | "evals" | "finetuning" | "training" | "dev" | "unsure";
type GpuFamily = "H100" | "A100" | "L40S" | "A10G" | "other";

const WORKLOAD_OPTIONS: { value: WorkloadType; label: string; batchFriendly: boolean }[] = [
  { value: "inference",  label: "Real-time inference",   batchFriendly: false },
  { value: "batch",      label: "Batch inference",       batchFriendly: true  },
  { value: "evals",      label: "Evals / benchmarking",  batchFriendly: true  },
  { value: "finetuning", label: "Fine-tuning",           batchFriendly: true  },
  { value: "training",   label: "Training",              batchFriendly: false },
  { value: "dev",        label: "Dev notebooks",         batchFriendly: true  },
  { value: "unsure",     label: "Not sure",              batchFriendly: false },
];

const SETUP_OPTIONS: { value: Situation; label: string }[] = [
  { value: "hyperscaler",  label: "AWS / GCP / Azure" },
  { value: "neocloud",     label: "CoreWeave / Lambda / Nebius" },
  { value: "marketplace",  label: "RunPod / Vast.ai" },
  { value: "unsure",       label: "Mixed / not sure" },
];

const GPU_FAMILIES: GpuFamily[] = ["H100", "A100", "L40S", "A10G", "other"];

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

// Lightweight free-text parser — extracts structured signals from a pasted
// stack description so the result reflects what the visitor actually typed,
// not just default dropdown state. Best-effort; falls back to manual fields.
function parseStackText(text: string): ParsedStack {
  const t = text.toLowerCase();
  const matched: string[] = [];

  // GPU family — check longer/more specific tokens first (H100 before H1, etc.)
  let family: GpuFamily | null = null;
  const familyPatterns: [RegExp, GpuFamily][] = [
    [/\bh100\b/, "H100"],
    [/\ba100\b/, "A100"],
    [/\bl40s?\b/, "L40S"],
    [/\ba10g?\b/, "A10G"],
  ];
  for (const [re, fam] of familyPatterns) {
    if (re.test(t)) { family = fam; matched.push(fam); break; }
  }

  // GPU count — "8x", "8 x", "8×", "8 H100s"
  let gpuCount: number | null = null;
  const countMatch = t.match(/(\d+)\s*[x×]\s*(?:h100|a100|l40s?|a10g?|gpu)/)
    ?? t.match(/(\d+)\s+(?:h100|a100|l40s?|a10g?)s?\b/);
  if (countMatch) {
    const n = parseInt(countMatch[1], 10);
    if (n > 0 && n <= 10000) { gpuCount = n; matched.push(`${n}×`); }
  }

  // Hours/month — "500 hours", "500-700 hours/month", "~600 hrs"
  let hours: number | null = null;
  const hoursMatch = t.match(/(\d+)\s*(?:-\s*\d+\s*)?\s*(?:hours?|hrs?)(?:\s*\/\s*month|\s*per\s*month|\/mo)?/);
  if (hoursMatch) {
    const n = parseInt(hoursMatch[1], 10);
    if (n > 0 && n <= 8760) { hours = n; matched.push(`${n}h/mo`); }
  }

  // Current provider/situation
  let situation: Situation | null = null;
  if (/\b(aws|amazon web services|gcp|google cloud|azure|microsoft azure)\b/.test(t)) {
    situation = "hyperscaler"; matched.push("hyperscaler");
  } else if (/\b(coreweave|lambda|lambda labs|nebius)\b/.test(t)) {
    situation = "neocloud"; matched.push("neocloud");
  } else if (/\b(runpod|vast\.?ai|vastai)\b/.test(t)) {
    situation = "marketplace"; matched.push("marketplace");
  }

  // Workload type
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

function ResultCard({ listings, family, gpuCount, hours, situation, workload }: {
  listings: GpuListing[]; family: GpuFamily; gpuCount: number; hours: number;
  situation: Situation; workload: WorkloadType;
}) {
  const familyListings = family === "other"
    ? listings
    : listings.filter(l => l.gpu_model.toUpperCase().includes(family));

  if (!familyListings.length) {
    return (
      <div style={{ background: "var(--bg)", border: "1px solid var(--border)", padding: "16px 20px" }}>
        <div style={{ ...SANS, fontSize: 13, color: "var(--text-muted)" }}>
          No {family === "other" ? "GPU" : family} listings in the current snapshot.{" "}
          <a href="/cost-audit" style={{ color: "var(--blue)" }}>Request a full audit</a> for current pricing on this GPU family.
        </div>
      </div>
    );
  }

  const sorted   = [...familyListings].sort((a, b) => a.price_per_hour - b.price_per_hour);
  const reliable = familyListings.filter(l => l.availability === "high").sort((a, b) => a.price_per_hour - b.price_per_hour);
  const cheapestObserved  = sorted[0];
  const cheapestReliable  = reliable[0] ?? null;
  const recommendation    = cheapestReliable ?? cheapestObserved;
  const isReliable        = !!cheapestReliable;

  // Baseline from current situation
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
  const savings     = currentMonthly && currentMonthly > recommendedMonthly ? currentMonthly - recommendedMonthly : null;
  const savingsPct  = currentMonthly && savings ? Math.round((savings / currentMonthly) * 100) : null;

  // Workload-fit recommendation
  const workloadObj = WORKLOAD_OPTIONS.find(w => w.value === workload);
  const isBatchFriendly = workloadObj?.batchFriendly ?? false;

  let advice = "";
  if (savingsPct !== null && savingsPct >= 20 && isBatchFriendly) {
    advice = `Move ${workloadObj?.label.toLowerCase() ?? "this workload"} to ${getMeta(recommendation.provider).short} first — it's interruption-tolerant and the savings are material. Keep latency-critical production serving where it is.`;
  } else if (savingsPct !== null && savingsPct >= 10) {
    advice = `Savings are available but migration friction matters. Audit contract terms and reserved pricing before switching. ${!isBatchFriendly ? "This workload type carries migration risk — move incrementally." : ""}`;
  } else if (savingsPct !== null) {
    advice = `You're near market floor for reliable ${family === "other" ? "GPU" : family}. Focus on utilisation and reserved pricing rather than provider switching.`;
  } else if (!baseline) {
    advice = `No ${situation} listings found for ${family === "other" ? "this GPU" : family} in the current snapshot. The audit can surface region-specific options not in the daily index.`;
  }

  const reliabilityRisk = !isReliable ? "High" : capacityConfFromListings(familyListings) >= 60 ? "Low" : "Medium";

  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 0 }} className="result-grid">

        {/* Current */}
        <div style={{ padding: "16px 20px", borderRight: "1px solid var(--border)" }}>
          <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 6 }}>
            {baseline ? `Est. current (${situation === "unsure" ? "hyperscaler assumed" : situation})` : "No baseline found"}
          </div>
          {currentMonthly ? (
            <>
              <div style={{ ...MONO, fontSize: 26, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.025em", lineHeight: 1 }}>
                {fmtMoney(currentMonthly)}<span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 300 }}>/mo</span>
              </div>
              <div style={{ ...SANS, fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                {getMeta(baseline!.provider).short} · {fmtP(baseline!.price_per_hour)}/hr × {gpuCount} GPU{gpuCount !== 1 ? "s" : ""} × {hours}h
              </div>
            </>
          ) : (
            <div style={{ ...SANS, fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
              No {family === "other" ? "GPU" : family} listings for your provider type in this snapshot.
            </div>
          )}
        </div>

        {/* Recommended */}
        <div style={{ padding: "16px 20px", borderRight: "1px solid var(--border)", borderTop: `3px solid ${isReliable ? "var(--green)" : "var(--amber)"}`, marginTop: -1 }}>
          <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: isReliable ? "var(--green)" : "var(--amber)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 6 }}>
            {isReliable ? "Cheapest reliable" : "Cheapest observed"}
            {!isReliable && <span style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 400, background: "var(--amber-dim)", border: "1px solid rgba(183,121,31,0.2)", padding: "1px 5px", borderRadius: 2 }}>observed only</span>}
          </div>
          <div style={{ ...MONO, fontSize: 26, fontWeight: 500, color: isReliable ? "var(--green)" : "var(--amber)", letterSpacing: "-0.025em", lineHeight: 1 }}>
            {fmtMoney(recommendedMonthly)}<span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 300 }}>/mo</span>
          </div>
          <div style={{ ...SANS, fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
            {getMeta(recommendation.provider).short} · {recommendation.gpu_model} · {fmtP(recommendation.price_per_hour)}/hr
          </div>
          {!isReliable && (
            <div style={{ ...SANS, fontSize: 10.5, color: "var(--amber)", marginTop: 4 }}>
              No high-availability listings — not a production routing target.
            </div>
          )}
        </div>

        {/* Savings */}
        <div style={{ padding: "16px 20px", minWidth: 120, textAlign: "center" as const, background: savings && savingsPct && savingsPct >= 10 ? "var(--green-dim)" : "var(--bg)" }}>
          <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 6 }}>Savings</div>
          {savings ? (
            <>
              <div style={{ ...MONO, fontSize: 22, fontWeight: 600, color: "var(--green)", letterSpacing: "-0.02em", lineHeight: 1 }}>{fmtMoney(savings)}</div>
              <div style={{ ...MONO, fontSize: 12, color: "var(--green)", marginTop: 2 }}>{savingsPct}% less</div>
              <div style={{ ...SANS, fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>per month</div>
            </>
          ) : (
            <div style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 4 }}>
              {currentMonthly ? "Near market floor" : "Needs baseline"}
            </div>
          )}
        </div>
      </div>

      {/* Risk + advice */}
      <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", display: "grid", gridTemplateColumns: "auto 1fr", gap: 16, alignItems: "start" }}>
        <div>
          <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 4 }}>Availability risk</div>
          <div style={{ ...MONO, fontSize: 13, fontWeight: 600, color: reliabilityRisk === "Low" ? "var(--green)" : reliabilityRisk === "High" ? "var(--red)" : "var(--amber)" }}>{reliabilityRisk}</div>
        </div>
        {advice && (
          <div style={{ ...SANS, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.65, borderLeft: "2px solid var(--border-mid)", paddingLeft: 14 }}>{advice}</div>
        )}
      </div>

      <style>{`
        @media (max-width: 700px) { .result-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}

function capacityConfFromListings(ls: GpuListing[]) {
  if (!ls.length) return 0;
  return Math.round(ls.filter(l => l.availability === "high").length / ls.length * 100);
}

export default function AuditTool({ listings }: AuditToolProps) {
  const [setupText,   setSetupText]   = useState("");
  const [email,       setEmail]       = useState("");
  const [showManual,  setShowManual]  = useState(false);
  const [family,      setFamily]      = useState<GpuFamily>("H100");
  const [gpuCountStr, setGpuCount]    = useState("8");
  const [hoursStr,    setHours]       = useState("720");
  const [situation,   setSituation]   = useState<Situation>("hyperscaler");
  const [workload,    setWorkload]     = useState<WorkloadType>("evals");
  const [showCapture, setShowCapture] = useState(false);
  const [submitted,   setSubmitted]   = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);

  const gpuCount = parseNum(gpuCountStr, 1);
  const hours    = parseNum(hoursStr, 720);

  // Parse the pasted text for structured signals. If the visitor hasn't
  // touched the manual fields, the parsed values drive the result — so
  // typing "8x H100 on GCP, 500 hours/month" actually changes the output.
  const parsed = useMemo(() => parseStackText(setupText), [setupText]);

  const effectiveFamily: GpuFamily   = showManual ? family    : (parsed.family    ?? family);
  const effectiveCount:  number      = showManual ? gpuCount  : (parsed.gpuCount  ?? gpuCount);
  const effectiveHours:  number      = showManual ? hours     : (parsed.hours     ?? hours);
  const effectiveSituation: Situation = showManual ? situation : (parsed.situation ?? situation);
  const effectiveWorkload: WorkloadType = showManual ? workload : (parsed.workload ?? workload);

  const usingParsedText = !showManual && parsed.matchedTerms.length > 0;
  const hasInput = setupText.trim().length > 0 || showManual;

  // Worked example — computed from live A100 data (most practical market)
  const workedExample = useMemo(() => {
    const a100Hyper = listings.filter(l => l.gpu_model.includes("A100") && HYPERSCALERS.includes(l.provider.toLowerCase()) && l.availability === "high")
      .sort((a, b) => a.price_per_hour - b.price_per_hour)[0];
    const a100Spec  = listings.filter(l => l.gpu_model.includes("A100") && !HYPERSCALERS.includes(l.provider.toLowerCase()) && l.availability === "high")
      .sort((a, b) => a.price_per_hour - b.price_per_hour)[0];
    if (!a100Hyper || !a100Spec) return null;
    const baseline = a100Hyper.price_per_hour * 8 * 500;
    const recommended = a100Spec.price_per_hour * 8 * 500;
    const saving = baseline - recommended;
    if (saving <= 0) return null;
    return { baseline: a100Hyper.price_per_hour, recommended: a100Spec.price_per_hour, savings: saving, provider: getMeta(a100Spec.provider).short };
  }, [listings]);

  const inputStyle: React.CSSProperties = {
    ...SANS, width: "100%", background: "var(--panel)", border: "1px solid var(--border-mid)",
    color: "var(--text-primary)", padding: "10px 12px", fontSize: 13.5, outline: "none", borderRadius: 3,
  };
  const labelStyle: React.CSSProperties = {
    ...SANS, display: "block", fontSize: 10.5, fontWeight: 650, color: "var(--text-muted)",
    textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6,
  };

  const handleCapture = async () => {
    if (!email || !email.includes("@")) { setError("Enter a valid work email."); return; }
    setError(""); setLoading(true);
    try {
      const summary = `Audit basis: ${effectiveCount}×${effectiveFamily}, ${effectiveHours}h/mo, ${effectiveSituation}, ${effectiveWorkload}` +
        (usingParsedText ? ` (parsed from pasted text: ${parsed.matchedTerms.join(", ")})` : showManual ? " (manual entry)" : " (defaults)");
      const res = await fetch("/api/audit-request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email, monthlySpend: "Unknown / audit needed", workload: effectiveWorkload,
          notes: [setupText.trim(), summary].filter(Boolean).join("\n\n"),
          source: "cost-audit",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) { setError(json.error ?? "Something went wrong."); setLoading(false); return; }
      setSubmittedEmail(email); setSubmitted(true);
    } catch { setError("Network error — try again."); }
    finally { setLoading(false); }
  };

  return (
    <div>

      {/* ── Worked example ── */}
      {workedExample && (
        <div style={{ background: "var(--elevated)", border: "1px solid var(--border)", borderLeft: "3px solid var(--green)", padding: "14px 18px", marginBottom: 20 }}>
          <div style={{ ...MONO, fontSize: 10, color: "var(--green)", letterSpacing: "0.08em", marginBottom: 6 }}>EXAMPLE</div>
          <div style={{ ...SANS, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65 }}>
            Evals and batch inference on hyperscaler A100s (~{fmtP(workedExample.baseline)}/hr) pay a reliability premium they don't need for interruption-tolerant jobs. Moving those to reliable specialist A100s (~{fmtP(workedExample.recommended)}/hr at {workedExample.provider}) ≈{" "}
            <strong style={{ color: "var(--green)" }}>{fmtMoney(workedExample.savings)}/mo saved</strong> for 8 GPUs × 500 hrs, while production serving stays put.{" "}
            <em style={{ color: "var(--text-muted)" }}>Your numbers will differ.</em>
          </div>
        </div>
      )}

      {/* ── Primary input: paste ── */}
      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", marginBottom: 16 }}>
        <div style={{ padding: "20px 24px 16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 20, alignItems: "start" }} className="audit-intake-grid">
            <div>
              <label style={labelStyle}>Describe your current stack</label>
              <textarea
                value={setupText}
                onChange={e => setSetupText(e.target.value)}
                placeholder="Example: We run 8×H100 on GCP for batch inference and evals, around 500–700 hours/month. Production serving stays on AWS. We have a quote around $X/hr and want to know what can safely move."
                rows={6}
                style={{ ...inputStyle, minHeight: 140, resize: "vertical", lineHeight: 1.55 }}
              />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {[
                  ["Cloud bill", "Our monthly cloud bill for AI compute is roughly $___. We run "],
                  ["Architecture notes", "We run "],
                  ["Provider quote", "We got a quote of $___/hr for "],
                  ["Plain English", "We use "],
                ].map(([label, prefix]) => (
                  <button key={label} type="button"
                    onClick={() => setSetupText(t => t.trim().length ? t : prefix)}
                    style={{
                      ...SANS, fontSize: 11, color: "var(--text-secondary)", cursor: "pointer",
                      background: "var(--elevated)", border: "1px solid var(--border)",
                      padding: "3px 8px", borderRadius: 3,
                    }}>{label}</button>
                ))}
              </div>
            </div>
            <div style={{ background: "var(--bg)", border: "1px solid var(--border)", padding: "14px 16px" }}>
              <div style={{ ...MONO, fontSize: 10, color: "var(--blue)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>What this unlocks</div>
              {[
                "Where you're overpaying",
                "What can safely move",
                "Routing fit — incl. future energy pricing",
              ].map(item => (
                <div key={item} style={{ ...SANS, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.45, marginBottom: 7 }}>→ {item}</div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Live result — appears once there's real input ── */}
        <div style={{ padding: "0 24px 20px" }}>
          {!hasInput ? (
            <div style={{ background: "var(--bg)", border: "1px dashed var(--border-mid)", padding: "20px", textAlign: "center" as const }}>
              <div style={{ ...SANS, fontSize: 12.5, color: "var(--text-muted)" }}>
                Start typing above, or <button type="button" onClick={() => setShowManual(true)} style={{ ...SANS, fontSize: 12.5, color: "var(--blue)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>enter structured details</button> to see your audit preview.
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" as const, gap: 8, marginBottom: 8 }}>
                <div style={{ ...SANS, fontSize: 10.5, fontWeight: 650, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>
                  Preview — {showManual ? "based on your structured details" : "detected from your text"}
                </div>
                {usingParsedText && (
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const }}>
                    {parsed.matchedTerms.map(term => (
                      <span key={term} style={{ ...MONO, fontSize: 10, color: "var(--blue)", background: "var(--blue-dim)", border: "1px solid rgba(43,108,176,0.2)", padding: "2px 7px", borderRadius: 2 }}>{term}</span>
                    ))}
                  </div>
                )}
              </div>
              {!showManual && !usingParsedText ? (
                <div style={{ background: "var(--bg)", border: "1px solid var(--border)", padding: "16px 20px" }}>
                  <div style={{ ...SANS, fontSize: 12.5, color: "var(--text-muted)" }}>
                    Couldn't detect a GPU family, count, or hours from that text yet.{" "}
                    <button type="button" onClick={() => setShowManual(true)} style={{ ...SANS, fontSize: 12.5, color: "var(--blue)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>Enter structured details</button> for an accurate preview.
                  </div>
                </div>
              ) : (
                <ResultCard
                  listings={listings}
                  family={effectiveFamily}
                  gpuCount={effectiveCount}
                  hours={effectiveHours}
                  situation={effectiveSituation}
                  workload={effectiveWorkload}
                />
              )}
            </>
          )}
        </div>

        {/* ── Manual entry expand ── */}
        <div style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={() => {
            if (!showManual) {
              // Seed manual fields with parsed values on first open, so the
              // visitor refines from what we detected rather than resetting to defaults.
              if (parsed.family) setFamily(parsed.family);
              if (parsed.gpuCount) setGpuCount(String(parsed.gpuCount));
              if (parsed.hours) setHours(String(parsed.hours));
              if (parsed.situation) setSituation(parsed.situation);
              if (parsed.workload) setWorkload(parsed.workload);
            }
            setShowManual(o => !o);
          }} style={{
            ...SANS, width: "100%", background: "transparent", border: "none",
            color: "var(--blue)", padding: "12px 24px", textAlign: "left",
            fontSize: 13, fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span>Refine with structured details (GPU count, hours, workload type)</span>
            <span style={{ ...MONO, fontSize: 12 }}>{showManual ? "−" : "+"}</span>
          </button>

          {showManual && (
            <div style={{ padding: "0 24px 20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }} className="manual-grid">
                <div>
                  <label style={labelStyle}>Workload type</label>
                  <select value={workload} onChange={e => setWorkload(e.target.value as WorkloadType)} style={{ ...inputStyle, appearance: "auto" }}>
                    {WORKLOAD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Current setup</label>
                  <select value={situation} onChange={e => setSituation(e.target.value as Situation)} style={{ ...inputStyle, appearance: "auto" }}>
                    {SETUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>GPU family</label>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {(["H100","A100","L40S","A10G","other"] as GpuFamily[]).map(f => (
                      <button key={f} onClick={() => setFamily(f)} style={{
                        ...MONO, fontSize: 11, padding: "6px 10px", borderRadius: 3,
                        border: `1px solid ${family === f ? "var(--blue)" : "var(--border-mid)"}`,
                        background: family === f ? "var(--blue-dim)" : "var(--panel)",
                        color: family === f ? "var(--blue)" : "var(--text-secondary)",
                      }}>{f}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>GPU count</label>
                  <input type="number" min={1} value={gpuCountStr}
                    onChange={e => setGpuCount(e.target.value)}
                    onBlur={() => setGpuCount(String(parseNum(gpuCountStr, 1)))}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Hours / month</label>
                  <input type="number" min={1} max={8760} value={hoursStr}
                    onChange={e => setHours(e.target.value)}
                    onBlur={() => setHours(String(parseNum(hoursStr, 720)))}
                    style={inputStyle} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Email capture — after result, not before ── */}
      {!submitted ? (
        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: "18px 24px" }}>
          {!showCapture ? (
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <button onClick={() => setShowCapture(true)} style={{
                ...SANS, fontSize: 13, fontWeight: 600, color: "#F7F3EA", background: "#171717",
                padding: "9px 20px", borderRadius: 3, border: "none", cursor: "pointer",
              }}>
                Audit my stack
              </button>
              <span style={{ ...SANS, fontSize: 12, color: "var(--text-muted)" }}>
                Provider-by-provider breakdown, region options, and what to move first.
              </span>
            </div>
          ) : (
            <div>
              <label style={labelStyle}>Work email</label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
                <input type="email" placeholder="you@company.com" value={email}
                  onChange={e => setEmail(e.target.value)} autoFocus
                  style={{ ...inputStyle, width: "auto", flex: "1 1 240px" }} />
                <button onClick={handleCapture} disabled={loading} style={{
                  ...SANS, fontSize: 13, fontWeight: 600, color: "#F7F3EA",
                  background: loading ? "var(--text-muted)" : "#171717",
                  padding: "10px 22px", borderRadius: 3, border: "none", cursor: loading ? "not-allowed" : "pointer",
                }}>
                  {loading ? "Sending…" : "Send stack audit"}
                </button>
                <button onClick={() => setShowCapture(false)} style={{ ...SANS, fontSize: 12, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: "10px 0" }}>Cancel</button>
              </div>
              {error && <p style={{ ...SANS, fontSize: 12, color: "var(--red)", marginTop: 8 }}>{error}</p>}
              <div style={{ ...MONO, fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.05em", marginTop: 10 }}>ANALYST-REVIEWED · WITHIN ONE BUSINESS DAY</div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: "24px", textAlign: "center" }}>
          <div style={{ fontSize: 24, color: "var(--green)", marginBottom: 10 }}>✓</div>
          <div style={{ ...SERIF, fontSize: 20, fontWeight: 400, color: "var(--text-primary)", marginBottom: 8 }}>On its way.</div>
          <div style={{ ...SANS, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
            We'll email the full provider-by-provider breakdown to <strong style={{ color: "var(--text-primary)" }}>{submittedEmail}</strong> within one business day.
          </div>
          <div style={{ ...SANS, fontSize: 12, color: "var(--text-muted)", marginTop: 12 }}>
            Want this routed automatically once you've moved?{" "}
            <a href="/load-balancer" style={{ color: "var(--blue)" }}>Join the routing beta →</a>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 760px) {
          .audit-intake-grid, .manual-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
