import React from "react";
import SiteNav from "@/components/SiteNav";
import MarketTicker from "@/components/MarketTicker";
import DemandForm from "@/components/DemandForm";
import { getLatestGpuListings } from "@/lib/db/queries";
import type { GpuListing } from "@/lib/market-helpers";

export const revalidate = 300;

const SANS: React.CSSProperties = { fontFamily: "var(--font-sans)" };
const SERIF: React.CSSProperties = { fontFamily: "var(--font-serif)" };
const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)" };

const USE_CASES = [
  { title: "Batch inference", desc: "Send async jobs to cheaper reliable capacity when the market is favorable." },
  { title: "Evals", desc: "Run benchmarks and regression suites on lower-cost capacity without touching production." },
  { title: "Fine-tunes", desc: "Route training windows by cost, availability, and interruption tolerance." },
  { title: "Overflow", desc: "Add secondary capacity when your primary cloud is constrained or expensive." },
];

const STEPS = [
  ["01", "Describe routing policy", "Tell us what can move, what cannot, and what constraints matter."],
  ["02", "Map to market", "We compare the workload against current price, capacity, and reliability signals."],
  ["03", "Start with async", "Beta begins with jobs that can tolerate delay or retry, not core production serving."],
];

export default async function LoadBalancerPage() {
  let listings: GpuListing[] = [];
  try {
    listings = await getLatestGpuListings({ limit: 2000 }) as GpuListing[];
  } catch {
    // Ticker falls back to generic market signals.
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <SiteNav />
      <MarketTicker listings={listings} />

      <div style={{ background: "var(--panel)", borderBottom: "2px solid var(--border)" }}>
        <div style={{ maxWidth: 940, margin: "0 auto", padding: "62px 32px 48px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <div style={{ ...MONO, fontSize: 10, color: "var(--blue)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
              Load Balancer · Beta
            </div>
            <span style={{ ...MONO, fontSize: 9, color: "var(--blue)", background: "var(--blue-dim)", border: "1px solid rgba(30,94,255,0.2)", padding: "2px 7px", borderRadius: 2, letterSpacing: "0.06em" }}>
              ASYNC FIRST
            </span>
          </div>
          <h1 style={{ ...SERIF, fontSize: 46, fontWeight: 400, lineHeight: 1.08, color: "var(--text-primary)", marginBottom: 18 }}>
            Route non-critical AI workloads to the cheapest reliable capacity.
          </h1>
          <p style={{ ...SANS, fontSize: 16, color: "var(--text-secondary)", lineHeight: 1.75, maxWidth: 650, marginBottom: 24 }}>
            Keep production serving where it is. Start with batch jobs, evals, fine-tunes, and overflow workloads that can run async or retry safely.
          </p>
          <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
            {["Batch/eval routing", "Policy-based provider choice", "Production serving stays put"].map(label => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: label.includes("Production") ? "var(--amber)" : "var(--green)" }} />
                <span style={{ ...SANS, fontSize: 12.5, color: "var(--text-secondary)" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 940, margin: "0 auto", padding: "48px 32px 84px" }}>
        <div className="lb-grid" style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 34, alignItems: "start" }}>
          <div>
            <section style={{ marginBottom: 38 }}>
              <h2 style={{ ...SANS, fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 18, paddingBottom: 10, borderBottom: "2px solid var(--text-primary)" }}>
                Practical first use cases
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="lb-use-grid">
                {USE_CASES.map(uc => (
                  <div key={uc.title} style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: "18px 20px", boxShadow: "var(--shadow-sm)" }}>
                    <div style={{ ...SANS, fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 7 }}>{uc.title}</div>
                    <div style={{ ...SANS, fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.65 }}>{uc.desc}</div>
                  </div>
                ))}
              </div>
            </section>

            <section style={{ marginBottom: 38 }}>
              <h2 style={{ ...SANS, fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 18, paddingBottom: 10, borderBottom: "2px solid var(--text-primary)" }}>
                How the beta works
              </h2>
              <div style={{ display: "grid", gap: 18 }}>
                {STEPS.map(([step, title, desc]) => (
                  <div key={step} style={{ display: "grid", gridTemplateColumns: "46px 1fr", gap: 14 }}>
                    <div style={{ ...MONO, fontSize: 22, fontWeight: 300, color: "var(--border-mid)", lineHeight: 1 }}>{step}</div>
                    <div>
                      <div style={{ ...SANS, fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 5 }}>{title}</div>
                      <div style={{ ...SANS, fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.65 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div style={{ padding: "18px 20px", background: "var(--elevated)", border: "1px solid var(--border)", borderLeft: "2px solid var(--blue)" }}>
              <div style={{ ...MONO, fontSize: 10, color: "var(--blue)", letterSpacing: "0.08em", marginBottom: 6 }}>WHERE THIS IS RIGHT NOW</div>
              <p style={{ ...SANS, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                This is a focused beta, not a full orchestration platform. We are validating routing for async and interruption-tolerant workloads before touching latency-critical production paths.
              </p>
            </div>
          </div>

          <aside>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ ...SERIF, fontSize: 26, fontWeight: 400, color: "var(--text-primary)", marginBottom: 8 }}>Join the routing beta.</h2>
              <p style={{ ...SANS, fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.65 }}>
                Three fields first. Add deeper constraints only if they matter.
              </p>
            </div>
            <DemandForm source="load-balancer" ctaLabel="Join the beta" accent="var(--blue)" />
          </aside>
        </div>
      </div>

      <style>{`
        @media (max-width: 880px) {
          .lb-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 680px) {
          .lb-use-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
