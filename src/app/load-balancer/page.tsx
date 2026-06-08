import React from "react";
import { computeMarketSummary, getLatestGpuListings } from "@/lib/db/queries";
import SiteNav from "@/components/SiteNav";
import MarketTicker from "@/components/MarketTicker";
import DemandForm from "@/components/DemandForm";
import type { GpuListing } from "@/lib/market-helpers";

export const revalidate = 300;

const SANS:  React.CSSProperties = { fontFamily: "var(--font-sans)" };
const SERIF: React.CSSProperties = { fontFamily: "var(--font-serif)" };
const MONO:  React.CSSProperties = { fontFamily: "var(--font-mono)" };

const USE_CASES = [
  { rank: "01", title: "Evals & benchmarking", note: "Easiest wedge — interruption-tolerant, high volume, obvious savings." },
  { rank: "02", title: "Batch inference",       note: "Strong fit — async by nature; route to cheapest reliable capacity at submission time." },
  { rank: "03", title: "Fine-tuning",           note: "Needs checkpointing and data-handling care; savings are real once the pipeline is set." },
  { rank: "04", title: "Overflow capacity",     note: "When primary provider is at capacity, spill to a secondary automatically." },
  { rank: "05", title: "Production inference",  note: "Future, highest trust requirement. Not the starting point." },
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
              Load Balancer · Beta
            </div>
            <h1 style={{ ...SERIF, fontSize: 42, fontWeight: 400, lineHeight: 1.1, color: "var(--text-primary)", marginBottom: 16 }}>
              Automated routing starts with the workloads that can safely move.
            </h1>
            <p style={{ ...SANS, fontSize: 15.5, color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: 600 }}>
              AIInfraWatch is building routing for evals, batch inference, fine-tuning, and overflow capacity — before production-critical serving. Keep production stable. Move flexible workloads first.
            </p>
          </div>
        </section>

        <section style={{ maxWidth: 920, margin: "0 auto", padding: "32px 32px 72px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24, alignItems: "start" }} className="lb-grid">

            {/* Left: use-case hierarchy + scope */}
            <div>
              <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: "22px 24px", marginBottom: 16 }}>
                <h2 style={{ ...SERIF, fontSize: 24, fontWeight: 400, color: "var(--text-primary)", marginBottom: 18 }}>
                  Workload routing order
                </h2>
                <div style={{ display: "grid", gap: 14 }}>
                  {USE_CASES.map(({ rank, title, note }) => (
                    <div key={rank} style={{ display: "grid", gridTemplateColumns: "28px 1fr", gap: 12, alignItems: "start" }}>
                      <div style={{ ...MONO, fontSize: 10, color: "var(--text-muted)", paddingTop: 3 }}>{rank}</div>
                      <div>
                        <div style={{ ...SANS, fontSize: 13.5, fontWeight: 650, color: "var(--text-primary)", marginBottom: 2 }}>{title}</div>
                        <div style={{ ...SANS, fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.55 }}>{note}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: "14px 16px", background: "var(--bg)", border: "1px solid var(--border)" }}>
                <div style={{ ...MONO, fontSize: 10, color: "var(--blue)", letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 6 }}>Scope</div>
                <p style={{ ...SANS, fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
                  This is a narrow routing layer for jobs where price and availability matter more than millisecond latency. It is not a replacement for your orchestrator, and it is not built yet. The routing layer is being validated with early teams now.
                </p>
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
        @media (max-width: 820px) { .lb-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
