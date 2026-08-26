// @ts-nocheck
import React from "react";
import { getLatestGpuListings } from "@/lib/db/queries";
import SiteNav from "@/components/SiteNav";
import MarketTicker from "@/components/MarketTicker";
import { PROVIDER_META, getMeta } from "@/lib/market-helpers";
import type { GpuListing } from "@/lib/market-helpers";
import type { Metadata } from "next";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Methodology — How AIInfraWatch sources and verifies prices",
  description:
    "Exactly how every GPU price is sourced: which providers are fetched live from public APIs, which come from dated rate cards, and how we define observed vs. reliable pricing.",
  robots: "index, follow",
};

const SANS: React.CSSProperties = { fontFamily: "var(--font-sans)" };
const SERIF: React.CSSProperties = { fontFamily: "var(--font-serif)" };
const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)" };

// De-duplicate PROVIDER_META by short name (it has alias keys like "google cloud").
function uniqueProviders() {
  const seen = new Set<string>();
  const out: { short: string; cat: string; source: string; asOf?: string }[] = [];
  for (const meta of Object.values(PROVIDER_META)) {
    if (seen.has(meta.short)) continue;
    seen.add(meta.short);
    out.push({ short: meta.short, cat: meta.cat, source: meta.source, asOf: meta.asOf });
  }
  // Live first, then rate_card; alphabetical within each.
  return out.sort((a, b) =>
    a.source === b.source ? a.short.localeCompare(b.short) : a.source === "live" ? -1 : 1
  );
}

export default async function MethodologyPage() {
  const listingsResult = await Promise.allSettled([getLatestGpuListings({ limit: 4000 })]);
  const listings: GpuListing[] =
    listingsResult[0].status === "fulfilled" ? (listingsResult[0].value as GpuListing[]) : [];

  const providers = uniqueProviders();
  const liveCount = providers.filter((p) => p.source === "live").length;
  const cardCount = providers.filter((p) => p.source === "rate_card").length;

  // Count live listings per provider short-name from the current window.
  const countByShort: Record<string, number> = {};
  for (const l of listings) {
    const s = getMeta(l.provider).short;
    countByShort[s] = (countByShort[s] ?? 0) + 1;
  }

  const sourceBadge = (source: string, asOf?: string) =>
    source === "live" ? (
      <span style={{ ...MONO, fontSize: 10, color: "var(--green)", background: "var(--green-dim, rgba(39,103,73,0.08))", border: "1px solid rgba(39,103,73,0.3)", padding: "2px 8px", borderRadius: 2, whiteSpace: "nowrap" }}>
        LIVE API
      </span>
    ) : (
      <span style={{ ...MONO, fontSize: 10, color: "var(--amber)", background: "var(--amber-dim, rgba(151,90,22,0.08))", border: "1px solid rgba(151,90,22,0.3)", padding: "2px 8px", borderRadius: 2, whiteSpace: "nowrap" }}>
        RATE CARD{asOf ? ` · ${asOf}` : ""}
      </span>
    );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <MarketTicker listings={listings} summary={null} />
      <SiteNav />

      <main>
        <section style={{ background: "var(--panel)", borderBottom: "1px solid var(--border)" }}>
          <div style={{ maxWidth: 920, margin: "0 auto", padding: "44px 32px 30px" }}>
            <div style={{ ...MONO, fontSize: 10, color: "var(--blue)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14 }}>
              Methodology
            </div>
            <h1 style={{ ...SERIF, fontSize: 40, fontWeight: 400, lineHeight: 1.1, color: "var(--text-primary)", marginBottom: 14 }}>
              We show our work.
            </h1>
            <p style={{ ...SANS, fontSize: 15.5, color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: 640 }}>
              Every price traces to a source. Some providers expose a live API; others publish rate cards we verify by hand and date. We label which — so you always know how fresh each number is.
            </p>
          </div>
        </section>

        <section style={{ maxWidth: 920, margin: "0 auto", padding: "32px 32px 24px" }}>
          {/* Definitions */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 32 }} className="meth-defs">
            <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: "18px 20px" }}>
              <div style={{ ...SANS, fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>Observed</div>
              <div style={{ ...SANS, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                A price that appears in a provider's listing. Availability unconfirmed — could be spot, a single region, or already gone.
              </div>
            </div>
            <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: "18px 20px" }}>
              <div style={{ ...SANS, fontSize: 13.5, fontWeight: 600, color: "var(--green)", marginBottom: 6 }}>Reliable</div>
              <div style={{ ...SANS, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                Confirmed high-availability, non-spot capacity. What we anchor savings to — a rate you can commit production workloads to.
              </div>
            </div>
          </div>

          {/* Provenance summary */}
          <div style={{ ...SANS, fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 12 }}>
            Data source by provider · {liveCount} live · {cardCount} rate card
          </div>

          <div style={{ border: "1px solid var(--border)", background: "var(--panel)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 0.7fr", gap: 12, padding: "10px 18px", borderBottom: "2px solid var(--border-mid)" }}>
              {["Provider", "Category", "Source", "In window"].map((h, i) => (
                <div key={h} style={{ ...SANS, fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: i === 3 ? "right" : "left" }}>{h}</div>
              ))}
            </div>
            {providers.map((p) => (
              <div key={p.short} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 0.7fr", gap: 12, padding: "11px 18px", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
                <div style={{ ...SANS, fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{p.short}</div>
                <div style={{ ...SANS, fontSize: 12.5, color: "var(--text-secondary)" }}>{p.cat}</div>
                <div>{sourceBadge(p.source, p.asOf)}</div>
                <div style={{ ...MONO, fontSize: 12, color: countByShort[p.short] ? "var(--text-secondary)" : "var(--text-muted)", textAlign: "right" }}>
                  {countByShort[p.short]?.toLocaleString() ?? "0"}
                </div>
              </div>
            ))}
          </div>

          <p style={{ ...SANS, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, marginTop: 14 }}>
            <strong style={{ color: "var(--text-secondary)" }}>Live API</strong> prices refresh every run.
            {" "}<strong style={{ color: "var(--text-secondary)" }}>Rate card</strong> prices are transcribed as of the date shown — treat as indicative, not real-time. We're moving rate-card providers to live APIs where possible.
          </p>
        </section>

        <section style={{ maxWidth: 920, margin: "0 auto", padding: "8px 32px 72px" }}>
          <div style={{ ...SANS, fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 12 }}>
            How a price becomes trusted
          </div>
          <ol style={{ ...SANS, fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.7, paddingLeft: 20, margin: 0 }}>
            <li style={{ marginBottom: 8 }}>Fetch or transcribe each provider's rates. Normalize model names — "H100 SXM5" and "H100 80GB SXM" become one class.</li>
            <li style={{ marginBottom: 8 }}>Validate every listing before storing. Reject non-positive prices, decimal-shift artifacts, implausible values.</li>
            <li style={{ marginBottom: 8 }}>For each GPU class, separate <em>observed</em> (cheapest listing) from <em>reliable</em> (cheapest high-availability, non-spot). Savings anchor to reliable.</li>
            <li>Refresh daily. Listings older than the window drop out — never stale silently.</li>
          </ol>
        </section>
      </main>

      <style>{`
        @media (max-width: 680px) {
          .meth-defs { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
