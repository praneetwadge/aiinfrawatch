// Waitlist capture for the $99 migration report. No fabricated step content —
// the report-generation agent isn't built yet, so this just states the value
// and takes an email. This is why the CTA copy says "Notify Me When Ready"
// rather than implying an instant purchase — the checkout flow doesn't exist
// yet either.
"use client";
import React from "react";

const SANS: React.CSSProperties = { fontFamily: "var(--font-sans)" };
const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)" };

export interface ReportPreviewProps {
  providerLabel: string;
  floorProviderLabel: string;
  currentRatePerHourLabel: string;
  floorRatePerHourLabel: string;
  currentMonthlyLabel: string;
  recommendedMonthlyLabel: string;
  annualSavingsLabel: string;
  family: string;
  gpuCount: number;

  email: string;
  onEmailChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string;
  done: boolean;
  onClose: () => void;
}

export default function ReportPreview({
  email, onEmailChange, onSubmit, loading, error, done, onClose,
}: ReportPreviewProps) {
  const inputStyle: React.CSSProperties = {
    ...SANS, width: "100%", background: "rgba(247,243,234,0.06)", border: "1px solid rgba(247,243,234,0.22)",
    color: "#F7F3EA", padding: "10px 12px", fontSize: 13, outline: "none", borderRadius: 3,
  };
  const sectionLabel: React.CSSProperties = {
    ...MONO, fontSize: 10, color: "rgba(247,243,234,0.45)", textTransform: "uppercase" as const,
    letterSpacing: "0.06em", marginBottom: 6,
  };

  return (
    <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(247,243,234,0.15)", borderRadius: 4, padding: "16px 18px", display: "flex", flexDirection: "column" as const, gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between" as const, alignItems: "center" as const }}>
        <div style={sectionLabel}>Full Migration Plan</div>
        <button type="button" onClick={onClose} style={{ ...SANS, fontSize: 11, color: "rgba(247,243,234,0.5)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          Close ✕
        </button>
      </div>

      {!done ? (
        <>
          <div style={{ ...SANS, fontSize: 12.5, color: "rgba(247,243,234,0.85)", lineHeight: 1.6 }}>
            A sequenced, zero-downtime plan specific to your setup — target validation, cutover, rollback triggers,
            timeline. $99, launching soon.
          </div>
          <input type="email" placeholder="you@company.com" value={email} onChange={(e) => onEmailChange(e.target.value)} style={inputStyle} />
          <button
            type="button"
            onClick={onSubmit}
            disabled={loading}
            style={{
              ...SANS, fontSize: 12, fontWeight: 600, color: "var(--blue)", background: "transparent",
              border: "1px solid var(--blue)", padding: "8px 14px", borderRadius: 3, cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Submitting…" : "Notify Me When Ready →"}
          </button>
          {error && <p style={{ ...SANS, fontSize: 11.5, color: "#F2B5B5", margin: 0 }}>{error}</p>}
        </>
      ) : (
        <div style={{ ...SANS, fontSize: 12, color: "var(--green)" }}>✓ Got it — we'll email you the moment your full plan is ready.</div>
      )}
    </div>
  );
}
