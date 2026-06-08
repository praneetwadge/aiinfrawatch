"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { GpuListing, HYPERSCALERS, getMeta, fmtP, fmtMoney } from "@/lib/market-helpers";

const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)" };
const SANS: React.CSSProperties = { fontFamily: "var(--font-sans)" };
const SERIF: React.CSSProperties = { fontFamily: "var(--font-serif)" };

type Situation = "hyperscaler" | "neocloud" | "marketplace" | "unsure";
const GPU_FAMILIES = ["H100", "A100", "L40S", "A10G"] as const;
type GpuFamily = typeof GPU_FAMILIES[number];

const SITUATION_OPTIONS: { value: Situation; label: string }[] = [
  { value: "hyperscaler", label: "Hyperscaler / major cloud" },
  { value: "neocloud", label: "Neocloud" },
  { value: "marketplace", label: "GPU marketplace" },
  { value: "unsure", label: "Mixed / not sure" },
];

type ConfidenceLevel = "high-avail" | "observed";

function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const c = level === "high-avail"
    ? { label: "High availability", color: "var(--green)", bg: "var(--green-dim)", border: "rgba(8,127,91,0.2)" }
    : { label: "Observed only", color: "var(--text-muted)", bg: "var(--elevated)", border: "var(--border-mid)" };
  return (
    <span style={{
      ...SANS, fontSize: 9.5, color: c.color, background: c.bg, border: `1px solid ${c.border}`,
      padding: "2px 7px", borderRadius: 2, letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap", fontWeight: 500,
    }}>
      {c.label}
    </span>
  );
}

function Rule() {
  return <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: 0 }} />;
}

interface AuditToolProps {
  listings: GpuListing[];
}

