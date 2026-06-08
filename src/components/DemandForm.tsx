"use client";

import React, { useState } from "react";

const SANS: React.CSSProperties = { fontFamily: "var(--font-sans)" };
const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)" };
const SERIF: React.CSSProperties = { fontFamily: "var(--font-serif)" };

interface DemandFormProps {
  source: "cost-audit" | "load-balancer";
  headline?: string;
  ctaLabel?: string;
  accent?: string;
}

const SPEND_OPTIONS = ["Under $10k/mo", "$10k–$50k/mo", "$50k–$200k/mo", "$200k–$1M/mo", "Over $1M/mo"];
const STACK_OPTIONS = ["AWS / GCP / Azure", "Neocloud", "GPU marketplace", "Mixed / multi-provider", "API only"];
const WORKLOAD_OPTIONS = ["Batch inference", "Evals / benchmarking", "Fine-tuning", "Overflow capacity", "Mixed workloads"];

export default function DemandForm({ source, headline, ctaLabel = source === "load-balancer" ? "Join the beta" : "Request cost audit", accent = "#171717" }: DemandFormProps) {
  const [email, setEmail] = useState("");
  const [spend, setSpend] = useState("");
  const [stack, setStack] = useState("");
  const [workload, setWorkload] = useState("");
  const [notes, setNotes] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const validate = (): string => {
    if (!email || !email.includes("@")) return "Please enter a valid work email.";
    if (!workload.trim()) return source === "load-balancer" ? "Describe the workload you want to route." : "Describe what you run.";
    if (!spend) return "Select approximate monthly AI spend.";
    return "";
  };

  const handleSubmit = async () => {
    const validErr = validate();
    if (validErr) {
      setError(validErr);
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/audit-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, monthlySpend: spend, stack, workload, notes, source }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSubmittedEmail(email);
      setSubmitted(true);
    } catch {
      setError("Network error — please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputSt: React.CSSProperties = {
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
  const selectSt: React.CSSProperties = { ...inputSt, cursor: "pointer", appearance: "none" };
  const labelSt: React.CSSProperties = {
    ...SANS,
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    display: "block",
    marginBottom: 5,
  };

  if (submitted) {
    return (
      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: "36px 32px", textAlign: "center" }}>
        <div style={{ fontSize: 28, marginBottom: 14, color: "var(--green)" }}>✓</div>
        <h3 style={{ ...SERIF, fontSize: 22, fontWeight: 400, color: "var(--text-primary)", marginBottom: 10 }}>Request received.</h3>
        <p style={{ ...SANS, fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.65, maxWidth: 420, margin: "0 auto" }}>
          {source === "cost-audit" ? (
            <>We’ll email the full provider-by-provider breakdown to <strong style={{ color: "var(--text-primary)" }}>{submittedEmail}</strong>.</>
          ) : (
            <>We review beta requests manually and reply to <strong style={{ color: "var(--text-primary)" }}>{submittedEmail}</strong> if the workload fits the first routing cohort.</>
          )}
        </p>
        <div style={{ marginTop: 20, ...MONO, fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.06em" }}>
          {source === "cost-audit" ? "COST AUDIT EARLY ACCESS" : "ASYNC ROUTING BETA"}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: "26px 28px 24px", boxShadow: "var(--shadow-sm)" }}>
      {headline && <h3 style={{ ...SERIF, fontSize: 20, fontWeight: 400, color: "var(--text-primary)", marginBottom: 20, lineHeight: 1.3 }}>{headline}</h3>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, marginBottom: 16 }}>
        <div>
          <label style={labelSt}>Work email</label>
          <input type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} style={inputSt} />
        </div>

        <div>
          <label style={labelSt}>{source === "load-balancer" ? "What workloads do you want to route?" : "What do you run?"}</label>
          <textarea
            placeholder={source === "load-balancer" ? "Example: batch inference, evals, fine-tunes, or overflow jobs that can run async." : "Example: 8×H100 on GCP, batch inference + evals, around $150k/mo."}
            value={workload}
            onChange={e => setWorkload(e.target.value)}
            rows={4}
            style={{ ...inputSt, resize: "vertical", minHeight: 96, lineHeight: 1.55 }}
          />
        </div>

        <div>
          <label style={labelSt}>Approx monthly AI infra spend</label>
          <div style={{ position: "relative" }}>
            <select value={spend} onChange={e => setSpend(e.target.value)} style={selectSt}>
              <option value="">Select range…</option>
              {SPEND_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "var(--text-muted)", pointerEvents: "none" }}>▾</span>
          </div>
        </div>
      </div>

      <button type="button" onClick={() => setShowDetails(v => !v)} style={{ ...SANS, fontSize: 12.5, color: "var(--text-secondary)", background: "none", border: "none", padding: 0, cursor: "pointer", marginBottom: showDetails ? 14 : 0 }}>
        {showDetails ? "Hide optional details" : "Add current stack / constraints"} <span style={{ color: "var(--text-muted)" }}>{showDetails ? "↑" : "↓"}</span>
      </button>

      {showDetails && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }} className="demand-details-grid">
          <div>
            <label style={labelSt}>Current stack</label>
            <div style={{ position: "relative" }}>
              <select value={stack} onChange={e => setStack(e.target.value)} style={selectSt}>
                <option value="">Select stack…</option>
                {STACK_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "var(--text-muted)", pointerEvents: "none" }}>▾</span>
            </div>
          </div>
          <div>
            <label style={labelSt}>Suggested use case</label>
            <div style={{ position: "relative" }}>
              <select value={notes} onChange={e => setNotes(e.target.value)} style={selectSt}>
                <option value="">Optional…</option>
                {WORKLOAD_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "var(--text-muted)", pointerEvents: "none" }}>▾</span>
            </div>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelSt}>Constraints — optional</label>
            <textarea
              placeholder="Latency, regions, uptime, current contracts, interruption tolerance…"
              value={notes.includes("\n") ? notes.split("\n").slice(1).join("\n") : ""}
              onChange={e => setNotes(prev => {
                const selected = prev.includes("\n") ? prev.split("\n")[0] : prev;
                return `${selected}\n${e.target.value}`;
              })}
              rows={3}
              style={{ ...inputSt, resize: "vertical", minHeight: 72 }}
            />
          </div>
        </div>
      )}

      {error && <p style={{ ...SANS, fontSize: 12, color: "var(--red)", margin: "14px 0 0" }}>{error}</p>}

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 18, flexWrap: "wrap" }}>
        <button onClick={handleSubmit} disabled={loading} style={{
          ...SANS,
          fontSize: 13,
          fontWeight: 600,
          color: "#F7F3EA",
          background: loading ? "var(--text-muted)" : accent,
          padding: "10px 24px",
          borderRadius: 3,
          border: "none",
          letterSpacing: "0.01em",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}>
          {loading ? "Submitting…" : ctaLabel}
        </button>
        <span style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)" }}>
          {source === "load-balancer" ? "Best for async or interruption-tolerant workloads first." : "Manual review. No spam."}
        </span>
      </div>

      <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
        <p style={{ ...SANS, fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
          {source === "cost-audit"
            ? "Provider-by-provider breakdown, region options, spot vs. reserved, contract notes — analyst-reviewed."
            : "Beta starts with batch inference, evals, fine-tunes, and overflow. Production serving can stay where it is."}
        </p>
      </div>

      <style>{`
        @media (max-width: 700px) {
          .demand-details-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
