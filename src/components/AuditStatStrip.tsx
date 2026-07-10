// REPO PATH: src/components/AuditStatStrip.tsx  (NEW FILE)
// @ts-nocheck
import { computeMarketStats } from "@/lib/market-stats";
import { getMeta, fmtP } from "@/lib/market-helpers";
import type { GpuListing } from "@/lib/market-helpers";

const SANS: React.CSSProperties = { fontFamily: "var(--font-sans)" };
const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)" };

interface AuditStatStripProps {
  listings: GpuListing[];
}

// Compact 3-stat strip: H100 floor, hyperscaler premium %, provider count.
// Same source of truth as MarketHero on /market-data (computeMarketStats) —
// intentional single-computation, two-presentation exception to the
// single-metric-appearance rule. Fills the gap between the audit pitch and
// the audit tool with live proof instead of empty space.
export default function AuditStatStrip({ listings }: AuditStatStripProps) {
  const { activeProviders, cheapestH100High, h100Prices, premiumPct, a100PremiumPct } =
    computeMarketStats(listings);

  const effectivePremium = (premiumPct !== null && premiumPct > 0) ? premiumPct
    : (a100PremiumPct !== null && a100PremiumPct > 0) ? a100PremiumPct
    : null;
  const premiumIsH100 = premiumPct !== null && premiumPct > 0;

  const h100Value = cheapestH100High
    ? fmtP(cheapestH100High.price_per_hour)
    : h100Prices.length ? fmtP(h100Prices[0])
    : null;
  const h100Sub = cheapestH100High
    ? `${getMeta(cheapestH100High.provider).short} · high avail.`
    : h100Prices.length ? "Observed only"
    : "Not in snapshot";
  const h100Color = cheapestH100High ? "var(--green)" : "var(--amber)";

  return (
    <section style={{ maxWidth: 1360, margin: "0 auto", padding: "32px 32px 40px" }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 1,
        border: "1px solid var(--border)",
        background: "var(--border)",
      }}>
        {/* Stat 1: H100 floor */}
        <div style={{ background: "var(--panel)", padding: "16px 22px" }}>
          <div style={{ ...SANS, fontSize: 9.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 4 }}>
            {cheapestH100High ? "H100 from" : h100Prices.length ? "H100 observed (not reliable)" : "H100"}
          </div>
          {h100Value ? (
            <div style={{ ...MONO, fontSize: 19, fontWeight: 500, color: h100Color, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
              {h100Value}<span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 300 }}>/hr</span>
              <span style={{ ...SANS, fontSize: 10.5, color: "var(--text-muted)", fontWeight: 400, marginLeft: 8 }}>{h100Sub}</span>
            </div>
          ) : (
            <div style={{ ...SANS, fontSize: 12, color: "var(--text-muted)" }}>Not in current snapshot</div>
          )}
        </div>

        {/* Stat 2: Hyperscaler premium */}
        <div style={{ background: "var(--panel)", padding: "16px 22px" }}>
          <div style={{ ...SANS, fontSize: 9.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 4 }}>
            {effectivePremium !== null && effectivePremium > 0
              ? `Hyperscaler premium (${premiumIsH100 ? "H100" : "A100"})`
              : "Hyperscaler premium"}
          </div>
          {effectivePremium !== null && effectivePremium > 0 ? (
            <div style={{ ...MONO, fontSize: 19, fontWeight: 500, color: "var(--amber)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
              +{Math.round(effectivePremium)}%
              <span style={{ ...SANS, fontSize: 10.5, color: "var(--text-muted)", fontWeight: 400, marginLeft: 8 }}>vs. specialist clouds</span>
            </div>
          ) : (
            <div style={{ ...SANS, fontSize: 12, color: "var(--text-muted)" }}>No material premium right now</div>
          )}
        </div>

        {/* Stat 3: Provider count */}
        <div style={{ background: "var(--panel)", padding: "16px 22px" }}>
          <div style={{ ...SANS, fontSize: 9.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 4 }}>
            Providers tracked
          </div>
          <div style={{ ...MONO, fontSize: 19, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            {activeProviders}
            <span style={{ ...SANS, fontSize: 10.5, color: "var(--text-muted)", fontWeight: 400, marginLeft: 8 }}>updated daily</span>
          </div>
        </div>
      </div>
    </section>
  );
}
