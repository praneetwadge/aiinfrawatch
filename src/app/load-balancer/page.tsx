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

const USE_CASES = [
  {
    title: "Batch inference",
    desc: "Route large inference jobs to the cheapest high-availability GPU at time of submission. Fall back automatically when spot prices spike.",
    badge: "High value",
  },
  {
    title: "Fine-tuning runs",
    desc: "Schedule fine-tuning across providers by cost, availability, and estimated job duration. Avoid interruptions at critical checkpoints.",
    badge: "High value",
  },
  {
    title: "Evals & benchmarking",
    desc: "Run evaluation workloads on cheapest-available capacity. Evals are interruption-tolerant — spot pricing is ideal.",
    badge: "Easy win",
  },
  {
    title: "Overflow capacity",
    desc: "When your primary provider is at capacity, automatically spill over to a secondary. No manual intervention required.",
    badge: "Risk reduction",
  },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Describe your workload",  desc: "Tell us what you're running, where, and what constraints matter — cost, latency, uptime, interruption tolerance." },
  { step: "02", title: "We map the provider space", desc: "We match your workload to the cheapest reliable path across all indexed providers, updated in real time." },
  { step: "03", title: "Route automatically",     desc: "Jobs are dispatched and rerouted based on live price and capacity signals. You set the policy; we execute it." },
];

const badgeColor = (badge: string) => {
  if (badge === "High value") return { color: "var(--green)", bg: "var(--green-dim)", border: "rgba(8,127,91,0.2)" };
  if (badge === "Easy win")   return { color: "var(--blue)",  bg: "var(--blue-dim)",  border: "rgba(30,94,255,0.2)" };
  return { color: "var(--text-muted)", bg: "var(--elevated)", border: "var(--border-mid)" };
};

export default function LoadBalancerPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <SiteNav />

      {/* Hero */}
      <div style={{ background: "var(--panel)", borderBottom: "2px solid var(--border)" }}>
        <div style={{ maxWidth: 880, margin: "0 auto", padding: "64px 32px 52px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <div style={{ ...MONO, fontSize: 10, color: "var(--blue)", letterSpacing: "0.14em", textTransform: "uppercase" as const }}>
              Load Balancer · Beta
            </div>
            <span style={{
              ...MONO, fontSize: 9, color: "var(--blue)",
              background: "var(--blue-dim)", border: "1px solid rgba(30,94,255,0.2)",
              padding: "2px 7px", borderRadius: 2, letterSpacing: "0.06em",
            }}>EARLY CONCEPT</span>
          </div>
          <h1 style={{ ...SERIF, fontSize: 46, fontWeight: 400, lineHeight: 1.1, color: "var(--text-primary)", marginBottom: 20 }}>
            Route AI workloads to the cheapest<br />reliable provider — automatically.
          </h1>
          <p style={{ ...SANS, fontSize: 16, color: "var(--text-secondary)", lineHeight: 1.75, maxWidth: 560, marginBottom: 24 }}>
            Dispatch and reroute jobs across GPU clouds, APIs, and regions based on live price, capacity, and interruption risk.
          </p>

          {/* Signal strip */}
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" as const }}>
            {[
              ["Cheapest-at-dispatch routing", "var(--green)"],
              ["Fallback on capacity loss",    "var(--blue)"],
              ["Policy-based job scheduling",  "var(--violet)"],
            ].map(([l, c]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: c }} />
                <span style={{ ...SANS, fontSize: 12.5, color: "var(--text-secondary)" }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "52px 32px 80px" }}>

        {/* How it works */}
        <div style={{ marginBottom: 52 }}>
          <h2 style={{ ...SANS, fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 24, paddingBottom: 10, borderBottom: "2px solid var(--text-primary)" }}>
            How it works
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
            {HOW_IT_WORKS.map(h => (
              <div key={h.step}>
                <div style={{ ...MONO, fontSize: 22, fontWeight: 300, color: "var(--border-mid)", marginBottom: 10 }}>{h.step}</div>
                <div style={{ ...SANS, fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>{h.title}</div>
                <div style={{ ...SANS, fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.65 }}>{h.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <Rule />

        {/* Use cases */}
        <div style={{ margin: "44px 0 52px" }}>
          <h2 style={{ ...SANS, fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 24, paddingBottom: 10, borderBottom: "2px solid var(--text-primary)" }}>
            Use cases
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {USE_CASES.map(uc => {
              const bc = badgeColor(uc.badge);
              return (
                <div key={uc.title} style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: "18px 20px", boxShadow: "var(--shadow-sm)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8, gap: 10 }}>
                    <div style={{ ...SANS, fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{uc.title}</div>
                    <span style={{ ...MONO, fontSize: 9, color: bc.color, background: bc.bg, border: `1px solid ${bc.border}`, padding: "2px 7px", borderRadius: 2, letterSpacing: "0.05em", whiteSpace: "nowrap" as const, flexShrink: 0 }}>{uc.badge}</span>
                  </div>
                  <div style={{ ...SANS, fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.65 }}>{uc.desc}</div>
                </div>
              );
            })}
          </div>
        </div>

        <Rule />

        {/* Form */}
        <div style={{ marginTop: 44 }}>
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ ...SERIF, fontSize: 26, fontWeight: 400, color: "var(--text-primary)", marginBottom: 8 }}>
              Join the load-balancer beta.
            </h2>
            <p style={{ ...SANS, fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.65 }}>
              We're building this with a small group of teams who have real routing problems. Tell us about your workload and we'll reach out to explore whether it's a fit.
            </p>
          </div>
          <DemandForm
            source="load-balancer"
            ctaLabel="Join the beta"
            accent="var(--blue)"
          />
        </div>

        {/* Honest beta note */}
        <div style={{ marginTop: 40, padding: "20px 22px", background: "var(--elevated)", border: "1px solid var(--border)", borderLeft: "2px solid var(--blue)" }}>
          <div style={{ ...MONO, fontSize: 10, color: "var(--blue)", letterSpacing: "0.08em", marginBottom: 6 }}>WHERE THIS IS RIGHT NOW</div>
          <p style={{ ...SANS, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            The routing layer is not yet built — this page captures demand from teams with real routing problems. If you join the beta, you'll get architecture conversations and early access when we launch.
          </p>
        </div>
      </div>
    </div>
  );
}
