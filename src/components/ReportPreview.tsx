// Sample-then-gate preview for the $99 migration report. The Executive
// Summary and Step 1 use the visitor's REAL computed numbers (already known
// from the audit) — nothing here is fabricated. Everything below that is a
// representative example of what the full report contains, visually gated,
// since the actual per-step content depends on the report-generation agent
// (not yet built). This is why the CTA copy says "Notify Me When Ready"
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
  providerLabel, floorProviderLabel, currentRatePerHourLabel, floorRatePerHourLabel,
  currentMonthlyLabel, recommendedMonthlyLabel, annualSavingsLabel, family, gpuCount,
  email, onEmailChange, onSubmit, loading, error, done, onClose,
}: ReportPreviewProps) {
  const gpuLabel = family === "other" ? "GPU" : family;

  const inputStyle: React.CSSProperties = {
    ...SANS, width: "100%", background: "rgba(247,243,234,0.06)", border: "1px solid rgba(247,243,234,0.22)",
    color: "#F7F3EA", padding: "10px 12px", fontSize: 13, outline: "none", borderRadius: 3,
  };
  const sectionLabel: React.CSSProperties = {
    ...MONO, fontSize: 10, color: "rgba(247,243,234,0.45)", textTransform: "uppercase" as const,
    letterSpacing: "0.06em", marginBottom: 6,
  };
  const sectionBody: React.CSSProperties = { ...SANS, fontSize: 12.5, color: "rgba(247,243,234,0.85)", lineHeight: 1.6 };

  return (
    <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(247,243,234,0.15)", borderRadius: 4, padding: "16px 18px", display: "flex", flexDirection: "column" as const, gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between" as const, alignItems: "center" as const }}>
        <div style={sectionLabel}>Sample Migration Plan</div>
        <button type="button" onClick={onClose} style={{ ...SANS, fontSize: 11, color: "rgba(247,243,234,0.5)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          Close ✕
        </button>
      </div>

      {/* Unlocked — this is the visitor's real, already-computed data */}
      <div style={sectionBody}>
        <div style={sectionLabel}>1. Executive Summary</div>
        You're running {gpuCount}× {gpuLabel} on <strong>{providerLabel}</strong> at {currentRatePerHourLabel}/hr
        (~{currentMonthlyLabel}/mo). Recommended target: <strong>{floorProviderLabel}</strong> at {floorRatePerHourLabel}/hr
        (~{recommendedMonthlyLabel}/mo) — saving ~{annualSavingsLabel}/yr.
      </div>

      <div style={sectionBody}>
        <div style={sectionLabel}>2. Migration Sequence — Step 1 of 6</div>
        Validate target capacity: confirm {floorProviderLabel} has {gpuLabel} available in your target region before touching production.
      </div>

      {/* Gated — representative example of the remaining sections */}
      <div style={{ position: "relative" as const }}>
        <div style={{ ...sectionBody, filter: "blur(3px)", userSelect: "none" as const, pointerEvents: "none" as const }}>
          <div style={sectionLabel}>Steps 2–6 · Zero-Downtime Cutover · Rollback Plan · Timeline</div>
          Provision target instance in parallel — mirror data via [transfer method] — run shadow traffic for [validation
          window] — cut over during [low-traffic window] — decommission source after [verification window] — rollback
          trigger: [condition] — estimated timeline: [range].
        </div>
        <div style={{ position: "absolute" as const, inset: 0, background: "linear-gradient(180deg, transparent, #171717 85%)" }} />
      </div>

      {!done ? (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, paddingTop: 4 }}>
          <div style={{ ...SANS, fontSize: 12, color: "rgba(247,243,234,0.6)" }}>
            That's the shape of it. Your full plan — every step, sequenced and specific to your setup — $99, launching soon.
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
        </div>
      ) : (
        <div style={{ ...SANS, fontSize: 12, color: "var(--green)" }}>✓ Got it — we'll email you the moment your full plan is ready.</div>
      )}
    </div>
  );
}
