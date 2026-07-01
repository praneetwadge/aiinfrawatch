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

  return (
    <Suspense fallback={<div style={{ padding: "2rem", color: "#888" }}>Loading...</div>}>
      <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <MarketTicker listings={listingsData} summary={summaryData} />
        <SiteNav />

        <main>
          {/* Audit hero — headline + input card in one panel, no scroll before the CTA. */}
          <section style={{ background: "var(--panel)", borderBottom: "1px solid var(--border)" }}>
            <div style={{ maxWidth: 920, margin: "0 auto", padding: "32px 32px 28px" }}>
              <div style={{ ...MONO, fontSize: 10, color: "var(--blue)", letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 10 }}>
                Cost Audit
              </div>
              <h1 style={{ ...SERIF, fontSize: 32, fontWeight: 400, lineHeight: 1.15, color: "var(--text-primary)", marginBottom: 8 }}>
                See what you're overpaying on GPU compute.
              </h1>
              <p style={{ ...SANS, fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, maxWidth: 620, marginBottom: 20 }}>
                Paste your stack, upload a bill, or describe your setup. See the number before you give us an email.
              </p>

              <AuditTool listings={listingsData} />
            </div>
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
