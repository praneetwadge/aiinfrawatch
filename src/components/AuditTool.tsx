"use client";

import React, { useMemo, useState } from "react";
import {
  GpuListing,
  HYPERSCALERS,
  fmtMoney,
  fmtP,
  getMeta,
} from "@/lib/market-helpers";

const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)" };
const SANS: React.CSSProperties = { fontFamily: "var(--font-sans)" };
const SERIF: React.CSSProperties = { fontFamily: "var(--font-serif)" };

type Situation = "hyperscaler" | "neocloud" | "marketplace" | "unsure";
type GpuFamily = "H100" | "A100" | "L40S" | "A10G";

const GPU_FAMILIES: GpuFamily[] = ["H100", "A100", "L40S", "A10G"];

const SITUATION_OPTIONS: { value: Situation; label: string }[] = [
  { value: "hyperscaler", label: "Hyperscaler" },
  { value: "neocloud", label: "Neocloud" },
  { value: "marketplace", label: "Marketplace" },
  { value: "unsure", label: "Not sure" },
];

interface AuditToolProps {
  listings: GpuListing[];
}

const parsePositiveNumber = (value: string, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

export default function AuditTool({ listings }: AuditToolProps) {
  const [setupText, setSetupText] = useState("");
  const [email, setEmail] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [family, setFamily] = useState<GpuFamily>("H100");
  const [gpuCount, setGpuCount] = useState("8");
  const [hours, setHours] = useState("720");
  const [situation, setSituation] = useState<Situation>("hyperscaler");
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const inputStyle: React.CSSProperties = {
    ...SANS,
    width: "100%",
    background: "var(--panel)",
    border: "1px solid var(--border-mid)",
    color: "var(--text-primary)",
    padding: "10px 12px",
    fontSize: 13.5,
    outline: "none",
    borderRadius: 3,
  };

  const labelStyle: React.CSSProperties = {
    ...SANS,
    display: "block",
    fontSize: 10.5,
    fontWeight: 650,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    marginBottom: 6,
  };

  const manualResult = useMemo(() => {
    const count = parsePositiveNumber(gpuCount, 1);
    const monthlyHours = parsePositiveNumber(hours, 1);
    const familyListings = listings.filter(item => item.gpu_model.toUpperCase().includes(family));
    if (!familyListings.length) return null;

    const sorted = [...familyListings].sort((a, b) => a.price_per_hour - b.price_per_hour);
    const reliable = familyListings
      .filter(item => item.availability === "high")
      .sort((a, b) => a.price_per_hour - b.price_per_hour);

    let baseline: GpuListing | null = null;
    if (situation === "hyperscaler" || situation === "unsure") {
      baseline = familyListings
        .filter(item => HYPERSCALERS.includes(item.provider.toLowerCase()))
        .sort((a, b) => a.price_per_hour - b.price_per_hour)[0] ?? null;
    }
    if (situation === "neocloud") {
      baseline = familyListings
        .filter(item => getMeta(item.provider).cat === "Neocloud")
        .sort((a, b) => a.price_per_hour - b.price_per_hour)[0] ?? null;
    }
    if (situation === "marketplace") {
      baseline = familyListings
        .filter(item => getMeta(item.provider).cat === "Marketplace")
        .sort((a, b) => a.price_per_hour - b.price_per_hour)[0] ?? null;
    }

    const recommendation = reliable[0] ?? sorted[0];
    const currentMonthly = baseline ? baseline.price_per_hour * count * monthlyHours : null;
    const recommendedMonthly = recommendation.price_per_hour * count * monthlyHours;
    const savings = currentMonthly && currentMonthly > recommendedMonthly
      ? currentMonthly - recommendedMonthly
      : null;
    const savingsPct = currentMonthly && savings ? Math.round((savings / currentMonthly) * 100) : null;

    return {
      count,
      monthlyHours,
      baseline,
      recommendation,
      currentMonthly,
      recommendedMonthly,
      savings,
      savingsPct,
      isReliable: recommendation.availability === "high",
    };
  }, [family, gpuCount, hours, listings, situation]);

  const handleSubmit = async () => {
    if (!email || !email.includes("@")) {
      setError("Enter a valid work email.");
      return;
    }
    if (!setupText.trim() && !showManual) {
      setError("Paste your setup, bill summary, quote, or architecture notes.");
      return;
    }

    setError("");
    setLoading(true);

    const manualNotes = showManual
      ? `Manual estimate: ${gpuCount}×${family}, ${hours}h/mo, current category ${situation}.`
      : "";

    try {
      const response = await fetch("/api/audit-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          monthlySpend: "Unknown / audit needed",
          workload: "Cost audit intake",
          notes: [setupText.trim(), manualNotes].filter(Boolean).join("\n\n"),
          source: "cost-audit",
        }),
      });

      const json = await response.json();
      if (!response.ok || !json.success) {
        setError(json.error ?? "Something went wrong. Try again.");
        setLoading(false);
        return;
      }

      setSubmittedEmail(email);
      setSubmitted(true);
    } catch {
      setError("Network error — try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: "34px 28px", textAlign: "center" }}>
        <div style={{ fontSize: 28, color: "var(--green)", marginBottom: 12 }}>✓</div>
        <h2 style={{ ...SERIF, fontSize: 25, fontWeight: 400, color: "var(--text-primary)", marginBottom: 8 }}>
          Audit request received.
        </h2>
        <p style={{ ...SANS, fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.65, maxWidth: 460, margin: "0 auto" }}>
          We will use your setup details and the live market index to prepare the provider-by-provider read for{" "}
          <strong style={{ color: "var(--text-primary)" }}>{submittedEmail}</strong>.
        </p>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
      <div style={{ padding: "24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 230px", gap: 22, alignItems: "start" }} className="audit-intake-grid">
          <div>
            <label style={labelStyle}>Paste your current setup</label>
            <textarea
              value={setupText}
              onChange={event => setSetupText(event.target.value)}
              placeholder="Example: We run 8×H100 on GCP for batch inference and evals, around 500–700 hours/month. Production serving stays on AWS. We have a quote around $X/hr and want to know what can safely move."
              rows={8}
              style={{
                ...inputStyle,
                minHeight: 172,
                resize: "vertical",
                lineHeight: 1.55,
                fontFamily: "var(--font-sans)",
              }}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {["Architecture notes", "Cloud bill summary", "Provider quote", "Plain English is fine"].map(item => (
                <span key={item} style={{
                  ...SANS,
                  fontSize: 11.5,
                  color: "var(--text-muted)",
                  background: "var(--elevated)",
                  border: "1px solid var(--border)",
                  padding: "4px 8px",
                  borderRadius: 3,
                }}>
                  {item}
                </span>
              ))}
            </div>
          </div>

          <aside style={{ background: "var(--bg)", border: "1px solid var(--border)", padding: "17px 18px" }}>
            <div style={{ ...MONO, fontSize: 10, color: "var(--blue)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
              What you get
            </div>
            {[
              "Estimated current monthly spend",
              "Cheapest reliable alternatives",
              "Migration risk by workload",
              "One practical next step",
            ].map(item => (
              <div key={item} style={{ ...SANS, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.45, marginBottom: 9 }}>
                → {item}
              </div>
            ))}
          </aside>
        </div>

        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "start" }} className="audit-submit-grid">
          <div>
            <label style={labelStyle}>Work email</label>
            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="you@company.com"
              style={inputStyle}
            />
            {error && (
              <p style={{ ...SANS, color: "var(--red)", fontSize: 12, marginTop: 7 }}>
                {error}
              </p>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              ...SANS,
              alignSelf: "end",
              color: "#F7F3EA",
              background: loading ? "var(--text-muted)" : "#171717",
              border: "none",
              borderRadius: 3,
              padding: "11px 22px",
              fontSize: 13.5,
              fontWeight: 650,
              whiteSpace: "nowrap",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Sending…" : "Request audit →"}
          </button>
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--border)" }}>
        <button
          onClick={() => setShowManual(open => !open)}
          style={{
            ...SANS,
            width: "100%",
            background: "transparent",
            border: "none",
            color: "var(--text-secondary)",
            padding: "13px 24px",
            textAlign: "left",
            fontSize: 13,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>Enter manually instead</span>
          <span style={{ ...MONO, fontSize: 12 }}>{showManual ? "−" : "+"}</span>
        </button>

        {showManual && (
          <div style={{ padding: "0 24px 24px" }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1.1fr 0.7fr 0.8fr 1fr",
              gap: 12,
              marginBottom: 14,
            }} className="manual-grid">
              <div>
                <label style={labelStyle}>GPU family</label>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {GPU_FAMILIES.map(item => (
                    <button
                      key={item}
                      onClick={() => setFamily(item)}
                      style={{
                        ...MONO,
                        fontSize: 11.5,
                        padding: "7px 10px",
                        borderRadius: 3,
                        border: `1px solid ${family === item ? "var(--blue)" : "var(--border-mid)"}`,
                        background: family === item ? "var(--blue-dim)" : "var(--panel)",
                        color: family === item ? "var(--blue)" : "var(--text-secondary)",
                      }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>GPUs</label>
                <input
                  type="number"
                  min={1}
                  value={gpuCount}
                  onChange={event => setGpuCount(event.target.value)}
                  onBlur={() => setGpuCount(String(parsePositiveNumber(gpuCount, 1)))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Hours/mo</label>
                <input
                  type="number"
                  min={1}
                  value={hours}
                  onChange={event => setHours(event.target.value)}
                  onBlur={() => setHours(String(parsePositiveNumber(hours, 720)))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Current</label>
                <select
                  value={situation}
                  onChange={event => setSituation(event.target.value as Situation)}
                  style={{ ...inputStyle, appearance: "auto" }}
                >
                  {SITUATION_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {manualResult ? (
              <div style={{
                background: "var(--bg)",
                border: "1px solid var(--border)",
                padding: "14px 16px",
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 14,
              }} className="manual-result-grid">
                <div>
                  <div style={{ ...SANS, fontSize: 10, fontWeight: 650, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    Current estimate
                  </div>
                  <div style={{ ...MONO, fontSize: 19, color: "var(--text-primary)", marginTop: 5 }}>
                    {manualResult.currentMonthly ? `${fmtMoney(manualResult.currentMonthly)}/mo` : "No baseline"}
                  </div>
                </div>
                <div>
                  <div style={{ ...SANS, fontSize: 10, fontWeight: 650, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    Market option
                  </div>
                  <div style={{ ...MONO, fontSize: 19, color: manualResult.isReliable ? "var(--green)" : "var(--amber)", marginTop: 5 }}>
                    {fmtMoney(manualResult.recommendedMonthly)}/mo
                  </div>
                  <div style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                    {getMeta(manualResult.recommendation.provider).short} · {fmtP(manualResult.recommendation.price_per_hour)}/hr
                  </div>
                </div>
                <div>
                  <div style={{ ...SANS, fontSize: 10, fontWeight: 650, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    Potential saving
                  </div>
                  <div style={{ ...MONO, fontSize: 19, color: manualResult.savings ? "var(--green)" : "var(--text-muted)", marginTop: 5 }}>
                    {manualResult.savings ? `${fmtMoney(manualResult.savings)}/mo` : "Needs audit"}
                  </div>
                  {manualResult.savingsPct !== null && (
                    <div style={{ ...SANS, fontSize: 11.5, color: "var(--green)", marginTop: 2 }}>
                      {manualResult.savingsPct}% lower
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ ...SANS, fontSize: 12.5, color: "var(--text-muted)", background: "var(--bg)", border: "1px solid var(--border)", padding: "13px 15px" }}>
                No {family} listings in the current market snapshot.
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 760px) {
          .audit-intake-grid,
          .audit-submit-grid,
          .manual-grid,
          .manual-result-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
