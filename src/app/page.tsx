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
        <style>{`
          @media (max-width: 980px) {
            .hero-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
          }
        `}</style>
        <MarketTicker listings={listingsData} summary={summaryData} />
        <SiteNav />

        <main>
          {/* Audit hero — wide pitch left, compact input tabs right. Results render full-width below via portal. */}
          <section style={{ background: "var(--panel)", borderBottom: "1px solid var(--border)" }}>
            <div style={{ maxWidth: 1360, margin: "0 auto", padding: "56px 32px 48px" }}>
              <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 460px", gap: 64, alignItems: "start" }}>

                {/* Left: pitch */}
                <div>
                  <div style={{ ...MONO, fontSize: 10, color: "var(--blue)", letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 16 }}>
                    Cost Audit
                  </div>
                  <h1 style={{ ...SERIF, fontSize: 52, fontWeight: 400, lineHeight: 1.08, color: "var(--text-primary)", marginBottom: 20, maxWidth: 640 }}>
                    Stop overpaying for GPU compute.
                  </h1>
                  <p style={{ ...SANS, fontSize: 17, color: "var(--text-secondary)", lineHeight: 1.65, maxWidth: 520, marginBottom: 0 }}>
                    Most teams are paying hyperscaler prices for commodity compute. We find the gap, show you the number, and help you move — no lock-in, no sales calls.
                  </p>

                  {/* Compact 3-stat strip — moved here from a full-width banded
                      section below the whole hero grid, and shrunk substantially.
                      Same computeMarketStats() source of truth as MarketHero on
                      /market-data. */}
                  <AuditStatStrip listings={listingsData} />
                </div>

                {/* Right: audit input — narrower, secondary to the pitch. Manual
                    details is the default active tab and loads prefilled with a
                    live market example (see AuditTool.tsx), so a real, editable
                    savings number is visible the moment the hero loads — this
                    absorbs the job the old static DemoAuditPreview used to do. */}
                <div>
                  <AuditTool listings={listingsData} />
                </div>

              </div>
            </div>
          </section>

          {/* Results render here, full-width, via AuditTool's portal — savings number, chart, and CTAs get room to breathe. */}
          <section style={{ maxWidth: 1360, margin: "0 auto", padding: "0 32px 8px" }}>
            <div id="audit-results-portal" />
          </section>

          {/* Quiet Market-data link — not a co-primary CTA, just a proof-surface pointer. */}
          <section style={{ maxWidth: 1360, margin: "0 auto", padding: "8px 32px 64px", textAlign: "center" as const }}>
            <a href="/market-data" style={{ ...SANS, fontSize: 12.5, color: "var(--text-muted)", textDecoration: "underline" }}>
              See the live market data behind this number →
            </a>
          </section>
        </main>
      </div>
    </Suspense>
  );
}
