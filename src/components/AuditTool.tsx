"use client";

import React, { useMemo, useState } from "react";
import {
  GpuListing, HYPERSCALERS, fmtMoney, fmtP, getMeta,
} from "@/lib/market-helpers";

const MONO:  React.CSSProperties = { fontFamily: "var(--font-mono)" };
const SANS:  React.CSSProperties = { fontFamily: "var(--font-sans)" };
const SERIF: React.CSSProperties = { fontFamily: "var(--font-serif)" };

type Situation   = "hyperscaler" | "neocloud" | "marketplace" | "unsure";
type WorkloadType = "inference" | "batch" | "evals" | "finetuning" | "training" | "dev" | "unsure";
type GpuFamily   = "H100" | "A100" | "L40S" | "A10G" | "other";
type InputTab    = "plain" | "diagram" | "bill" | "structured";

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

function ResultSection({ listings, family, gpuCount, hours, situation, workload, onEmail }: {
  listings: GpuListing[]; family: GpuFamily; gpuCount: number; hours: number;
  situation: Situation; workload: WorkloadType; onEmail: () => void;
}) {
  const familyListings = family === "other"
    ? listings
    : listings.filter(l => l.gpu_model.toUpperCase().includes(family));

  if (!familyListings.length) {
    return (
      <div style={{ border: "1px solid var(--border)", background: "var(--panel)", padding: "24px" }}>
        <div style={{ ...SANS, fontSize: 13, color: "var(--text-muted)" }}>
          No {family === "other" ? "GPU" : family} listings in the current snapshot.{" "}
          Submit your stack and we'll find current pricing for this GPU family.
        </div>
      </div>
    );
  }

  const sorted  = [...familyListings].sort((a, b) => a.price_per_hour - b.price_per_hour);
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

  const workloadObj    = WORKLOAD_OPTIONS.find(w => w.value === workload);
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
    advice = `No ${situation} listings found for ${family === "other" ? "this GPU" : family} in the current snapshot. The audit can surface region-specific options not in the daily index.`;
  }

  return (
    <div>
      {/* ── Numbers ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", background: "var(--panel)", border: "1px solid var(--border)", marginBottom: 1 }} className="result-grid">
        {/* Current */}
        <div style={{ padding: "20px 24px", borderRight: "1px solid var(--border)" }}>
          <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 8 }}>
            {baseline ? `Est. current (${situation === "unsure" ? "hyperscaler assumed" : situation})` : "No baseline found"}
          </div>
          {currentMonthly ? (
            <>
              <div style={{ ...MONO, fontSize: 30, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1 }}>
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
        <div style={{ padding: "20px 24px", borderRight: "1px solid var(--border)", borderTop: `3px solid ${isReliable ? "var(--green)" : "var(--amber)"}` }}>
          <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: isReliable ? "var(--green)" : "var(--amber)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 8 }}>
            {isReliable ? "Cheapest reliable" : "Cheapest observed"}
            {!isReliable && <span style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 400, background: "rgba(151,90,22,0.08)", border: "1px solid rgba(151,90,22,0.2)", padding: "1px 5px", borderRadius: 2 }}>observed only</span>}
          </div>
          <div style={{ ...MONO, fontSize: 30, fontWeight: 500, color: isReliable ? "var(--green)" : "var(--amber)", letterSpacing: "-0.03em", lineHeight: 1 }}>
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
              <div style={{ ...MONO, fontSize: 24, fontWeight: 600, color: "var(--green)", letterSpacing: "-0.02em", lineHeight: 1 }}>{fmtMoney(savings)}</div>
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

      {/* ── Risk + advice ── */}
      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderTop: "none", padding: "16px 24px", display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, alignItems: "start" }}>
        <div>
          <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 4 }}>Availability risk</div>
          <div style={{ ...MONO, fontSize: 14, fontWeight: 600, color: reliabilityRisk === "Low" ? "var(--green)" : reliabilityRisk === "High" ? "var(--red)" : "var(--amber)" }}>{reliabilityRisk}</div>
        </div>
        {advice && (
          <div style={{ ...SANS, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65, borderLeft: "2px solid var(--border-mid)", paddingLeft: 16 }}>{advice}</div>
        )}
      </div>

      {/* ── Email CTA ── */}
      <div style={{ marginTop: 16, background: "#171717", padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" as const }}>
        <div>
          <div style={{ ...SANS, fontSize: 13, fontWeight: 600, color: "#F7F3EA", marginBottom: 2 }}>Get the full breakdown</div>
          <div style={{ ...SANS, fontSize: 11.5, color: "rgba(247,243,234,0.55)" }}>Provider-by-provider analysis, region options, and what to move first — analyst reviewed.</div>
        </div>
        <button onClick={onEmail} style={{
          ...SANS, fontSize: 13, fontWeight: 600, color: "#171717", background: "#F7F3EA",
          padding: "10px 22px", borderRadius: 3, border: "none", cursor: "pointer", whiteSpace: "nowrap" as const,
        }}>
          Email me the full breakdown →
        </button>
      </div>

      <style>{`@media (max-width:700px){.result-grid{grid-template-columns:1fr !important;}}`}</style>
    </div>
  );
}