export default function AuditTool({ listings }: AuditToolProps) {
  const [context, setContext] = useState("");
  const [family, setFamily] = useState<GpuFamily>("H100");
  const [gpuCount, setGpuCount] = useState(8);
  const [hours, setHours] = useState(720);
  const [situation, setSituation] = useState<Situation>("hyperscaler");
  const [showManual, setShowManual] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const [captureEmail, setCaptureEmail] = useState("");
  const [captureSent, setCaptureSent] = useState(false);
  const [captureError, setCaptureError] = useState("");
  const [captureLoading, setCaptureLoading] = useState(false);

  const result = useMemo(() => {
    const familyListings = listings.filter(l => l.gpu_model.toUpperCase().includes(family));
    if (!familyListings.length) return null;

    const sorted = [...familyListings].sort((a, b) => a.price_per_hour - b.price_per_hour);
    const reliable = familyListings.filter(l => l.availability === "high").sort((a, b) => a.price_per_hour - b.price_per_hour);
    const cheapestReliable = reliable[0] ?? null;
    const cheapestObserved = sorted[0];
    const isReliable = !!cheapestReliable;
    const recommendation = cheapestReliable ?? cheapestObserved;

    let baseline: GpuListing | null = null;
    if (situation === "hyperscaler" || situation === "unsure") {
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
    }

    const monthlyCurrent = baseline ? baseline.price_per_hour * hours * gpuCount : null;
    const monthlyRecommended = recommendation.price_per_hour * hours * gpuCount;
    const savingsAbs = monthlyCurrent && monthlyCurrent > monthlyRecommended ? monthlyCurrent - monthlyRecommended : null;
    const savingsPct = monthlyCurrent && savingsAbs ? savingsAbs / monthlyCurrent : null;

    let advice = "";
    if (savingsPct !== null && savingsPct >= 0.2) {
      advice = `Move interruption-tolerant workloads to ${getMeta(recommendation.provider).short}; keep latency-critical serving where it is.`;
    } else if (savingsPct !== null && savingsPct >= 0.05) {
      advice = "Some savings available — worth checking contract terms, reserved pricing, and region constraints before switching.";
    } else if (savingsPct !== null) {
      advice = `You may already be near the reliable ${family} market floor. Audit utilization, reserved terms, and workload split next.`;
    } else {
      advice = `No comparable ${family} baseline found for your current setup category. A fuller audit can inspect region-specific options.`;
    }

    return { familyListings, recommendation, isReliable, baseline, monthlyCurrent, monthlyRecommended, savingsAbs, savingsPct, advice };
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
        : "Unknown / needs audit";

      const res = await fetch("/api/audit-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: captureEmail,
          monthlySpend: spendLabel,
          workload: "Mixed workloads",
          notes: `CostAudit intake: ${context || "No free-text context"}\nManual preview: ${gpuCount}×${family} · ${hours}h/mo · situation: ${situation}`,
          source: "cost-audit",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setCaptureError(json.error ?? "Something went wrong.");
        return;
      }
      setCaptureSent(true);
    } catch {
      setCaptureError("Network error — try again.");
    } finally {
      setCaptureLoading(false);
    }
  };

  const inputSt: React.CSSProperties = {
    ...SANS, background: "var(--panel)", border: "1px solid var(--border-mid)",
    color: "var(--text-primary)", padding: "9px 11px", fontSize: 13, outline: "none", borderRadius: 3,
  };
  const labelSt: React.CSSProperties = {
    ...SANS, fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6,
  };

  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
      <div style={{ padding: "24px 26px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ ...MONO, fontSize: 10, color: "var(--blue)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
          Start with your setup
        </div>
        <h2 style={{ ...SERIF, fontSize: 26, fontWeight: 400, color: "var(--text-primary)", marginBottom: 8 }}>
          Paste what you have. We’ll turn it into an audit.
        </h2>
        <p style={{ ...SANS, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.65, maxWidth: 680, marginBottom: 18 }}>
          Current cloud bill, architecture notes, “we run 8 H100s on GCP,” or a rough description is enough. Manual GPU inputs are optional.
        </p>
        <textarea
          value={context}
          onChange={e => setContext(e.target.value)}
          rows={6}
          placeholder="Example: We run batch inference and evals on 8×H100, mostly async, currently on GCP us-central. Spend is around $180k/mo. Latency only matters for production serving; evals can move."
          style={{ ...inputSt, width: "100%", resize: "vertical", minHeight: 140, fontSize: 14, lineHeight: 1.6 }}
        />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          <button type="button" onClick={() => setShowCapture(true)} style={{
            ...SANS, fontSize: 13, fontWeight: 600, color: "#F7F3EA", background: "#171717",
            padding: "10px 20px", borderRadius: 3, border: "none", cursor: "pointer",
          }}>
            Request audit →
          </button>
          <button type="button" style={{ ...SANS, fontSize: 13, color: "var(--text-secondary)", background: "var(--elevated)", border: "1px solid var(--border-mid)", padding: "10px 14px", borderRadius: 3, cursor: "not-allowed", opacity: 0.68 }}>
            Upload diagram soon
          </button>
          <button type="button" style={{ ...SANS, fontSize: 13, color: "var(--text-secondary)", background: "var(--elevated)", border: "1px solid var(--border-mid)", padding: "10px 14px", borderRadius: 3, cursor: "not-allowed", opacity: 0.68 }}>
            Upload bill soon
          </button>
        </div>
      </div>

      <div style={{ padding: "18px 26px", borderBottom: "1px solid var(--border)", background: "var(--elevated)" }}>
        <button type="button" onClick={() => setShowManual(v => !v)} style={{ ...SANS, fontSize: 13, fontWeight: 600, color: "var(--text-primary)", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
          {showManual ? "Hide manual GPU preview" : "Enter manually instead"} <span style={{ color: "var(--text-muted)" }}>{showManual ? "↑" : "↓"}</span>
        </button>
        <span style={{ ...SANS, fontSize: 12, color: "var(--text-muted)", marginLeft: 10 }}>
          Optional calculator for quick directional savings.
        </span>

        {showManual && (
          <div style={{ marginTop: 18, display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-end" }}>
            <div>
              <div style={labelSt}>GPU family</div>
              <div style={{ display: "flex", gap: 5 }}>
                {GPU_FAMILIES.map(f => (
                  <button key={f} type="button" onClick={() => setFamily(f)} style={{
                    ...MONO, fontSize: 12, padding: "6px 12px", borderRadius: 3, cursor: "pointer",
                    border: `1px solid ${family === f ? "var(--blue)" : "var(--border-mid)"}`,
                    background: family === f ? "var(--blue-dim)" : "var(--panel)",
                    color: family === f ? "var(--blue)" : "var(--text-secondary)",
                    fontWeight: family === f ? 500 : 400,
                  }}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={labelSt}>GPU count</div>
              <input type="number" value={gpuCount} min={1} max={512} onChange={e => setGpuCount(Math.max(1, Number(e.target.value)))} style={{ ...inputSt, width: 76 }} />
            </div>
            <div>
              <div style={labelSt}>Hours / month</div>
              <input type="number" value={hours} min={1} max={8760} onChange={e => setHours(Math.max(1, Number(e.target.value)))} style={{ ...inputSt, width: 92 }} />
            </div>
            <div style={{ flex: "1 1 230px" }}>
              <div style={labelSt}>Current setup</div>
              <div style={{ position: "relative" }}>
                <select value={situation} onChange={e => setSituation(e.target.value as Situation)} style={{ ...inputSt, width: "100%", cursor: "pointer", appearance: "none" }}>
                  {SITUATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "var(--text-muted)", pointerEvents: "none" }}>▾</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "24px 26px 22px" }}>
        {!result ? (
          <div style={{ ...SANS, fontSize: 13, color: "var(--text-muted)", padding: "12px 0" }}>
            No {family} listings in the current snapshot.{" "}
            <Link href="#capture" style={{ color: "var(--blue)" }} onClick={e => { e.preventDefault(); setShowCapture(true); }}>
              Email me when data is available →
            </Link>
          </div>
        ) : (
          <>
            <div className="audit-result-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 16, alignItems: "stretch", marginBottom: 20 }}>
              <div style={{ background: "var(--bg)", border: "1px solid var(--border)", padding: "14px 16px" }}>
                <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                  {result.baseline ? `Est. current (${situation === "unsure" ? "hyperscaler assumed" : situation})` : "No baseline found"}
                </div>
                {result.monthlyCurrent ? (
                  <>
                    <div style={{ ...MONO, fontSize: 28, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.025em", lineHeight: 1 }}>
                      {fmtMoney(result.monthlyCurrent)}<span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 300 }}>/mo</span>
                    </div>
                    <div style={{ ...SANS, fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                      {getMeta(result.baseline.provider).short} · {fmtP(result.baseline.price_per_hour)}/hr × {gpuCount} GPUs × {hours}h
                    </div>
                  </>
                ) : (
                  <div style={{ ...SANS, fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>No {family} listings for this provider type.</div>
                )}
              </div>

              <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderTop: `3px solid ${result.isReliable ? "var(--green)" : "var(--amber)"}`, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: result.isReliable ? "var(--green)" : "var(--amber)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {result.isReliable ? "Cheapest reliable" : "Cheapest observed"}
                  </div>
                  <ConfidenceBadge level={result.isReliable ? "high-avail" : "observed"} />
                </div>
                <div style={{ ...MONO, fontSize: 28, fontWeight: 500, color: result.isReliable ? "var(--green)" : "var(--amber)", letterSpacing: "-0.025em", lineHeight: 1 }}>
                  {fmtMoney(result.monthlyRecommended)}<span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 300 }}>/mo</span>
                </div>
                <div style={{ ...SANS, fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>{getMeta(result.recommendation.provider).short} · {result.recommendation.gpu_model}</div>
                <div style={{ ...MONO, fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>{fmtP(result.recommendation.price_per_hour)}/hr × {gpuCount} GPUs × {hours}h</div>
              </div>

              <div style={{ background: result.savingsPct && result.savingsPct >= 0.05 ? "var(--green-dim)" : "var(--elevated)", border: "1px solid var(--border)", padding: "14px 16px", minWidth: 136, textAlign: "center" }}>
                <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Potential saving</div>
                {result.savingsAbs ? (
                  <>
                    <div style={{ ...MONO, fontSize: 24, fontWeight: 600, color: "var(--green)", letterSpacing: "-0.02em", lineHeight: 1 }}>{fmtMoney(result.savingsAbs)}</div>
                    <div style={{ ...MONO, fontSize: 13, color: "var(--green)", marginTop: 2 }}>{Math.round(result.savingsPct! * 100)}% less</div>
                    <div style={{ ...SANS, fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>per month</div>
                  </>
                ) : (
                  <div style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5 }}>{result.monthlyCurrent ? "Already near floor" : "Need baseline"}</div>
                )}
              </div>
            </div>

            {result.advice && (
              <div style={{ ...SANS, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.65, padding: "10px 14px", background: "var(--elevated)", borderLeft: "2px solid var(--border-mid)", marginBottom: 18 }}>
                {result.advice}
              </div>
            )}

            <div style={{ ...SANS, fontSize: 10.5, color: "var(--text-muted)", marginBottom: 20 }}>
              Preview from {result.familyListings.length} {family} listings. The full audit adds workload context, region constraints, and migration risk.
            </div>

            <Rule />
          </>
        )}

        <div style={{ marginTop: 16 }} id="capture">
          {!showCapture && !captureSent && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <button onClick={() => setShowCapture(true)} style={{ ...SANS, fontSize: 13, fontWeight: 600, color: "#F7F3EA", background: "#171717", padding: "9px 20px", borderRadius: 3, border: "none", cursor: "pointer", letterSpacing: "0.01em" }}>
                Email me the full breakdown →
              </button>
              <span style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)" }}>Provider detail, region options, contract notes.</span>
            </div>
          )}

          {showCapture && !captureSent && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 260px" }}>
                <input type="email" placeholder="you@company.com" value={captureEmail} onChange={e => setCaptureEmail(e.target.value)} style={{ ...inputSt, width: "100%" }} autoFocus />
                {captureError && <div style={{ ...SANS, fontSize: 11, color: "var(--red)", marginTop: 4 }}>{captureError}</div>}
              </div>
              <button onClick={handleCaptureSubmit} disabled={captureLoading} style={{ ...SANS, fontSize: 13, fontWeight: 600, color: "#F7F3EA", background: captureLoading ? "var(--text-muted)" : "#171717", padding: "9px 20px", borderRadius: 3, border: "none", cursor: captureLoading ? "not-allowed" : "pointer" }}>
                {captureLoading ? "Sending…" : "Send breakdown"}
              </button>
              <button onClick={() => setShowCapture(false)} style={{ ...SANS, fontSize: 12, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: "9px 0" }}>Cancel</button>
            </div>
          )}

          {captureSent && <div style={{ ...SANS, fontSize: 13, color: "var(--green)" }}>✓ Sent — check <strong>{captureEmail}</strong> for your full breakdown.</div>}
        </div>
      </div>

      <style>{`
        @media (max-width: 760px) {
          .audit-result-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
