import React from "react";
import { getLatestGpuListings } from "@/lib/db/queries";
import SiteNav from "@/components/SiteNav";
import MarketTicker from "@/components/MarketTicker";
import AuditTool from "@/components/AuditTool";
import type { GpuListing } from "@/lib/market-helpers";

export const revalidate = 300;

const SANS: React.CSSProperties = { fontFamily: "var(--font-sans)" };
const SERIF: React.CSSProperties = { fontFamily: "var(--font-serif)" };
const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)" };

const OUTCOMES = [
  "Estimated current monthly spend",
  "Cheapest reliable alternative",
  "Savings range and migration risk",
  "Provider options by workload type",
];

export default async function CostAuditPage() {
  let listings: GpuListing[] = [];
  try {
    listings = await getLatestGpuListings({ limit: 2000 }) as GpuListing[];
  } catch {
    // Render intake with empty listings — AuditTool handles the empty state gracefully.
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <SiteNav />
      <MarketTicker listings={listings} />

      <div style={{ background: "var(--panel)", borderBottom: "2px solid var(--border)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "54px 32px 44px" }}>
          <div style={{ ...MONO, fontSize: 10, color: "var(--blue)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 16 }}>
            Cost Audit
          </div>
          <h1 style={{ ...SERIF, fontSize: 44, fontWeight: 400, lineHeight: 1.08, color: "var(--text-primary)", marginBottom: 16 }}>
            Find out if your AI infrastructure is overpriced.
          </h1>
          <p style={{ ...SANS, fontSize: 15.5, color: "var(--text-secondary)", lineHeight: 1.72, maxWidth: 620 }}>
            Paste your current setup, bill summary, or architecture notes. Public prices show the market; the audit turns that market into your workload decision.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "36px 32px 84px" }}>
        <div className="audit-value-grid" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start", marginBottom: 28 }}>
          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: "22px 24px", boxShadow: "var(--shadow-sm)" }}>
            <div style={{ ...MONO, fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
              What you get back
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }} className="audit-outcome-grid">
              {OUTCOMES.map(item => (
                <div key={item} style={{ ...SANS, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55, padding: "10px 12px", background: "var(--elevated)", border: "1px solid var(--border)" }}>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "#171717", color: "#F7F3EA", border: "1px solid rgba(247,243,234,0.08)", padding: "20px 22px", boxShadow: "var(--shadow-sm)" }}>
            <div style={{ ...MONO, fontSize: 9.5, color: "rgba(247,243,234,0.44)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>
              Example audit result
            </div>
            <div style={{ ...SANS, fontSize: 12.5, color: "rgba(247,243,234,0.58)", marginBottom: 12 }}>
              8×H100 mixed batch/eval workload
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <div style={{ ...MONO, fontSize: 10, color: "rgba(247,243,234,0.4)", marginBottom: 3 }}>CURRENT EST.</div>
                <div style={{ ...MONO, fontSize: 22, color: "#F7F3EA" }}>$214k<span style={{ fontSize: 11, color: "rgba(247,243,234,0.4)" }}>/mo</span></div>
              </div>
              <div>
                <div style={{ ...MONO, fontSize: 10, color: "rgba(247,243,234,0.4)", marginBottom: 3 }}>OPTIMIZED RELIABLE</div>
                <div style={{ ...MONO, fontSize: 22, color: "var(--green)" }}>$128k<span style={{ fontSize: 11, color: "rgba(247,243,234,0.4)" }}>/mo</span></div>
              </div>
              <div style={{ ...SANS, fontSize: 12, color: "rgba(247,243,234,0.62)", lineHeight: 1.55, borderTop: "1px solid rgba(247,243,234,0.1)", paddingTop: 10 }}>
                Save ~40% by moving async batch/eval jobs while keeping latency-critical serving on the current stack.
              </div>
            </div>
          </div>
        </div>

        <AuditTool listings={listings} />

        <div style={{ marginTop: 32, padding: "16px 20px", background: "var(--elevated)", border: "1px solid var(--border)", borderLeft: "2px solid var(--blue)" }}>
          <div style={{ ...MONO, fontSize: 10, color: "var(--blue)", letterSpacing: "0.08em", marginBottom: 5 }}>HOW THIS WORKS</div>
          <p style={{ ...SANS, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            The instant preview uses indexed public prices across {listings.length > 0 ? `${new Set(listings.map(l => l.provider)).size} providers` : "our provider index"}. The useful audit is workload-specific: provider-by-provider options, regional pricing, workload split, migration risk, and contract notes.
          </p>
        </div>
      </div>

      <style>{`
        @media (max-width: 800px) {
          .audit-value-grid { grid-template-columns: 1fr !important; }
          .audit-outcome-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
