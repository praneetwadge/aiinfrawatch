import React from "react";
import { computeMarketSummary, getLatestGpuListings } from "@/lib/db/queries";
import SiteNav from "@/components/SiteNav";
import MarketTicker from "@/components/MarketTicker";
import DemandForm from "@/components/DemandForm";
import type { GpuListing } from "@/lib/market-helpers";
import type { Metadata } from "next";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Routing Beta",
  description: "Route AI workloads when compute is cheapest and capacity is available. Join the beta for automated routing of evals, batch inference, fine-tuning, and overflow capacity.",
};

const SANS:  React.CSSProperties = { fontFamily: "var(--font-sans)" };
const SERIF: React.CSSProperties = { fontFamily: "var(--font-serif)" };
const MONO:  React.CSSProperties = { fontFamily: "var(--font-mono)" };

const ROUTER_STEPS = [
  { n: "01", title: "Classifies workload flexibility", body: "Determines whether a job is async-safe, interruption-tolerant, or latency-critical before routing." },
  { n: "02", title: "Finds viable compute",           body: "Scans current availability across providers, filtered by GPU family, pricing type, and capacity signal." },
  { n: "03", title: "Routes flexible jobs",           body: "Dispatches evals, batch, and fine-tuning to the lowest reliable option that satisfies job constraints." },
  { n: "04", title: "Learns from every audit",        body: "Stack audits inform the router's model of which workloads are movable and which providers are viable." },
];

const ILLUSTRATIVE_ROUTES = [
  { provider: "RunPod",    price: "$1.89/hr", latency: "82ms", avail: "High",   tag: "Best cost",       tagColor: "var(--green)" },
  { provider: "Lambda",    price: "$2.25/hr", latency: "74ms", avail: "Medium", tag: "Stable fallback", tagColor: "var(--amber)" },
  { provider: "CoreWeave", price: "$2.70/hr", latency: "61ms", avail: "High",   tag: "Lowest latency",  tagColor: "var(--blue)"  },
];

const ENERGY_CARDS = [
  { title: "Time-shift",       body: "Run non-urgent jobs when compute and energy are cheaper — shifting demand across time without touching production schedules." },
  { title: "Region-shift",     body: "Route toward available capacity and better power conditions across regions and providers." },
  { title: "Aggregate demand", body: "Coordinate many flexible AI jobs into a meaningful load signal — the basis for demand-response participation." },
];

const ENTERPRISE_SIGNALS = [
  {
    icon: "🔒",
    title: "Zero-Payload Data Privacy",
    body: "Our routing layer touches only infrastructure metadata. Model weights, training data, and inference payloads never pass through our servers.",
  },
  {
    icon: "↔",
    title: "High-Availability Failover",
    body: "When a niche provider has an outage, routing is designed to fall back to hyperscalers automatically — so cost savings don't come at the expense of uptime.",
  },
  {
    icon: "✓",
    title: "SOC 2-Aligned Architecture",
    body: "Architected to SOC 2 Type II principles — least-privilege access, audit logging, and row-level data isolation. Formal attestation in progress.",
  },
];

