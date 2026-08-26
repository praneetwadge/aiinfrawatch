// REPO PATH: src/app/page.tsx  (REPLACE EXISTING)
import { Suspense } from "react";
import { computeMarketSummary, getLatestGpuListings } from "@/lib/db/queries";
import SiteNav from "@/components/SiteNav";
import MarketTicker from "@/components/MarketTicker";
import AuditTool from "@/components/AuditTool";
import type { GpuListing } from "@/lib/market-helpers";

export const revalidate = 300;

const SANS: React.CSSProperties = { fontFamily: "var(--font-sans)" };
const SERIF: React.CSSProperties = { fontFamily: "var(--font-serif)" };

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
          {/* Audit hero — wide pitch left, wider input tabs right. Right column
              widened from a fixed 460px to 620px: at 460px the Quick Estimate
              4-metric grid and card content were cramped into a narrow column,
              which stacked rows tall and inflated hero height. Wider column
              lets that content breathe horizontally instead of vertically.
              Padding/gap trimmed slightly for the same reason — less dead
              vertical space before the market-data link / results portal. */}
          <section style={{ background: "var(--panel)", borderBottom: "1px solid var(--border)" }}>
            <div style={{ maxWidth: 1360, margin: "0 auto", padding: "48px 32px 40px" }}>
              <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 620px", gap: 48, alignItems: "start" }}>

                {/* Left: pitch */}
                <div>
                  <h1 style={{ ...SERIF, fontSize: 52, fontWeight: 400, lineHeight: 1.08, color: "var(--text-primary)", marginBottom: 20, maxWidth: 640 }}>
                    Stop overpaying for GPU compute.
                  </h1>
                  <p style={{ ...SANS, fontSize: 17, color: "var(--text-secondary)", lineHeight: 1.65, maxWidth: 520 }}>
                    See exactly where you're overpaying.
                  </p>
                </div>

                {/* Right: audit input — wider now (620px, was 460px) so card
                    content lays out horizontally rather than stacking tall.
                    Manual details is the default active tab and loads prefilled
                    with a live market example (see AuditTool.tsx), so a real,
                    editable savings number is visible the moment the hero loads
                    — this absorbs the job the old static DemoAuditPreview used
                    to do. */}
                <div>
                  <AuditTool listings={listingsData} />
                </div>

              </div>
            </div>
          </section>

          {/* Results render here, full-width, via AuditTool's portal — savings number, chart, and CTAs get room to breathe. */}
          <section style={{ maxWidth: 1360, margin: "0 auto", padding: "0 32px 64px" }}>
            <div id="audit-results-portal" />
          </section>
        </main>
      </div>
    </Suspense>
  );
}
