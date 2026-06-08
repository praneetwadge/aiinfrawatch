"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { GpuListing, HYPERSCALERS, getMeta, fmtP, fmtMoney, TOTAL_TRACKED } from "@/lib/market-helpers";

const MONO:  React.CSSProperties = { fontFamily: "var(--font-mono)" };
const SANS:  React.CSSProperties = { fontFamily: "var(--font-sans)" };
const SERIF: React.CSSProperties = { fontFamily: "var(--font-serif)" };

type Situation = "hyperscaler" | "neocloud" | "marketplace" | "unsure";

const GPU_FAMILIES = ["H100", "A100", "L40S", "A10G"] as const;
type GpuFamily = typeof GPU_FAMILIES[number];

const SITUATION_OPTIONS: { value: Situation; label: string }[] = [
  { value: "hyperscaler",  label: "On a hyperscaler (AWS / GCP / Azure / OCI)" },
  { value: "neocloud",     label: "On a neocloud (CoreWeave, Lambda, Nebius…)" },
  { value: "marketplace",  label: "On a marketplace (RunPod, Vast.ai…)" },
  { value: "unsure",       label: "Not sure / mixed" },
];

type ConfidenceLevel = "high-avail" | "observed" | "partial" | "pending";

function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const config: Record<ConfidenceLevel, { label: string; color: string; bg: string; border: string }> = {
    "high-avail": { label: "High availability", color: "var(--green)",      bg: "var(--green-dim)",  border: "rgba(8,127,91,0.2)" },
    "observed":   { label: "Observed only",     color: "var(--text-muted)", bg: "var(--elevated)",   border: "var(--border-mid)" },
    "partial":    { label: "Coverage partial",  color: "var(--amber)",      bg: "var(--amber-dim)",  border: "rgba(183,121,31,0.2)" },
    "pending":    { label: "Not in snapshot",   color: "var(--amber)",      bg: "var(--amber-dim)",  border: "rgba(183,121,31,0.2)" },
  };
  const c = config[level];
  return (
    <span style={{
      ...SANS, fontSize: 9.5, color: c.color,
      background: c.bg, border: `1px solid ${c.border}`,
      padding: "2px 7px", borderRadius: 2, letterSpacing: "0.04em",
      textTransform: "uppercase" as const, whiteSpace: "nowrap" as const, fontWeight: 500,
    }}>{c.label}</span>
  );
}

function Rule() {
  return <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "0" }} />;
}

interface AuditToolProps {
  listings: GpuListing[];
}