export default async function LoadBalancerPage() {
  const [listingsResult, summaryResult] = await Promise.allSettled([
    getLatestGpuListings({ limit: 2000 }),
    computeMarketSummary(),
  ]);

  const listings: GpuListing[] = listingsResult.status === "fulfilled" ? listingsResult.value as GpuListing[] : [];
  const summary = summaryResult.status === "fulfilled" ? summaryResult.value : null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <MarketTicker listings={listings} summary={summary} />
      <SiteNav />

      <main>
        {/* Hero */}
        <section style={{ background: "var(--panel)", borderBottom: "1px solid var(--border)" }}>
          <div style={{ maxWidth: 920, margin: "0 auto", padding: "44px 32px 36px" }}>
            <div style={{ ...MONO, fontSize: 10, color: "var(--blue)", letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 14 }}>
              Routing Beta
            </div>
            <h1 style={{ ...SERIF, fontSize: 42, fontWeight: 400, lineHeight: 1.1, color: "var(--text-primary)", marginBottom: 16 }}>
              Route AI workloads when compute is cheapest and capacity is available.
            </h1>
            <p style={{ ...SANS, fontSize: 15.5, color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: 640 }}>
              AIInfraWatch starts with flexible jobs — evals, batch inference, fine-tuning, and overflow — then routes them across providers based on price, availability, latency tolerance, and eventually energy conditions.
            </p>
          </div>
        </section>

        <section style={{ maxWidth: 920, margin: "0 auto", padding: "32px 32px 56px" }}>

          {/* What the router does */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ ...SANS, fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.09em", marginBottom: 14 }}>What the router does</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }} className="router-steps-grid">
              {ROUTER_STEPS.map(({ n, title, body }) => (
                <div key={n} style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: "16px 18px" }}>
                  <div style={{ ...MONO, fontSize: 10, color: "var(--text-muted)", marginBottom: 7 }}>{n}</div>
                  <div style={{ ...SANS, fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 5 }}>{title}</div>
                  <div style={{ ...SANS, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>{body}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24, alignItems: "start" }} className="lb-grid">

            {/* Left: simulation + energy section */}
            <div>
              {/* Simulation */}
              <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: "22px 24px", marginBottom: 16 }}>
                <div style={{ ...MONO, fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 16 }}>
                  Illustrative beta example — not live routing yet.
                </div>

                <div style={{ ...SANS, fontSize: 12, color: "var(--text-secondary)", textAlign: "center" as const, padding: "8px 12px", background: "var(--elevated)", border: "1px solid var(--border)", marginBottom: 10 }}>
                  Batch eval job · async · H100 not required
                </div>
                <div style={{ textAlign: "center" as const, ...MONO, fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>↓</div>
                <div style={{ ...SANS, fontSize: 12, fontWeight: 600, color: "#F7F3EA", background: "#171717", textAlign: "center" as const, padding: "8px 12px", marginBottom: 4, letterSpacing: "0.02em" }}>
                  AIInfraWatch Router
                </div>
                <div style={{ ...SANS, fontSize: 11, color: "var(--text-muted)", textAlign: "center" as const, marginBottom: 10 }}>
                  Choose lowest reliable A100/L40S capacity that satisfies job constraints.
                </div>
                <div style={{ textAlign: "center" as const, ...MONO, fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>↓</div>

                <div style={{ display: "grid", gap: 8 }}>
                  {ILLUSTRATIVE_ROUTES.map((r, i) => (
                    <div key={r.provider} style={{
                      display: "grid", gridTemplateColumns: "100px 70px 50px 80px 1fr",
                      gap: 8, alignItems: "center",
                      padding: "10px 12px",
                      background: i === 0 ? "var(--green-dim)" : "var(--bg)",
                      border: `1px solid ${i === 0 ? "rgba(39,103,73,0.2)" : "var(--border)"}`,
                    }}>
                      <span style={{ ...SANS, fontSize: 12, fontWeight: i === 0 ? 600 : 400, color: "var(--text-primary)" }}>{r.provider}</span>
                      <span style={{ ...MONO, fontSize: 11.5 }}>{r.price}</span>
                      <span style={{ ...MONO, fontSize: 11, color: "var(--text-muted)" }}>{r.latency}</span>
                      <span style={{ ...SANS, fontSize: 11, color: "var(--text-muted)" }}>{r.avail} avail.</span>
                      <span style={{ ...SANS, fontSize: 11, fontWeight: 600, color: r.tagColor }}>{r.tag}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Why this matters beyond cloud cost */}
              <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: "20px 22px" }}>
                <div style={{ ...SANS, fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>Why this matters beyond cloud cost</div>
                <p style={{ ...SANS, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65, marginBottom: 16 }}>
                  Flexible AI workloads can become controllable demand. If jobs can move across time, providers, and regions, AIInfraWatch can eventually act as a load-shaping layer between AI demand, compute supply, and energy markets.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }} className="energy-grid">
                  {ENERGY_CARDS.map(({ title, body }) => (
                    <div key={title} style={{ background: "var(--elevated)", border: "1px solid var(--border)", padding: "12px 14px" }}>
                      <div style={{ ...SANS, fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 5 }}>{title}</div>
                      <div style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.55 }}>{body}</div>
                    </div>
                  ))}
                </div>
                <div style={{ ...SANS, fontSize: 11, color: "var(--text-muted)", borderTop: "1px solid var(--border)", paddingTop: 10, lineHeight: 1.55 }}>
                  Current beta focuses on compute routing first. Energy-market participation is the long-term wedge.
                </div>
              </div>
            </div>

            {/* Right: form */}
            <div>
              <DemandForm
                source="load-balancer"
                headline="Join routing beta"
                ctaLabel="Request beta access"
                accent="var(--blue)"
              />
              <div style={{ ...MONO, fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.07em", textTransform: "uppercase" as const, marginTop: 12, textAlign: "center" as const }}>
                Beta · Evals, batch, fine-tuning, overflow first
              </div>
            </div>
          </div>
        </section>

        {/* Enterprise Trust Signals */}
        <div style={{ borderTop: "1px solid var(--border)", background: "var(--panel)" }}>
          <div style={{ maxWidth: 920, margin: "0 auto", padding: "36px 32px 48px" }}>
            <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 18 }}>
              Enterprise Security &amp; Architecture
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: "var(--border)" }} className="enterprise-grid">
              {ENTERPRISE_SIGNALS.map(s => (
                <div key={s.title} style={{ background: "var(--panel)", padding: "22px 24px" }}>
                  <div style={{ fontSize: 18, marginBottom: 10 }}>{s.icon}</div>
                  <div style={{ ...SANS, fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 7, lineHeight: 1.4 }}>{s.title}</div>
                  <div style={{ ...SANS, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.7 }}>{s.body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <style>{`
        @media (max-width: 820px) {
          .lb-grid { grid-template-columns: 1fr !important; }
          .router-steps-grid { grid-template-columns: 1fr !important; }
          .energy-grid { grid-template-columns: 1fr !important; }
          .enterprise-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
