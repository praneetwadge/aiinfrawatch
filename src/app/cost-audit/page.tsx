import React from "react";
import { computeMarketSummary, getLatestGpuListings } from "@/lib/db/queries";
import SiteNav from "@/components/SiteNav";
import MarketTicker from "@/components/MarketTicker";
import AuditTool from "@/components/AuditTool";
import type { GpuListing } from "@/lib/market-helpers";
import type { Metadata } from "next";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Cost Audit",
  description: "Turn your AI stack into a savings plan. Describe your workload and get a market comparison showing what to move, keep, or renegotiate.",
};

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
              Turn your AI stack into a savings plan.
            </h1>
            <p style={{ ...SANS, fontSize: 15.5, color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: 620 }}>
              Describe your workload, paste a cloud bill, or drop in a provider quote. AIInfraWatch compares it against current compute markets and shows what to move, keep, or renegotiate.
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
              ["01", "Describe", "Paste your stack, bill summary, quote, or architecture notes in plain English."],
              ["02", "Compare", "See current market alternatives by GPU family, provider type, and availability risk."],
              ["03", "Act", "Get a clear first move: migrate, renegotiate, reserve, or leave production untouched."],
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
