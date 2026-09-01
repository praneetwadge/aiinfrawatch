// REPO PATH: src/app/page.tsx  (REPLACE EXISTING — this is the merged home)
import { Suspense } from "react";
import Link from "next/link";
import { getLatestGpuListings } from "@/lib/db/queries";
import SiteNav from "@/components/SiteNav";
import MarketTicker from "@/components/MarketTicker";
import AuditTool from "@/components/AuditTool";
import {
  H100SpreadChart, GpuSmallMultiples, ProviderExplorer, Rule,
} from "@/components/DashboardClient";
import { computeMarketStats } from "@/lib/market-stats";
import type { GpuListing } from "@/lib/market-helpers";

export const revalidate = 300;

const SANS: React.CSSProperties  = { fontFamily: "var(--font-sans)" };
const SERIF: React.CSSProperties = { fontFamily: "var(--font-serif)" };
const MONO: React.CSSProperties  = { fontFamily: "var(--font-mono)" };

export default async function Page() {
  const listingsResult = await Promise.allSettled([getLatestGpuListings({ limit: 4000 })]);
  const listings: GpuListing[] =
    listingsResult[0].status === "fulfilled" ? (listingsResult[0].value as GpuListing[]) : [];

  const { activeProviders } = computeMarketStats(listings);

  return (
    <Suspense fallback={<div style={{ padding: "2rem", color: "#888" }}>Loading...</div>}>
      <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text-primary)" }}>
        <style>{`
          tr:hover td { background: rgba(20,20,20,0.015) !important; }
          select option { background: #fff; color: #171717; }
          input::placeholder { color: var(--text-muted); }
          @media (max-width: 900px) {
            .charts-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>

        <MarketTicker listings={listings} summary={null} />
        <SiteNav />

        <main>
          {/* ── Hero: audit is the primary action ── */}
          <section id="audit" style={{ background: "var(--panel)", borderBottom: "1px solid var(--border)" }}>
            <div style={{ maxWidth: 1000, margin: "0 auto", padding: "56px 32px 40px", textAlign: "center" as const }}>
              <h1 style={{
                ...SERIF, fontSize: 52, fontWeight: 400, lineHeight: 1.08,
                color: "var(--text-primary)", marginBottom: 18, maxWidth: 820, marginInline: "auto",
              }}>
                AI compute costs, from silicon to megawatt.
              </h1>
              <p style={{
                ...SANS, fontSize: 17, color: "var(--text-secondary)", lineHeight: 1.6,
                maxWidth: 640, marginInline: "auto", marginBottom: 36,
              }}>
                GPU prices across {activeProviders} providers, mapped to regional energy costs.
              </p>

              <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "left" as const }}>
                <AuditTool listings={listings} />
              </div>
            </div>
          </section>

          {/* ── Results portal — full width, appears when the audit runs ── */}
          <section style={{ maxWidth: 1360, margin: "0 auto", padding: "0 32px" }}>
            <div id="audit-results-portal" />
          </section>

          {/* ── Market data ── */}
          <section style={{ background: "var(--bg)" }}>
            <div style={{ maxWidth: 1360, margin: "0 auto", padding: "40px 32px 0" }}>
              <div style={{ marginBottom: 24 }}>
                <div className="charts-grid" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 14 }}>
                  <H100SpreadChart listings={listings} />
                  <GpuSmallMultiples listings={listings} />
                </div>
              </div>

              {/* Provider explorer — collapsed by default */}
              <div style={{ marginBottom: 44 }}>
                <details>
                  <summary style={{
                    ...SANS, fontSize: 13, fontWeight: 600, color: "var(--text-primary)",
                    cursor: "pointer", padding: "14px 0", borderTop: "1px solid var(--border)",
                    borderBottom: "1px solid var(--border)", listStyle: "none",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <span>Explore full provider index</span>
                    <span style={{ ...MONO, fontSize: 12, color: "var(--text-muted)" }}>↓</span>
                  </summary>
                  <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderTop: "none", padding: "0 20px" }}>
                    <ProviderExplorer listings={listings} />
                  </div>
                </details>
              </div>
            </div>
          </section>

          {/* ── Methodology teaser ── */}
          <section style={{ borderTop: "1px solid var(--border)" }}>
            <div style={{ maxWidth: 1360, margin: "0 auto", padding: "28px 32px 24px" }}>
              <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 10 }}>
                Data Sources &amp; Methodology
              </div>
              <p style={{ ...SANS, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 10, maxWidth: 860 }}>
                Prices from public APIs and rate cards across {activeProviders} providers, refreshed daily.
                {" "}<strong style={{ fontWeight: 600, color: "var(--text-primary)" }}>Observed</strong> = listing exists.
                {" "}<strong style={{ fontWeight: 600, color: "var(--text-primary)" }}>Reliable</strong> = confirmed high availability, non-spot.
              </p>
              <Link href="/methodology" style={{ ...SANS, fontSize: 12.5, color: "var(--blue)", textDecoration: "none", fontWeight: 600 }}>
                See full methodology →
              </Link>
            </div>
          </section>

          {/* ── Footer ── */}
          <div style={{ maxWidth: 1360, margin: "0 auto", padding: "24px 32px 64px" }}>
            <Rule />
            <div style={{ paddingTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: 10 }}>
              <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" as const }}>
                <span style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)" }}>AIInfraWatch · {activeProviders} {activeProviders === 1 ? "provider" : "providers"} · Updated daily</span>
                <Link href="/methodology" style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)", textDecoration: "none" }}>Methodology</Link>
              </div>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                {[["API","/api/gpu-prices"],["llms.txt","/llms.txt"],["OpenAPI","/openapi.json"]].map(([l,h]) => (
                  <a key={l} href={h} style={{ ...MONO, fontSize: 10.5, color: "var(--text-muted)", textDecoration: "none" }}>{l}</a>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </Suspense>
  );
}
