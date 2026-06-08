import { getLatestGpuListings } from "@/lib/db/queries";
import SiteNav from "@/components/SiteNav";
import AuditTool from "@/components/AuditTool";
import type { GpuListing } from "@/lib/market-helpers";

export const revalidate = 300;

const SANS:  React.CSSProperties = { fontFamily: "var(--font-sans)" } as const;
const SERIF: React.CSSProperties = { fontFamily: "var(--font-serif)" } as const;
const MONO:  React.CSSProperties = { fontFamily: "var(--font-mono)" } as const;

import React from "react";

export default async function CostAuditPage() {
  let listings: GpuListing[] = [];
  try {
    listings = await getLatestGpuListings({ limit: 2000 }) as GpuListing[];
  } catch {
    // Render tool with empty listings — it handles the empty state gracefully
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <SiteNav />

      {/* Hero */}
      <div style={{ background: "var(--panel)", borderBottom: "2px solid var(--border)" }}>
        <div style={{ maxWidth: 880, margin: "0 auto", padding: "52px 32px 40px" }}>
          <div style={{ ...MONO, fontSize: 10, color: "var(--blue)", letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 16 }}>
            Cost Audit
          </div>
          <h1 style={{ ...SERIF, fontSize: 42, fontWeight: 400, lineHeight: 1.1, color: "var(--text-primary)", marginBottom: 14 }}>
            Are you overpaying for AI compute?
          </h1>
          <p style={{ ...SANS, fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: 540 }}>
            Pick your setup. Get the cheapest reliable deployment and your savings — instantly, from live market data.
          </p>
        </div>
      </div>

      {/* Tool */}
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "36px 32px 80px" }}>
        <AuditTool listings={listings} />

        {/* Honesty note */}
        <div style={{ marginTop: 32, padding: "16px 20px", background: "var(--elevated)", border: "1px solid var(--border)", borderLeft: "2px solid var(--blue)" }}>
          <div style={{ ...MONO, fontSize: 10, color: "var(--blue)", letterSpacing: "0.08em", marginBottom: 5 }}>HOW THIS WORKS</div>
          <p style={{ ...SANS, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            The instant audit is computed live from indexed public prices across {listings.length > 0 ? `${new Set(listings.map(l => l.provider)).size} providers` : "our provider index"}. The emailed breakdown is analyst-reviewed — provider-by-provider options, regional pricing, and contract notes.
          </p>
        </div>
      </div>
    </div>
  );
}
