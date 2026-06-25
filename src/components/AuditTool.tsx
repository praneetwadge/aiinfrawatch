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
function ResultSection({ r, family, gpuCount, hours, situation, workload, label }: {
  r: ComputedResult; family: GpuFamily; gpuCount: number; hours: number;
  situation: Situation; workload: WorkloadType; label?: string;
}) {
  const { baseline, recommendation, isReliable, currentMonthly, recommendedMonthly, savings, savingsPct, reliabilityRisk, isBatchFriendly, workloadLabel, advice } = r;

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

  const keepLine = !isBatchFriendly && workload !== "unsure";

  return (
    <div style={{ marginBottom: 2 }}>
      {label && (
        <div style={{ ...MONO, fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 6 }}>
          {label}
        </div>
      )}
      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderTop: `3px solid ${savings ? "var(--green)" : "var(--border-mid)"}`, padding: "20px 24px", marginBottom: 1, display: "flex", alignItems: "baseline", flexWrap: "wrap" as const, gap: 4 }}>
        {headline}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", background: "var(--panel)", border: "1px solid var(--border)", borderTop: "none", marginBottom: 1 }} className="result-grid">
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
      <style>{`@media (max-width:700px){.result-grid{grid-template-columns:1fr !important;}}`}</style>
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
  const [billFileName,   setBillFileName]   = useState<string | null>(null);
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

  const handleRunAudit = () => {
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
                  if (file) { setBillFileName(file.name); setCommitted(false); }
                }} />
                <span style={{ fontSize: 15 }}>⬆</span> Choose file
              </label>
              {billFileName && (
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ ...MONO, fontSize: 11.5, color: "var(--green)" }}>✓</span>
                  <span style={{ ...SANS, fontSize: 13, color: "var(--text-secondary)" }}>{billFileName}</span>
                  <button onClick={() => setBillFileName(null)} style={{ ...SANS, fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>remove</button>
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
                  <button onClick={() => setDiagramFileName(null)} style={{ ...SANS, fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>remove</button>
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
            Audit preview — {showUploadResult ? "file received" : primarySnapshot.fromParsed ? "detected from your text" : "your details"}
          </div>

          {showUploadResult && (
            <div>
              <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderTop: "3px solid var(--green)", padding: "20px 24px", marginBottom: 1, display: "flex", alignItems: "baseline", flexWrap: "wrap" as const, gap: 8 }}>
                <span style={{ ...MONO, fontSize: 28, fontWeight: 600, color: "var(--green)", letterSpacing: "-0.03em" }}>Bill received</span>
                <span style={{ ...SANS, fontSize: 14, color: "var(--text-secondary)" }}>
                  We'll read line-item GPU spend against the live market and email you the breakdown.
                </span>
              </div>
              <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderTop: "none", padding: "16px 24px", display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, alignItems: "start" }}>
                <div>
                  <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 4 }}>File</div>
                  <div style={{ ...MONO, fontSize: 12, color: "var(--text-primary)" }}>{billFileName ?? diagramFileName}</div>
                </div>
                <div style={{ ...SANS, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65, borderLeft: "2px solid var(--border-mid)", paddingLeft: 16 }}>
                  Enter your email below — we'll send a provider-by-provider breakdown with region options and what to move first, within one business day.
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
