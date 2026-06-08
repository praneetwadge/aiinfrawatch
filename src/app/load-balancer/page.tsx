import React from "react";
import { computeMarketSummary, getLatestGpuListings } from "@/lib/db/queries";
import SiteNav from "@/components/SiteNav";
import MarketTicker from "@/components/MarketTicker";
import DemandForm from "@/components/DemandForm";
import type { GpuListing } from "@/lib/market-helpers";

export const revalidate = 300;

const SANS: React.CSSProperties = { fontFamily: "var(--font-sans)" };
const SERIF: React.CSSProperties = { fontFamily: "var(--font-serif)" };
const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)" };

export default async function LoadBalancerPage() {
  const [listingsResult, summaryResult] = await Promise.allSettled([
    getLatestGpuListings({ limit: 2000 }),
    computeMarketSummary(),
  ]);

  const listings: GpuListing[] =
    listingsResult.status === "fulfilled" ? listingsResult.value as GpuListing[] : [];
  const summary = summaryResult.status === "fulfilled" ? summaryResult.value : null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <MarketTicker listings={listings} summary={summary} />
      <SiteNav />

      <main>
        <section style={{ background: "var(--panel)", borderBottom: "1px solid var(--border)" }}>
          <div style={{ maxWidth: 920, margin: "0 auto", padding: "44px 32px 32px" }}>
            <div style={{ ...MONO, fontSize: 10, color: "var(--blue)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14 }}>
              Load Balancer · Beta
            </div>
            <h1 style={{ ...SERIF, fontSize: 44, fontWeight: 400, lineHeight: 1.08, color: "var(--text-primary)", marginBottom: 14 }}>
              Route flexible AI jobs to cheaper reliable capacity.
            </h1>
            <p style={{ ...SANS, fontSize: 15.5, color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: 620 }}>
              Start with batch inference, evals, fine-tuning, and overflow. Keep production serving where it is.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 20 }}>
              {["Batch inference", "Evals", "Fine-tuning", "Overflow capacity"].map(item => (
                <span key={item} style={{
                  ...SANS,
                  fontSize: 12.5,
                  color: "var(--text-secondary)",
                  background: "var(--elevated)",
                  border: "1px solid var(--border)",
                  padding: "6px 10px",
                  borderRadius: 3,
                }}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section style={{ maxWidth: 920, margin: "0 auto", padding: "28px 32px 72px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 22, alignItems: "start" }} className="lb-grid">
            <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: "22px 24px" }}>
              <h2 style={{ ...SERIF, fontSize: 26, fontWeight: 400, color: "var(--text-primary)", marginBottom: 14 }}>
                What the beta actually does
              </h2>

              <div style={{ display: "grid", gap: 14 }}>
                {[
                  ["Route only flexible jobs", "Async and interruption-tolerant workloads are first. Latency-critical production paths can stay fixed."],
                  ["Choose by policy", "Set a cost, availability, region, and fallback policy before jobs move."],
                  ["Use market data", "Routing decisions come from live price and capacity signals, not stale provider tables."],
                ].map(([title, body]) => (
                  <div key={title} style={{ borderLeft: "2px solid var(--border-mid)", paddingLeft: 14 }}>
                    <div style={{ ...SANS, fontSize: 13.5, fontWeight: 650, color: "var(--text-primary)", marginBottom: 4 }}>
                      {title}
                    </div>
                    <div style={{ ...SANS, fontSize: 12.8, color: "var(--text-muted)", lineHeight: 1.6 }}>
                      {body}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 18, padding: "13px 15px", background: "var(--bg)", border: "1px solid var(--border)" }}>
                <div style={{ ...MONO, fontSize: 10, color: "var(--blue)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>
                  Scope
                </div>
                <p style={{ ...SANS, fontSize: 12.3, color: "var(--text-muted)", lineHeight: 1.6 }}>
                  This is not a promise to replace your orchestrator. It is a narrow routing layer for jobs
                  where price and availability matter more than millisecond latency.
                </p>
              </div>
            </div>

            <div>
              <DemandForm
                source="load-balancer"
                headline="Join the beta"
                ctaLabel="Request beta access"
                accent="var(--blue)"
              />
            </div>
          </div>
        </section>
      </main>

      <style>{`
        @media (max-width: 820px) {
          .lb-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
