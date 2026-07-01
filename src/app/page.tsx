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
const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)" };

export default async function Page() {
  const [summary, listings] = await Promise.allSettled([
    computeMarketSummary(),
    getLatestGpuListings({ limit: 4000 }),
  ]);

  const summaryData = summary.status === "fulfilled" ? summary.value : null;
  const listingsData: GpuListing[] = listings.status === "fulfilled" ? listings.value as GpuListing[] : [];
  const providerCount = new Set(listingsData.map(l => l.provider)).size;

  return (
    <Suspense fallback={<div style={{ padding: "2rem", color: "#888" }}>Loading...</div>}>
      <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <style>{`
          @media (max-width: 900px) {
            .hero-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
          }
        `}</style>
        <MarketTicker listings={listingsData} summary={summaryData} />
        <SiteNav />

        <main>
          {/* Audit hero — pitch left, audit tool right. Wide, homepage-scale, not a narrow tool page. */}
          <section style={{ background: "var(--panel)", borderBottom: "1px solid var(--border)" }}>
            <div style={{ maxWidth: 1360, margin: "0 auto", padding: "48px 32px 44px" }}>
              <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 56, alignItems: "start" }}>

                {/* Left: pitch */}
                <div>
                  <div style={{ ...MONO, fontSize: 10, color: "var(--blue)", letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 14 }}>
                    Cost Audit
                  </div>
                  <h1 style={{ ...SERIF, fontSize: 38, fontWeight: 400, lineHeight: 1.14, color: "var(--text-primary)", marginBottom: 16 }}>
                    See what you're overpaying on GPU compute.
                  </h1>
                  <p style={{ ...SANS, fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 22 }}>
                    Paste your stack, upload a bill, or describe your setup. See the number before you give us an email.
                  </p>
                  <p style={{ ...SANS, fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
                    No account needed. We compare against live pricing across {providerCount} GPU providers and show you exactly where the gap is.
                  </p>
                </div>

                {/* Right: audit tool */}
                <div>
                  <AuditTool listings={listingsData} />
                </div>

              </div>
            </div>
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
