import React from "react";
import { computeMarketSummary, getLatestGpuListings } from "@/lib/db/queries";
import SiteNav from "@/components/SiteNav";
import MarketTicker from "@/components/MarketTicker";
import AuditTool from "@/components/AuditTool";
import type { GpuListing } from "@/lib/market-helpers";

export const revalidate = 300;

const SANS: React.CSSProperties = { fontFamily: "var(--font-sans)" };
const SERIF: React.CSSProperties = { fontFamily: "var(--font-serif)" };
const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)" };

export default async function CostAuditPage() {
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
          <div style={{ maxWidth: 920, margin: "0 auto", padding: "44px 32px 30px" }}>
            <div style={{ ...MONO, fontSize: 10, color: "var(--blue)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14 }}>
              Cost Audit
            </div>
            <h1 style={{ ...SERIF, fontSize: 44, fontWeight: 400, lineHeight: 1.08, color: "var(--text-primary)", marginBottom: 14 }}>
              Find out if your AI infrastructure is overpriced.
            </h1>
            <p style={{ ...SANS, fontSize: 15.5, color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: 620 }}>
              Paste what you have — a bill summary, architecture notes, provider quote, or plain-English setup.
              AIInfraWatch turns live market prices into a workload-specific savings read.
            </p>
          </div>
        </section>

        <section style={{ maxWidth: 920, margin: "0 auto", padding: "28px 32px 72px" }}>
          <AuditTool listings={listings} />

          <div style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
          }} className="audit-value-grid">
            {[
              ["01", "Current spend", "Estimate whether your setup is above market for the workload."],
              ["02", "Better options", "Compare reliable alternatives by provider, region, and GPU family."],
              ["03", "Next action", "Separate what can move now from what should stay production-stable."],
            ].map(([step, title, body]) => (
              <div key={title} style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: "16px 18px" }}>
                <div style={{ ...MONO, fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>{step}</div>
                <div style={{ ...SANS, fontSize: 13, fontWeight: 650, color: "var(--text-primary)", marginBottom: 5 }}>{title}</div>
                <div style={{ ...SANS, fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.55 }}>{body}</div>
              </div>
            ))}
          </div>

          <p style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.65, marginTop: 18, maxWidth: 720 }}>
            Public prices are indicative. The useful answer depends on workload shape, reliability needs,
            utilization, contract terms, and whether jobs can run asynchronously.
          </p>
        </section>
      </main>

      <style>{`
        @media (max-width: 760px) {
          .audit-value-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
