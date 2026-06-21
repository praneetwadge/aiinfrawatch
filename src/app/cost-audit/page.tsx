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
  description: "Stop wasting money on AI compute. Paste your stack, bill, or provider quote and find out where you're overpaying and what can safely move.",
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
              Stop wasting money on AI compute.
            </h1>
            <p style={{ ...SANS, fontSize: 15.5, color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: 620 }}>
              Paste your stack, bill, or provider quote. AIInfraWatch shows the gap, what can safely move, and your first action — before you give us an email.
            </p>
          </div>
        </section>

        <section style={{ maxWidth: 920, margin: "0 auto", padding: "28px 32px 72px" }}>
          <AuditTool listings={listings} />

          {/* Audits make the router smarter */}
          <div style={{ marginTop: 28, background: "var(--elevated)", border: "1px solid var(--border)", borderLeft: "3px solid var(--blue)", padding: "18px 22px" }}>
            <div style={{ ...SANS, fontSize: 12, fontWeight: 600, color: "var(--blue)", textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 8 }}>
              Audits make the router smarter.
            </div>
            <p style={{ ...SANS, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65, maxWidth: 620, marginBottom: 12 }}>
              Every submitted stack helps AIInfraWatch learn which workloads are movable, which providers are viable, and where routing can save money without touching production-critical paths.
            </p>
            <a href="/load-balancer" style={{
              ...SANS, fontSize: 13, fontWeight: 600, color: "var(--blue)",
              textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4,
            }}>
              Join routing beta →
            </a>
          </div>
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
