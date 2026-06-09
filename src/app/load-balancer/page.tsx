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
  description: "Route flexible AI workloads to the best available compute. Join the beta for automated routing of evals, batch inference, fine-tuning, and overflow capacity.",
};

const SANS:  React.CSSProperties = { fontFamily: "var(--font-sans)" };
const SERIF: React.CSSProperties = { fontFamily: "var(--font-serif)" };
const MONO:  React.CSSProperties = { fontFamily: "var(--font-mono)" };

const ILLUSTRATIVE_ROUTES = [
  { provider: "RunPod",     price: "$1.89/hr", latency: "82ms", avail: "High",   tag: "Best cost",       tagColor: "var(--green)"  },
  { provider: "Lambda",     price: "$2.25/hr", latency: "74ms", avail: "Medium", tag: "Stable fallback", tagColor: "var(--amber)"  },
  { provider: "CoreWeave",  price: "$2.70/hr", latency: "61ms", avail: "High",   tag: "Lowest latency",  tagColor: "var(--blue)"   },
];

const USE_CASES = [
  { rank: "01", title: "Evals & benchmarking", note: "Interruption-tolerant, high volume, obvious savings." },
  { rank: "02", title: "Batch inference",       note: "Async by nature — route to cheapest reliable at submission time." },
  { rank: "03", title: "Fine-tuning",           note: "Savings are real once checkpointing and data-handling are set." },
  { rank: "04", title: "Overflow capacity",     note: "Spill to a secondary automatically when primary is at capacity." },
  { rank: "05", title: "Production inference",  note: "Future. Highest trust bar. Not the starting point." },
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
              Route flexible AI workloads to the best available compute.
            </h1>
            <p style={{ ...SANS, fontSize: 15.5, color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: 600 }}>
              Start with evals, batch inference, fine-tuning, and overflow capacity — the workloads where price and availability matter more than millisecond latency.
            </p>
          </div>
        </section>

        <section style={{ maxWidth: 920, margin: "0 auto", padding: "32px 32px 72px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24, alignItems: "start" }} className="lb-grid">

            {/* Left: routing simulation + use cases */}
            <div>
              {/* Simulation card */}
              <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: "22px 24px", marginBottom: 16 }}>
                <div style={{ ...MONO, fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 16 }}>
                  Illustrative example — beta, not live routing
                </div>

                {/* Workload input */}
                <div style={{ ...SANS, fontSize: 12, color: "var(--text-muted)", textAlign: "center" as const, padding: "8px 12px", background: "var(--elevated)", border: "1px solid var(--border)", marginBottom: 10 }}>
                  Batch jobs / evals
                </div>

                {/* Arrow */}
                <div style={{ textAlign: "center" as const, ...MONO, fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>↓</div>

                {/* Router */}
                <div style={{ ...SANS, fontSize: 12, fontWeight: 600, color: "#F7F3EA", background: "#171717", textAlign: "center" as const, padding: "8px 12px", marginBottom: 10, letterSpacing: "0.02em" }}>
                  AIInfraWatch Router
                </div>

                {/* Arrow */}
                <div style={{ textAlign: "center" as const, ...MONO, fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>↓</div>

                {/* Route options */}
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
                      <span style={{ ...MONO, fontSize: 11.5, color: "var(--text-primary)" }}>{r.price}</span>
                      <span style={{ ...MONO, fontSize: 11, color: "var(--text-muted)" }}>{r.latency}</span>
                      <span style={{ ...SANS, fontSize: 11, color: "var(--text-muted)" }}>{r.avail} avail.</span>
                      <span style={{ ...SANS, fontSize: 11, fontWeight: 600, color: r.tagColor }}>{r.tag}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Use cases secondary */}
              <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: "18px 22px" }}>
                <div style={{ ...SANS, fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 14 }}>Routing priority order</div>
                <div style={{ display: "grid", gap: 10 }}>
                  {USE_CASES.map(({ rank, title, note }) => (
                    <div key={rank} style={{ display: "grid", gridTemplateColumns: "24px 1fr", gap: 10, alignItems: "start" }}>
                      <div style={{ ...MONO, fontSize: 10, color: "var(--text-muted)", paddingTop: 2 }}>{rank}</div>
                      <div>
                        <div style={{ ...SANS, fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 1 }}>{title}</div>
                        <div style={{ ...SANS, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>{note}</div>
                      </div>
                    </div>
                  ))}
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