export default function AuditTool({ listings }: AuditToolProps) {
  const [family,    setFamily]    = useState<GpuFamily>("H100");
  const [gpuCount,  setGpuCount]  = useState(8);
  const [hours,     setHours]     = useState(720);
  const [situation, setSituation] = useState<Situation>("hyperscaler");
  const [showCapture, setShowCapture] = useState(false);
  const [captureEmail, setCaptureEmail] = useState("");
  const [captureSent, setCaptureSent]   = useState(false);
  const [captureError, setCaptureError] = useState("");
  const [captureLoading, setCaptureLoading] = useState(false);

  const result = useMemo(() => {
    const familyListings = listings.filter(l => l.gpu_model.includes(family));
    if (!familyListings.length) return null;

    const sorted   = [...familyListings].sort((a, b) => a.price_per_hour - b.price_per_hour);
    const reliable = familyListings.filter(l => l.availability === "high").sort((a, b) => a.price_per_hour - b.price_per_hour);

    const cheapestReliable = reliable[0] ?? null;
    const cheapestObserved = sorted[0];
    const isReliable       = !!cheapestReliable;
    const recommendation   = cheapestReliable ?? cheapestObserved;

    // Baseline from current situation
    let baseline: GpuListing | null = null;
    if (situation === "hyperscaler") {
      baseline = familyListings
        .filter(l => HYPERSCALERS.includes(l.provider.toLowerCase()))
        .sort((a, b) => a.price_per_hour - b.price_per_hour)[0] ?? null;
    } else if (situation === "neocloud") {
      baseline = familyListings
        .filter(l => getMeta(l.provider).cat === "Neocloud")
        .sort((a, b) => a.price_per_hour - b.price_per_hour)[0] ?? null;
    } else if (situation === "marketplace") {
      baseline = familyListings
        .filter(l => getMeta(l.provider).cat === "Marketplace")
        .sort((a, b) => a.price_per_hour - b.price_per_hour)[0] ?? null;
    } else {
      // "unsure" — assume hyperscaler (stated in UI)
      baseline = familyListings
        .filter(l => HYPERSCALERS.includes(l.provider.toLowerCase()))
        .sort((a, b) => a.price_per_hour - b.price_per_hour)[0] ?? null;
    }

    const monthlyCurrent     = baseline     ? baseline.price_per_hour     * hours * gpuCount : null;
    const monthlyRecommended = recommendation.price_per_hour * hours * gpuCount;
    const savingsAbs = monthlyCurrent && monthlyCurrent > monthlyRecommended
      ? monthlyCurrent - monthlyRecommended : null;
    const savingsPct = monthlyCurrent && savingsAbs
      ? savingsAbs / monthlyCurrent : null;

    // One-sentence recommendation
    let advice = "";
    if (savingsPct !== null && savingsPct >= 0.20) {
      advice = `Move interruption-tolerant workloads (batch, evals, fine-tuning) to ${getMeta(recommendation.provider).short}; keep latency-critical inference where it is.`;
    } else if (savingsPct !== null && savingsPct >= 0.05) {
      advice = `Modest savings available — worth auditing contract terms and reserved pricing before switching providers.`;
    } else if (savingsPct !== null) {
      advice = `You're already near market floor for reliable ${family} — focus on utilisation and reserved pricing instead.`;
    } else if (!baseline) {
      advice = `No ${family} listings found for your current provider category — an audit can surface region-specific options.`;
    }

    return {
      familyListings,
      recommendation,
      isReliable,
      baseline,
      monthlyCurrent,
      monthlyRecommended,
      savingsAbs,
      savingsPct,
      advice,
    };
  }, [listings, family, gpuCount, hours, situation]);

  const handleCaptureSubmit = async () => {
    if (!captureEmail || !captureEmail.includes("@")) {
      setCaptureError("Enter a valid work email.");
      return;
    }
    setCaptureError("");
    setCaptureLoading(true);
    try {
      const spendLabel = result?.monthlyCurrent
        ? result.monthlyCurrent >= 200000 ? "Over $1M/mo"
          : result.monthlyCurrent >= 50000 ? "$200k–$1M/mo"
          : result.monthlyCurrent >= 10000 ? "$50k–$200k/mo"
          : "$10k–$50k/mo"
        : "Under $10k/mo";

      const res = await fetch("/api/audit-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: captureEmail,
          monthlySpend: spendLabel,
          workload: "Mixed workloads",
          notes: `AuditTool: ${gpuCount}×${family} · ${hours}h/mo · situation: ${situation}`,
          source: "cost-audit",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) { setCaptureError(json.error ?? "Something went wrong."); setCaptureLoading(false); return; }
      setCaptureSent(true);
    } catch {
      setCaptureError("Network error — try again.");
    } finally {
      setCaptureLoading(false);
    }
  };

  const inputSt: React.CSSProperties = {
    ...SANS, background: "var(--panel)", border: "1px solid var(--border-mid)",
    color: "var(--text-primary)", padding: "7px 10px", fontSize: 13, outline: "none", borderRadius: 3,
  };

  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>

      {/* ── Inputs ── */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 20, alignItems: "flex-end" }}>

          {/* GPU family chips */}
          <div>
            <div style={{ ...SANS, fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 6 }}>GPU family</div>
            <div style={{ display: "flex", gap: 5 }}>
              {GPU_FAMILIES.map(f => (
                <button key={f} onClick={() => setFamily(f)} style={{
                  ...MONO, fontSize: 12, padding: "5px 12px", borderRadius: 3, cursor: "pointer",
                  border: `1px solid ${family === f ? "var(--blue)" : "var(--border-mid)"}`,
                  background: family === f ? "var(--blue-dim)" : "var(--panel)",
                  color: family === f ? "var(--blue)" : "var(--text-secondary)",
                  fontWeight: family === f ? 500 : 400,
                }}>{f}</button>
              ))}
            </div>
          </div>

          {/* GPU count */}
          <div>
            <div style={{ ...SANS, fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 6 }}>GPU count</div>
            <input type="number" value={gpuCount} min={1} max={512}
              onChange={e => setGpuCount(Math.max(1, Number(e.target.value)))}
              style={{ ...inputSt, width: 72 }}
            />
          </div>

          {/* Hours/month */}
          <div>
            <div style={{ ...SANS, fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 6 }}>Hours / month</div>
            <input type="number" value={hours} min={1} max={8760}
              onChange={e => setHours(Math.max(1, Number(e.target.value)))}
              style={{ ...inputSt, width: 80 }}
            />
          </div>

          {/* Current situation */}
          <div style={{ flex: "1 1 260px" }}>
            <div style={{ ...SANS, fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 6 }}>Current setup</div>
            <div style={{ position: "relative" as const }}>
              <select value={situation} onChange={e => setSituation(e.target.value as Situation)}
                style={{ ...inputSt, width: "100%", cursor: "pointer", appearance: "none" as const }}>
                {SITUATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <span style={{ position: "absolute" as const, right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "var(--text-muted)", pointerEvents: "none" }}>▾</span>
            </div>
            {situation === "unsure" && (
              <div style={{ ...SANS, fontSize: 10.5, color: "var(--text-muted)", marginTop: 4 }}>
                Assuming hyperscaler baseline for the comparison.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Result ── */}
      <div style={{ padding: "24px 24px 20px" }}>
        {!result ? (
          <div style={{ ...SANS, fontSize: 13, color: "var(--text-muted)", padding: "12px 0" }}>
            No {family} listings in the current 25-hour window.{" "}
            <Link href="#capture" style={{ color: "var(--blue)" }}
              onClick={e => { e.preventDefault(); setShowCapture(true); }}>
              Email me when data is available →
            </Link>
          </div>
        ) : (
          <>
            {/* Main result row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 16, alignItems: "start", marginBottom: 20 }} className="audit-result-grid">

              {/* Current cost */}
              <div style={{ background: "var(--bg)", border: "1px solid var(--border)", padding: "14px 16px" }}>
                <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 6 }}>
                  {result.baseline ? `Est. current (${situation === "unsure" ? "hyperscaler assumed" : situation})` : "No baseline found"}
                </div>
                {result.monthlyCurrent ? (
                  <>
                    <div style={{ ...MONO, fontSize: 28, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.025em", lineHeight: 1 }}>
                      {fmtMoney(result.monthlyCurrent)}<span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 300 }}>/mo</span>
                    </div>
                    <div style={{ ...SANS, fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                      {getMeta(result.baseline!.provider).short} · {fmtP(result.baseline!.price_per_hour)}/hr × {gpuCount} GPUs × {hours}h
                    </div>
                  </>
                ) : (
                  <div style={{ ...SANS, fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
                    No {family} listings for this provider type in current snapshot.
                  </div>
                )}
              </div>

              {/* Recommended */}
              <div style={{ background: "var(--bg)", border: `1px solid var(--border)`, borderTop: `3px solid ${result.isReliable ? "var(--green)" : "var(--amber)"}`, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: result.isReliable ? "var(--green)" : "var(--amber)", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
                    {result.isReliable ? "Cheapest reliable" : "Cheapest observed"}
                  </div>
                  <ConfidenceBadge level={result.isReliable ? "high-avail" : "observed"} />
                </div>
                <div style={{ ...MONO, fontSize: 28, fontWeight: 500, color: result.isReliable ? "var(--green)" : "var(--amber)", letterSpacing: "-0.025em", lineHeight: 1 }}>
                  {fmtMoney(result.monthlyRecommended)}<span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 300 }}>/mo</span>
                </div>
                <div style={{ ...SANS, fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
                  {getMeta(result.recommendation.provider).short} · {result.recommendation.gpu_model}
                </div>
                <div style={{ ...MONO, fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>
                  {fmtP(result.recommendation.price_per_hour)}/hr × {gpuCount} GPUs × {hours}h
                </div>
                {!result.isReliable && (
                  <div style={{ ...SANS, fontSize: 10.5, color: "var(--amber)", marginTop: 6 }}>
                    No high-availability listings — this is cheapest-observed, not reliability-verified.
                  </div>
                )}
              </div>

              {/* Savings */}
              <div style={{ background: result.savingsPct && result.savingsPct >= 0.05 ? "var(--green-dim)" : "var(--elevated)", border: "1px solid var(--border)", padding: "14px 16px", minWidth: 130, textAlign: "center" as const }}>
                <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 6 }}>Potential saving</div>
                {result.savingsAbs ? (
                  <>
                    <div style={{ ...MONO, fontSize: 24, fontWeight: 600, color: "var(--green)", letterSpacing: "-0.02em", lineHeight: 1 }}>
                      {fmtMoney(result.savingsAbs)}
                    </div>
                    <div style={{ ...MONO, fontSize: 13, color: "var(--green)", marginTop: 2 }}>
                      {Math.round(result.savingsPct! * 100)}% less
                    </div>
                    <div style={{ ...SANS, fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>per month</div>
                  </>
                ) : (
                  <div style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    {result.monthlyCurrent ? "Already near floor" : "Select a baseline to see savings"}
                  </div>
                )}
              </div>
            </div>

            {/* Advice line */}
            {result.advice && (
              <div style={{ ...SANS, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.65, padding: "10px 14px", background: "var(--elevated)", borderLeft: "2px solid var(--border-mid)", marginBottom: 20 }}>
                {result.advice}
              </div>
            )}

            {/* Snapshot note */}
            <div style={{ ...SANS, fontSize: 10.5, color: "var(--text-muted)", marginBottom: 20 }}>
              From {result.familyListings.length} {family} listings in the current 25-hour window.
              The instant audit uses indexed public prices — the emailed breakdown is analyst-reviewed with provider-by-provider and region detail.
            </div>

            <Rule />

            {/* Optional email capture — shown after result */}
            <div style={{ marginTop: 16 }} id="capture">
              {!showCapture && !captureSent && (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button onClick={() => setShowCapture(true)} style={{
                    ...SANS, fontSize: 13, fontWeight: 600,
                    color: "#F7F3EA", background: "#171717",
                    padding: "9px 20px", borderRadius: 3, border: "none", cursor: "pointer",
                    letterSpacing: "0.01em",
                  }}>
                    Email me the full breakdown →
                  </button>
                  <span style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)" }}>
                    Provider-by-provider detail, region options, contract notes.
                  </span>
                </div>
              )}

              {showCapture && !captureSent && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" as const }}>
                  <div style={{ flex: "1 1 240px" }}>
                    <input
                      type="email"
                      placeholder="you@company.com"
                      value={captureEmail}
                      onChange={e => setCaptureEmail(e.target.value)}
                      style={{ ...inputSt, width: "100%" }}
                      autoFocus
                    />
                    {captureError && <div style={{ ...SANS, fontSize: 11, color: "var(--red)", marginTop: 4 }}>{captureError}</div>}
                  </div>
                  <button onClick={handleCaptureSubmit} disabled={captureLoading} style={{
                    ...SANS, fontSize: 13, fontWeight: 600,
                    color: "#F7F3EA", background: captureLoading ? "var(--text-muted)" : "#171717",
                    padding: "9px 20px", borderRadius: 3, border: "none",
                    cursor: captureLoading ? "not-allowed" : "pointer",
                  }}>
                    {captureLoading ? "Sending…" : "Send breakdown"}
                  </button>
                  <button onClick={() => setShowCapture(false)} style={{ ...SANS, fontSize: 12, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: "9px 0" }}>
                    Cancel
                  </button>
                </div>
              )}

              {captureSent && (
                <div style={{ ...SANS, fontSize: 13, color: "var(--green)" }}>
                  ✓ Sent — check <strong>{captureEmail}</strong> for your full breakdown.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <style>{`
        @media (max-width: 700px) {
          .audit-result-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
