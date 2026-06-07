"use client";

import React from "react";
import SiteNav from "@/components/SiteNav";
import DemandForm from "@/components/DemandForm";

const SANS: React.CSSProperties  = { fontFamily: "var(--font-sans)" };
const SERIF: React.CSSProperties = { fontFamily: "var(--font-serif)" };
const MONO: React.CSSProperties  = { fontFamily: "var(--font-mono)" };

function Rule() {
  return <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "0" }} />;
}

const INPUTS = [
  { icon: "↑", label: "Cloud bill",            desc: "Upload a CSV or PDF. We normalise across providers and spot the outliers." },
  { icon: "⬡", label: "Architecture diagram",  desc: "Paste a diagram or description. We map it to equivalent GPU/API options." },
  { icon: "≡", label: "Workload description",  desc: "Tell us what you're running — inference, fine-tuning, batch, evals." },
  { icon: "⚡", label: "GPU / API usage",       desc: "Current GPU model, count, utilisation, and any API spend breakdown." },
  { icon: "◎", label: "Region / latency needs", desc: "Hard requirements, preferred regions, and latency tolerances." },
];

const OUTPUTS = [
  { label: "Monthly cost estimate",       desc: "Normalised to a single comparable figure across your providers." },
  { label: "Savings estimate",            desc: "Projected savings from provider changes, routing optimisation, or contract restructuring." },
  { label: "API vs self-host tradeoff",   desc: "When it makes sense to run your own GPUs vs use managed inference APIs." },
  { label: "Cheapest reliable path",      desc: "Not cheapest-observed — cheapest with verified capacity and acceptable risk." },
  { label: "Provider / region risk map",  desc: "Concentration risk, availability gaps, and what happens if your main vendor fails." },
];

export default function CostAuditPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <SiteNav />

      {/* Hero */}
      <div style={{ background: "var(--panel)", borderBottom: "2px solid var(--border)" }}>
        <div style={{ maxWidth: 880, margin: "0 auto", padding: "64px 32px 52px" }}>
          <div style={{ ...MONO, fontSize: 10, color: "var(--amber)", letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 18 }}>
            Cost Audit · Early Access
          </div>
          <h1 style={{ ...SERIF, fontSize: 46, fontWeight: 400, lineHeight: 1.1, color: "var(--text-primary)", marginBottom: 20 }}>
            Find out if you're overpaying<br />for AI compute.
          </h1>
          <p style={{ ...SANS, fontSize: 16, color: "var(--text-secondary)", lineHeight: 1.75, maxWidth: 580, marginBottom: 28 }}>
            Upload a bill, paste an architecture, or describe your workload. We'll compare APIs, hyperscalers, neoclouds, GPU marketplaces, regions, and contract options — and tell you where the money is going.
          </p>

          {/* Demo savings card */}
          <div style={{
            background: "var(--elevated)", border: "1px solid var(--border)",
            borderLeft: "3px solid var(--amber)", padding: "18px 22px",
            display: "inline-flex", alignItems: "flex-start", gap: 16, maxWidth: 560,
          }}>
            <div style={{ fontSize: 20, lineHeight: 1, marginTop: 2 }}>↗</div>
            <div>
              <div style={{ ...MONO, fontSize: 10, color: "var(--amber)", letterSpacing: "0.09em", marginBottom: 6 }}>EXAMPLE AUDIT</div>
              <div style={{ ...SANS, fontSize: 14, color: "var(--text-primary)", lineHeight: 1.6 }}>
                <strong>$42k/mo inference workload</strong> → <strong style={{ color: "var(--green)" }}>28–45% estimated savings</strong> by changing provider mix and routing long-running batch jobs to spot-priced neoclouds.
              </div>
              <div style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)", marginTop: 5 }}>
                Hyperscaler → Neocloud + Marketplace routing · A100 SXM 80GB · US-East
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "52px 32px 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, marginBottom: 52 }}>

          {/* Inputs */}
          <div>
            <h2 style={{ ...SANS, fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em", marginBottom: 20, paddingBottom: 10, borderBottom: "2px solid var(--text-primary)" }}>
              What you give us
            </h2>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 18 }}>
              {INPUTS.map(inp => (
                <div key={inp.label} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{
                    width: 30, height: 30, flexShrink: 0,
                    background: "var(--elevated)", border: "1px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, color: "var(--text-muted)", borderRadius: 3,
                  }}>{inp.icon}</div>
                  <div>
                    <div style={{ ...SANS, fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3 }}>{inp.label}</div>
                    <div style={{ ...SANS, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>{inp.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Outputs */}
          <div>
            <h2 style={{ ...SANS, fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em", marginBottom: 20, paddingBottom: 10, borderBottom: "2px solid var(--text-primary)" }}>
              What you get back
            </h2>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 16 }}>
              {OUTPUTS.map(out => (
                <div key={out.label} style={{ paddingLeft: 14, borderLeft: "2px solid var(--elevated)" }}>
                  <div style={{ ...SANS, fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{out.label}</div>
                  <div style={{ ...SANS, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>{out.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Rule />

        {/* Form */}
        <div style={{ marginTop: 44 }}>
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ ...SERIF, fontSize: 26, fontWeight: 400, color: "var(--text-primary)", marginBottom: 8 }}>
              Request a cost audit.
            </h2>
            <p style={{ ...SANS, fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.65 }}>
              We review each request manually. Teams spending over $10k/month on AI infrastructure are prioritised. We'll respond within 1–2 business days if your profile is a fit.
            </p>
          </div>
          <DemandForm
            source="cost-audit"
            ctaLabel="Request cost audit"
            accent="#171717"
          />
        </div>

        {/* Honesty note */}
        <div style={{ marginTop: 40, padding: "20px 22px", background: "var(--elevated)", border: "1px solid var(--border)", borderLeft: "2px solid var(--amber)" }}>
          <div style={{ ...MONO, fontSize: 10, color: "var(--amber)", letterSpacing: "0.08em", marginBottom: 6 }}>WHAT THIS IS RIGHT NOW</div>
          <p style={{ ...SANS, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            The cost audit is a manual review, not an automated tool. A real analyst looks at your numbers, compares them against market data, and writes a structured report. We're validating demand before building the automated version. If you request now, you get a human-reviewed analysis and you shape what the product becomes.
          </p>
        </div>
      </div>
    </div>
  );
}
