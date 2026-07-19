// REPO PATH: src/components/AuditStatStrip.tsx  (REPLACE EXISTING)
// @ts-nocheck
import { computeMarketStats } from "@/lib/market-stats";
import { getMeta, fmtP } from "@/lib/market-helpers";
import type { GpuListing } from "@/lib/market-helpers";

const SANS: React.CSSProperties = { fontFamily: "var(--font-sans)" };
const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)" };

interface AuditStatStripProps {
  listings: GpuListing[];
}

// Compact inline stat row: H100 floor, hyperscaler premium %, provider count.
// Same source of truth as MarketHero on /market-data (computeMarketStats) —
// intentional single-computation, two-presentation exception to the
// single-metric-appearance rule.
//
// Previously a full-width banded <section> (maxWidth:1360, 3-col boxed grid,
// ~16px/22px cell padding, ~19px value type) rendered below the entire hero
// grid. Moved to sit directly under the hero pitch paragraph and shrunk
// significantly — same data, a fraction of the vertical footprint, so the
// audit tool / demo preview below the fold need less scroll to reach.
export default function AuditStatStrip({ listings }: AuditStatStripProps) {
  const { activeProviders, cheapestH100High, h100Prices, premiumPct, a100PremiumPct } =
    computeMarketStats(listings);

  const effectivePremium = (premiumPct !== null && premiumPct > 0) ? premiumPct
    : (a100PremiumPct !== null && a100PremiumPct > 0) ? a100PremiumPct
    : null;

  const h100Value = cheapestH100High
    ? fmtP(cheapestH100High.price_per_hour)
    : h100Prices.length ? fmtP(h100Prices[0])
    : null;
  const h100Sub = cheapestH100High
    ? getMeta(cheapestH100High.provider).short
    : h100Prices.length ? "observed"
    : "n/a";
  const h100Color = cheapestH100High ? "var(--green)" : "var(--amber)";

  return (
    <div style={{
      display: "flex",
      flexWrap: "wrap" as const,
      gap: 26,
      marginTop: 0,
      paddingTop: 16,
      borderTop: "1px solid var(--border)",
      maxWidth: 520,
    }}>
      {/* Stat 1: H100 floor */}
      <div>
        <div style={{ ...SANS, fontSize: 8.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 3 }}>
          {cheapestH100High ? "H100 from" : "H100"}
        </div>
        {h100Value ? (
          <div style={{ ...MONO, fontSize: 14.5, fontWeight: 600, color: h100Color, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
            {h100Value}<span style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 300 }}>/hr</span>
            <span style={{ ...SANS, fontSize: 9.5, color: "var(--text-muted)", fontWeight: 400, marginLeft: 6 }}>{h100Sub}</span>
          </div>
        ) : (
          <div style={{ ...SANS, fontSize: 11, color: "var(--text-muted)" }}>Not in snapshot</div>
        )}
      </div>

      {/* Stat 2: Hyperscaler premium */}
      <div>
        <div style={{ ...SANS, fontSize: 8.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 3 }}>
          Hyperscaler premium
        </div>
        {effectivePremium !== null && effectivePremium > 0 ? (
          <div style={{ ...MONO, fontSize: 14.5, fontWeight: 600, color: "var(--amber)", letterSpacing: "-0.02em", lineHeight: 1.15 }}>
            +{Math.round(effectivePremium)}%
            <span style={{ ...SANS, fontSize: 9.5, color: "var(--text-muted)", fontWeight: 400, marginLeft: 6 }}>vs. specialist</span>
          </div>
        ) : (
          <div style={{ ...SANS, fontSize: 11, color: "var(--text-muted)" }}>None right now</div>
        )}
      </div>

      {/* Stat 3: Provider count */}
      <div>
        <div style={{ ...SANS, fontSize: 8.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 3 }}>
          Providers tracked
        </div>
        <div style={{ ...MONO, fontSize: 14.5, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1.15 }}>
          {activeProviders}
          <span style={{ ...SANS, fontSize: 9.5, color: "var(--text-muted)", fontWeight: 400, marginLeft: 6 }}>updated daily</span>
        </div>
      </div>
    </div>
  );
}
