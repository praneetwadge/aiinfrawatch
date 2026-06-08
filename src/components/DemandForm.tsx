"use client";

import React, { useState } from "react";

const SANS: React.CSSProperties = { fontFamily: "var(--font-sans)" };
const SERIF: React.CSSProperties = { fontFamily: "var(--font-serif)" };
const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)" };

interface DemandFormProps {
  source: "cost-audit" | "load-balancer";
  headline?: string;
  ctaLabel?: string;
  accent?: string;
}

const SPEND_OPTIONS = [
  "Under $10k/mo",
  "$10k–$50k/mo",
  "$50k–$200k/mo",
  "$200k–$1M/mo",
  "Over $1M/mo",
  "Not sure",
];

export default function DemandForm({
  source,
  headline,
  ctaLabel = source === "load-balancer" ? "Request beta access" : "Request cost audit",
  accent = "#171717",
}: DemandFormProps) {
  const [email, setEmail] = useState("");
  const [workload, setWorkload] = useState("");
  const [spend, setSpend] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  const handleSubmit = async () => {
    if (!email || !email.includes("@")) {
      setError("Enter a valid work email.");
      return;
    }
    if (!workload.trim()) {
      setError("Describe the workload you want help with.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/audit-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          monthlySpend: spend || "Not specified",
          stack: "",
          workload: workload.trim(),
          notes: details.trim(),
          source,
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
      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: "30px 26px", textAlign: "center" }}>
        <div style={{ fontSize: 27, color: "var(--green)", marginBottom: 12 }}>✓</div>
        <h3 style={{ ...SERIF, fontSize: 23, fontWeight: 400, color: "var(--text-primary)", marginBottom: 8 }}>
          Request received.
        </h3>
        <p style={{ ...SANS, fontSize: 13.2, color: "var(--text-muted)", lineHeight: 1.6 }}>
          We will review the workload and reply to{" "}
          <strong style={{ color: "var(--text-primary)" }}>{submittedEmail}</strong>.
        </p>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: "22px 22px 20px", boxShadow: "var(--shadow-sm)" }}>
      {headline && (
        <h3 style={{ ...SERIF, fontSize: 24, fontWeight: 400, color: "var(--text-primary)", marginBottom: 16 }}>
          {headline}
        </h3>
      )}

      <div style={{ display: "grid", gap: 14 }}>
        <div>
          <label style={labelStyle}>Work email</label>
          <input
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={event => setEmail(event.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>
            {source === "load-balancer" ? "Workload to route" : "What should we audit?"}
          </label>
          <textarea
            placeholder={
              source === "load-balancer"
                ? "Example: batch evals and fine-tuning jobs that can run async, currently on GCP/AWS..."
                : "Example: 8×H100 for evals and batch inference, monthly bill around..."
            }
            value={workload}
            onChange={event => setWorkload(event.target.value)}
            rows={4}
            style={{
              ...inputStyle,
              minHeight: 104,
              resize: "vertical",
              lineHeight: 1.55,
              fontFamily: "var(--font-sans)",
            }}
          />
        </div>

        <div>
          <label style={labelStyle}>Approx monthly AI infra spend</label>
          <select
            value={spend}
            onChange={event => setSpend(event.target.value)}
            style={{ ...inputStyle, appearance: "auto" }}
          >
            <option value="">Select range…</option>
            {SPEND_OPTIONS.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setShowDetails(open => !open)}
          style={{
            ...SANS,
            background: "transparent",
            border: "none",
            padding: 0,
            color: "var(--text-muted)",
            fontSize: 12.5,
            textAlign: "left",
          }}
        >
          {showDetails ? "Hide optional constraints −" : "Add optional constraints +"}
        </button>

        {showDetails && (
          <div>
            <label style={labelStyle}>Optional constraints</label>
            <textarea
              placeholder="Regions, latency, data residency, interruption tolerance, existing contracts..."
              value={details}
              onChange={event => setDetails(event.target.value)}
              rows={3}
              style={{
                ...inputStyle,
                minHeight: 82,
                resize: "vertical",
                lineHeight: 1.55,
                fontFamily: "var(--font-sans)",
              }}
            />
          </div>
        )}
      </div>

      {error && (
        <p style={{ ...SANS, fontSize: 12, color: "var(--red)", marginTop: 12 }}>
          {error}
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{
          ...SANS,
          width: "100%",
          marginTop: 16,
          color: "#F7F3EA",
          background: loading ? "var(--text-muted)" : accent,
          border: "none",
          borderRadius: 3,
          padding: "11px 18px",
          fontSize: 13.5,
          fontWeight: 650,
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Submitting…" : ctaLabel}
      </button>

      <div style={{ ...MONO, fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.05em", marginTop: 12 }}>
        {source === "load-balancer" ? "BETA · FLEXIBLE WORKLOADS FIRST" : "ANALYST-REVIEWED COST AUDIT"}
      </div>
    </div>
  );
}
