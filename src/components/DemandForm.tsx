"use client";

import React, { useState } from "react";

const SANS: React.CSSProperties  = { fontFamily: "var(--font-sans)" };
const MONO: React.CSSProperties  = { fontFamily: "var(--font-mono)" };
const SERIF: React.CSSProperties = { fontFamily: "var(--font-serif)" };

interface DemandFormProps {
  source:     "cost-audit" | "load-balancer";
  headline?:  string;
  ctaLabel?:  string;
  accent?:    string;
}

const SPEND_OPTIONS = [
  "Under $10k/mo",
  "$10k–$50k/mo",
  "$50k–$200k/mo",
  "$200k–$1M/mo",
  "Over $1M/mo",
];
const STACK_OPTIONS = [
  "AWS / GCP / Azure",
  "Neocloud (CoreWeave, Lambda, Nebius…)",
  "GPU marketplace (RunPod, Vast.ai…)",
  "Mixed / multi-provider",
  "API only (OpenAI, Anthropic, etc.)",
];
const WORKLOAD_OPTIONS = [
  "Inference / serving",
  "Fine-tuning / training",
  "Batch processing / evals",
  "Mixed workloads",
  "Not sure yet",
];

export default function DemandForm({
  source,
  headline,
  ctaLabel = source === "load-balancer" ? "Join the beta" : "Request cost audit",
  accent   = "#171717",
}: DemandFormProps) {
  const [email,     setEmail]     = useState("");
  const [spend,     setSpend]     = useState("");
  const [stack,     setStack]     = useState("");
  const [workload,  setWorkload]  = useState("");
  const [notes,     setNotes]     = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

  const validate = (): string => {
    if (!email || !email.includes("@"))  return "Please enter a valid work email.";
    if (!spend)                           return "Please select your approximate monthly AI spend.";
    if (!workload)                        return "Please select your primary workload type.";
    return "";
  };

  const handleSubmit = async () => {
    const validErr = validate();
    if (validErr) { setError(validErr); return; }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/audit-request", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, monthlySpend: spend, stack, workload, notes, source }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error ?? "Something went wrong. Please try again.");
        setLoading(false);
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
    ...SANS, width: "100%",
    background: "var(--panel)", border: "1px solid var(--border-mid)",
    color: "var(--text-primary)", padding: "10px 12px",
    fontSize: 13.5, outline: "none", borderRadius: 3,
  };
  const selectSt: React.CSSProperties = { ...inputSt, cursor: "pointer", appearance: "none" as const };
  const labelSt: React.CSSProperties  = {
    ...SANS, fontSize: 11, fontWeight: 600, color: "var(--text-muted)",
    textTransform: "uppercase" as const, letterSpacing: "0.07em",
    display: "block", marginBottom: 5,
  };

  if (submitted) {
    return (
      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: "36px 32px", textAlign: "center" as const }}>
        <div style={{ fontSize: 28, marginBottom: 14, color: "var(--green)" }}>✓</div>
        <h3 style={{ ...SERIF, fontSize: 22, fontWeight: 400, color: "var(--text-primary)", marginBottom: 10 }}>
          Request received.
        </h3>
        <p style={{ ...SANS, fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.65, maxWidth: 400, margin: "0 auto" }}>
          {source === "cost-audit"
            ? <>We'll email the full provider-by-provider breakdown to <strong style={{ color: "var(--text-primary)" }}>{submittedEmail}</strong>.</>
            : <>We review beta requests manually. If your workload fits, we'll reply to <strong style={{ color: "var(--text-primary)" }}>{submittedEmail}</strong> within 1–2 business days.</>
          }
        </p>
        <div style={{ marginTop: 20, ...MONO, fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.06em" }}>
          {source === "cost-audit" ? "COST AUDIT EARLY ACCESS" : "LOAD BALANCER BETA"}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: "28px 28px 24px" }}>
      {headline && (
        <h3 style={{ ...SERIF, fontSize: 20, fontWeight: 400, color: "var(--text-primary)", marginBottom: 20, lineHeight: 1.3 }}>{headline}</h3>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelSt}>Work email</label>
          <input
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={inputSt}
          />
        </div>

        <div>
          <label style={labelSt}>Monthly AI infra spend</label>
          <div style={{ position: "relative" as const }}>
            <select value={spend} onChange={e => setSpend(e.target.value)} style={selectSt}>
              <option value="">Select range…</option>
              {SPEND_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <span style={{ position: "absolute" as const, right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "var(--text-muted)", pointerEvents: "none" }}>▾</span>
          </div>
        </div>

        <div>
          <label style={labelSt}>Current stack</label>
          <div style={{ position: "relative" as const }}>
            <select value={stack} onChange={e => setStack(e.target.value)} style={selectSt}>
              <option value="">Select stack…</option>
              {STACK_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <span style={{ position: "absolute" as const, right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "var(--text-muted)", pointerEvents: "none" }}>▾</span>
          </div>
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelSt}>Primary workload type</label>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
            {WORKLOAD_OPTIONS.map(o => (
              <button key={o} onClick={() => setWorkload(o)} style={{
                ...SANS, fontSize: 12, padding: "5px 12px", borderRadius: 3,
                border: `1px solid ${workload === o ? accent : "var(--border-mid)"}`,
                background: workload === o
                  ? (accent === "#171717" ? "#171717" : "var(--amber-dim)")
                  : "var(--panel)",
                color: workload === o
                  ? (accent === "#171717" ? "#F7F3EA" : "var(--amber)")
                  : "var(--text-secondary)",
                fontWeight: workload === o ? 500 : 400,
                cursor: "pointer",
              }}>{o}</button>
            ))}
          </div>
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelSt}>
            Anything else we should know{" "}
            <span style={{ fontWeight: 400, textTransform: "none" as const }}>— optional</span>
          </label>
          <textarea
            placeholder="Current provider, contract situation, what's driving the review…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            style={{ ...inputSt, resize: "vertical" as const, minHeight: 72 }}
          />
        </div>
      </div>

      {error && (
        <p style={{ ...SANS, fontSize: 12, color: "var(--red)", marginBottom: 12 }}>{error}</p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            ...SANS, fontSize: 13, fontWeight: 600,
            color: "#F7F3EA", background: loading ? "var(--text-muted)" : accent,
            padding: "10px 24px", borderRadius: 3, border: "none",
            letterSpacing: "0.01em", cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Submitting…" : ctaLabel}
        </button>
        <span style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)" }}>
          We review each request manually. No spam.
        </span>
      </div>

      <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
        <p style={{ ...SANS, fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
          {source === "cost-audit"
            ? "Provider-by-provider breakdown, region options, spot vs. reserved, contract notes — analyst-reviewed."
            : "Beta · Architecture review included · We prioritise teams with $50k+ monthly compute spend."}
        </p>
      </div>
    </div>
  );
}
