// REPO PATH: src/app/page.tsx  (REPLACE EXISTING)
import { Suspense } from "react";
import { computeMarketSummary, getLatestGpuListings } from "@/lib/db/queries";
import SiteNav from "@/components/SiteNav";
import MarketTicker from "@/components/MarketTicker";
import AuditTool from "@/components/AuditTool";
import AuditStatStrip from "@/components/AuditStatStrip";
import type { GpuListing } from "@/lib/market-helpers";

export const revalidate = 300;

const SANS: React.CSSProperties = { fontFamily: "var(--font-sans)" };
const SERIF: React.CSSProperties = { fontFamily: "var(--font-serif)" };
const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)" };

export default async function Page() {
  const [summary, listings] = await Promise.allSettled([
    computeMarketSummary(),
    getLatestGpuListings({ limit: 4000 }),
  ]);

  const summaryData = summary.status === "fulfilled" ? summary.value : null;
  const listingsData: GpuListing[] = listings.status === "fulfilled" ? listings.value as GpuListing[] : [];

  return (
    <Suspense fallback={<div style={{ padding: "2rem", color: "#888" }}>Loading...</div>}>
      <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <MarketTicker listings={listingsData} summary={summaryData} />
        <SiteNav />

        <main>
          {/* AuditHero — hard $ promise, single primary CTA. No brochure copy. */}
          <section style={{ background: "var(--panel)", borderBottom: "1px solid var(--border)" }}>
            <div style={{ maxWidth: 920, margin: "0 auto", padding: "44px 32px 30px" }}>
              <div style={{ ...MONO, fontSize: 10, color: "var(--blue)", letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 14 }}>
                Cost Audit
              </div>
              <h1 style={{ ...SERIF, fontSize: 44, fontWeight: 400, lineHeight: 1.08, color: "var(--text-primary)", marginBottom: 14 }}>
                See what you're overpaying on GPU compute.
              </h1>
              <p style={{ ...SANS, fontSize: 15.5, color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: 620, marginBottom: 18 }}>
                Paste your stack, bill, or provider quote. Get a dollar number against the live reliable-floor market — before you give us an email.
              </p>
            </div>
          </section>

          <AuditStatStrip listings={listingsData} />

          <section id="audit-tool" style={{ maxWidth: 920, margin: "0 auto", padding: "28px 32px 8px" }}>
            <AuditTool listings={listingsData} />
          </section>

          {/* Quiet Market-data link — not a co-primary CTA, just a proof-surface pointer. */}
          <section style={{ maxWidth: 920, margin: "0 auto", padding: "8px 32px 64px", textAlign: "center" as const }}>
            <a href="/market-data" style={{ ...SANS, fontSize: 12.5, color: "var(--text-muted)", textDecoration: "underline" }}>
              See the live market data behind this number →
            </a>
          </section>
        </main>
      </div>
    </Suspense>
  );
}