export default function AuditTool({ listings }: AuditToolProps) {
  const [setupText,     setSetupText]     = useState("");
  const [email,         setEmail]         = useState("");
  const [showCapture,   setShowCapture]   = useState(false);
  const [submitted,     setSubmitted]     = useState(false);
  const [submittedEmail,setSubmittedEmail]= useState("");
  const [error,         setError]         = useState("");
  const [loading,       setLoading]       = useState(false);
  const [activeTab,     setActiveTab]     = useState<InputTab>("plain");
  const [billFileName,  setBillFileName]  = useState<string | null>(null);
  const [diagramName,   setDiagramName]   = useState<string | null>(null);
  // Structured tab fields
  const [family,        setFamily]        = useState<GpuFamily>("H100");
  const [gpuCountStr,   setGpuCount]      = useState("8");
  const [hoursStr,      setHours]         = useState("720");
  const [situation,     setSituation]     = useState<Situation>("hyperscaler");
  const [workload,      setWorkload]      = useState<WorkloadType>("evals");
  // Submission state
  const [submitted_audit, setSubmittedAudit] = useState(false);
  const [auditSnapshot,   setAuditSnapshot]  = useState<{
    family: GpuFamily; gpuCount: number; hours: number;
    situation: Situation; workload: WorkloadType;
    text: string; fromParsed: boolean;
  } | null>(null);

  const gpuCount = parseNum(gpuCountStr, 1);
  const hours    = parseNum(hoursStr, 720);
  const parsed   = useMemo(() => parseStackText(setupText), [setupText]);

  const canRunFromText      = activeTab !== "structured" && setupText.trim().length > 0;
  const canRunFromStructured = activeTab === "structured";
  const canRun = canRunFromText || canRunFromStructured;

  // Worked example — computed from live A100 data.
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

  const handleRunAudit = () => {
    if (!canRun) return;
    let effectiveFamily: GpuFamily    = family;
    let effectiveCount: number        = gpuCount;
    let effectiveHours: number        = hours;
    let effectiveSituation: Situation = situation;
    let effectiveWorkload: WorkloadType = workload;
    let fromParsed = false;

    if (activeTab !== "structured") {
      effectiveFamily    = parsed.family    ?? family;
      effectiveCount     = parsed.gpuCount  ?? gpuCount;
      effectiveHours     = parsed.hours     ?? hours;
      effectiveSituation = parsed.situation ?? situation;
      effectiveWorkload  = parsed.workload  ?? workload;
      fromParsed = parsed.matchedTerms.length > 0;
    }

    setAuditSnapshot({ family: effectiveFamily, gpuCount: effectiveCount, hours: effectiveHours, situation: effectiveSituation, workload: effectiveWorkload, text: setupText, fromParsed });
    setSubmittedAudit(true);
    // Scroll to results after tick
    setTimeout(() => document.getElementById("audit-results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const handleCapture = async () => {
    if (!email || !email.includes("@")) { setError("Enter a valid work email."); return; }
    setError(""); setLoading(true);
    try {
      const snap = auditSnapshot;
      const summary = snap ? `Audit basis: ${snap.gpuCount}×${snap.family}, ${snap.hours}h/mo, ${snap.situation}, ${snap.workload}` : "";
      const res = await fetch("/api/audit-request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email, monthlySpend: "Unknown / audit needed",
          workload: snap?.workload ?? workload,
          notes: [snap?.text?.trim(), summary].filter(Boolean).join("\n\n"),
          source: "cost-audit",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) { setError(json.error ?? "Something went wrong."); setLoading(false); return; }
      setSubmittedEmail(email); setSubmitted(true);
    } catch { setError("Network error — try again."); }
    finally { setLoading(false); }
  };

  const TABS: { id: InputTab; label: string }[] = [
    { id: "plain",      label: "Plain English" },
    { id: "diagram",    label: "Architecture diagram" },
    { id: "bill",       label: "Cloud bill" },
    { id: "structured", label: "Structured details" },
  ];

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
      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", marginBottom: 16 }}>

        {/* Tab bar */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
          {TABS.map(tab => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} style={{
              ...SANS, fontSize: 12.5, fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? "var(--text-primary)" : "var(--text-muted)",
              background: "none", border: "none",
              borderBottom: `2px solid ${activeTab === tab.id ? "var(--text-primary)" : "transparent"}`,
              padding: "10px 18px 11px", cursor: "pointer", marginBottom: -1, whiteSpace: "nowrap" as const,
            }}>{tab.label}</button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ padding: "20px 24px 0" }}>

          {activeTab === "plain" && (
            <>
              <label style={labelStyle}>Describe your current stack</label>
              <textarea
                value={setupText}
                onChange={e => setSetupText(e.target.value)}
                placeholder="Example: We run 8×H100 on GCP for batch inference and evals, around 500–700 hours/month. Production serving stays on AWS. We have a quote around $X/hr and want to know what can safely move."
                rows={6}
                style={{ ...inputStyle, minHeight: 140, resize: "vertical", lineHeight: 1.55 }}
              />
            </>
          )}

          {activeTab === "diagram" && (
            <>
              <label style={labelStyle}>Architecture diagram</label>
              <label style={{
                display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center",
                gap: 8, minHeight: 140, border: "1px dashed var(--border-mid)", borderRadius: 3,
                background: "var(--bg)", cursor: "pointer", padding: "24px 20px",
              }}>
                <input type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) { setDiagramName(file.name); setSetupText(t => t || `[Architecture diagram: ${file.name}] `); }
                }} />
                {diagramName ? (
                  <><span style={{ fontSize: 20 }}>✓</span><span style={{ ...SANS, fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>{diagramName}</span><span style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)" }}>Click to replace</span></>
                ) : (
                  <><span style={{ fontSize: 22, opacity: 0.4 }}>⬆</span><span style={{ ...SANS, fontSize: 13, color: "var(--text-secondary)" }}>Upload architecture diagram</span><span style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)" }}>PNG, JPG, or PDF</span></>
                )}
              </label>
              {diagramName && (
                <textarea value={setupText} onChange={e => setSetupText(e.target.value)} placeholder="Add notes — GPU types, providers, hours used..." rows={3}
                  style={{ ...inputStyle, minHeight: 72, resize: "vertical", lineHeight: 1.55, marginTop: 10 }} />
              )}
            </>
          )}

          {activeTab === "bill" && (
            <>
              <label style={labelStyle}>Cloud bill</label>
              <label style={{
                display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center",
                gap: 8, minHeight: 140, border: "1px dashed var(--border-mid)", borderRadius: 3,
                background: "var(--bg)", cursor: "pointer", padding: "24px 20px",
              }}>
                <input type="file" accept=".csv,.pdf,.xlsx,.xls,image/*" style={{ display: "none" }} onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) { setBillFileName(file.name); setSetupText(t => t || `[Cloud bill: ${file.name}] `); }
                }} />
                {billFileName ? (
                  <><span style={{ fontSize: 20 }}>✓</span><span style={{ ...SANS, fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>{billFileName}</span><span style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)" }}>Click to replace</span></>
                ) : (
                  <><span style={{ fontSize: 22, opacity: 0.4 }}>⬆</span><span style={{ ...SANS, fontSize: 13, color: "var(--text-secondary)" }}>Upload your cloud bill</span><span style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)" }}>CSV, PDF, or screenshot — AWS Cost Explorer, GCP billing, Azure invoices</span></>
                )}
              </label>
              {billFileName && (
                <textarea value={setupText} onChange={e => setSetupText(e.target.value)} placeholder="Anything else to note — GPU types, hours, workload mix..." rows={3}
                  style={{ ...inputStyle, minHeight: 72, resize: "vertical", lineHeight: 1.55, marginTop: 10 }} />
              )}
            </>
          )}

          {activeTab === "structured" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }} className="manual-grid">
                <div>
                  <label style={labelStyle}>Workload type</label>
                  <select value={workload} onChange={e => setWorkload(e.target.value as WorkloadType)} style={{ ...inputStyle, appearance: "auto" }}>
                    {WORKLOAD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Current provider</label>
                  <select value={situation} onChange={e => setSituation(e.target.value as Situation)} style={{ ...inputStyle, appearance: "auto" }}>
                    {SETUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>GPU family</label>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const }}>
                    {(["H100","A100","L40S","A10G","other"] as GpuFamily[]).map(f => (
                      <button key={f} type="button" onClick={() => setFamily(f)} style={{
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

        {/* CTA row */}
        <div style={{ padding: "16px 24px 20px", display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
          <button
            type="button"
            onClick={handleRunAudit}
            disabled={!canRun}
            style={{
              ...SANS, fontSize: 13.5, fontWeight: 600,
              color: canRun ? "#F7F3EA" : "rgba(247,243,234,0.4)",
              background: canRun ? "#171717" : "rgba(26,26,26,0.4)",
              padding: "11px 28px", borderRadius: 3, border: "none",
              cursor: canRun ? "pointer" : "not-allowed",
              transition: "opacity 0.15s",
            }}
          >
            Run audit →
          </button>
          {activeTab !== "structured" && !canRun && (
            <span style={{ ...SANS, fontSize: 12, color: "var(--text-muted)" }}>
              Describe your stack above to continue
            </span>
          )}
          {activeTab !== "structured" && canRun && parsed.matchedTerms.length > 0 && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const }}>
              {parsed.matchedTerms.map(term => (
                <span key={term} style={{ ...MONO, fontSize: 10, color: "var(--blue)", background: "rgba(43,108,176,0.07)", border: "1px solid rgba(43,108,176,0.18)", padding: "2px 7px", borderRadius: 2 }}>{term}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Results ── */}
      {submitted_audit && auditSnapshot && (
        <div id="audit-results">
          <div style={{ ...MONO, fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 10 }}>
            Audit preview — {auditSnapshot.fromParsed ? "detected from your text" : "structured details"} · {auditSnapshot.gpuCount}×{auditSnapshot.family} · {auditSnapshot.hours}h/mo · {auditSnapshot.situation}
          </div>

          {!submitted ? (
            <ResultSection
              listings={listings}
              family={auditSnapshot.family}
              gpuCount={auditSnapshot.gpuCount}
              hours={auditSnapshot.hours}
              situation={auditSnapshot.situation}
              workload={auditSnapshot.workload}
              onEmail={() => setShowCapture(true)}
            />
          ) : (
            <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: "32px", textAlign: "center" as const }}>
              <div style={{ fontSize: 24, color: "var(--green)", marginBottom: 12 }}>✓</div>
              <div style={{ ...SERIF, fontSize: 22, fontWeight: 400, color: "var(--text-primary)", marginBottom: 10 }}>On its way.</div>
              <div style={{ ...SANS, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
                We'll email the full provider-by-provider breakdown to <strong style={{ color: "var(--text-primary)" }}>{submittedEmail}</strong> within one business day.
              </div>
              <div style={{ ...SANS, fontSize: 12, color: "var(--text-muted)", marginTop: 14 }}>
                Want this routed automatically?{" "}
                <a href="/load-balancer" style={{ color: "var(--blue)" }}>Join the routing beta →</a>
              </div>
            </div>
          )}

          {/* Email capture panel */}
          {showCapture && !submitted && (
            <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderTop: "none", padding: "20px 24px" }}>
              <label style={labelStyle}>Work email</label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const, alignItems: "flex-start" }}>
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
      )}

      <style>{`
        @media (max-width: 760px) { .manual-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
