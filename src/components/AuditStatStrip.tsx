// @ts-nocheck
"use client";

import { computeMarketStats } from "@/lib/market-stats";
import { getMeta, fmtP } from "@/lib/market-helpers";
import type { GpuListing } from "@/lib/market-helpers";

const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)" };
const SANS: React.CSSProperties = { fontFamily: "var(--font-sans)" };

interface Props {
  listings: GpuListing[];
}

export default function AuditStatStrip({ listings }: Props) {
  const { activeProviders, cheapestH100High, h100Prices, premiumPct, a100PremiumPct } = computeMarketStats(listings);

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
    : null;
  const h100Color = cheapestH100High ? "var(--green)" : "var(--amber)";

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "0 32px" }}>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1,
        border: "1px solid var(--border)", background: "var(--border)",
        marginBottom: 8,
      }}>
        {/* Stat 1: H100 floor */}
        <div style={{ background: "var(--panel)", padding: "10px 16px" }}>
          <div style={{ ...SANS, fontSize: 9.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 4 }}>
            {cheapestH100High ? "H100 floor" : h100Prices.length ? "H100 (observed)" : "H100"}
          </div>
          {h100Value ? (
            <div style={{ ...MONO, fontSize: 17, fontWeight: 500, color: h100Color, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              {h100Value}<span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 300 }}>/hr</span>
              {h100Sub && <span style={{ ...SANS, fontSize: 10.5, color: "var(--text-muted)", fontWeight: 400, marginLeft: 6 }}>{h100Sub}</span>}
            </div>
          ) : (
            <div style={{ ...SANS, fontSize: 11, color: "var(--text-muted)" }}>Not in snapshot</div>
          )}
        </div>

        {/* Stat 2: Hyperscaler premium */}
        <div style={{ background: "var(--panel)", padding: "10px 16px" }}>
          <div style={{ ...SANS, fontSize: 9.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 4 }}>
            Hyperscaler premium
          </div>
          {effectivePremium !== null && effectivePremium > 0 ? (
            <div style={{ ...MONO, fontSize: 17, fontWeight: 500, color: "var(--amber)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              +{Math.round(effectivePremium)}%
              <span style={{ ...SANS, fontSize: 10.5, color: "var(--text-muted)", fontWeight: 400, marginLeft: 6 }}>vs {premiumIsH100 ? "H100" : "A100"} specialists</span>
            </div>
          ) : (
            <div style={{ ...SANS, fontSize: 11, color: "var(--text-muted)" }}>No material premium</div>
          )}
        </div>

        {/* Stat 3: Provider count */}
        <div style={{ background: "var(--panel)", padding: "10px 16px" }}>
          <div style={{ ...SANS, fontSize: 9.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 4 }}>
            Providers tracked
          </div>
          <div style={{ ...MONO, fontSize: 17, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            {activeProviders}
          </div>
        </div>
      </div>
    </div>
  );
}
