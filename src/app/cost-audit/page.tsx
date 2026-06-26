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
    getLatestGpuListings({ limit: 4000 }),
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
        </section>
      </main>

    </div>
  );
}
