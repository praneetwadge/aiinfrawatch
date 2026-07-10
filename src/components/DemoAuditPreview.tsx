// REPO PATH: src/components/DemoAuditPreview.tsx  (REPLACE EXISTING)
// Plain server component — no "use client", no hooks. Derives its numbers from
// computeMarketStats(listings) → computeDemoExample(stats), the SAME shared
// computation already backing the ticker and AuditStatStrip. Renders nothing
// if there's no positive premium to show right now (e.g. an H100 data gap) —
// silent is better than a fabricated number next to a live ticker.
import { computeMarketStats, computeDemoExample } from "@/lib/market-stats";
import { fmtP } from "@/lib/market-helpers";
import type { GpuListing } from "@/lib/market-helpers";

const SANS: React.CSSProperties = { fontFamily: "var(--font-sans)" };
const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)" };

const fmtBigMoney = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `$${Math.round(n / 1000)}k`
  : `$${Math.round(n)}`;

interface DemoAuditPreviewProps {
  listings: GpuListing[];
}

export default function DemoAuditPreview({ listings }: DemoAuditPreviewProps) {
  const stats = computeMarketStats(listings);
  const demo = computeDemoExample(stats);
  if (!demo) return null; // no positive live premium right now — say nothing rather than fake it

  return (
    <section id="audit-demo-preview" style={{ maxWidth: 1360, margin: "0 auto", padding: "32px 32px 8px" }}>
      <div style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid var(--border)" }}>
          <div style={{
            ...SANS, fontSize: 10, fontWeight: 650, color: "var(--amber)",
            textTransform: "uppercase" as const, letterSpacing: "0.08em",
            border: "1px solid var(--border-mid)", padding: "3px 8px", borderRadius: 3,
            display: "inline-block", marginBottom: 12,
          }}>
            Demo · Live Market Prices
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", flexWrap: "wrap" as const, gap: 4 }}>
            <span style={{ ...SANS, fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", width: "100%", marginBottom: 4 }}>
              Example: {demo.gpuCount}× H100 at hyperscaler pricing
            </span>
            <span style={{ ...MONO, fontSize: 40, fontWeight: 700, color: "var(--red)", letterSpacing: "-0.03em", lineHeight: 1 }}>
              {fmtBigMoney(demo.annualSavings)}<span style={{ fontSize: 18, color: "var(--text-muted)", fontWeight: 400 }}>/yr</span>
            </span>
            <span style={{ ...SANS, fontSize: 14, color: "var(--text-secondary)", marginLeft: 12, lineHeight: 1.5 }}>
              at today's average hyperscaler rate of <span style={{ ...MONO, color: "var(--red)", fontWeight: 600 }}>{fmtP(demo.hyperscalerRatePerHour)}/hr</span> vs. the {demo.floorProviderShort} floor of <span style={{ ...MONO, color: "var(--green)", fontWeight: 600 }}>{fmtP(demo.floorRatePerHour)}/hr</span>, {demo.gpuCount}× GPUs, {demo.hoursPerMonth} hrs/mo.
            </span>
          </div>
        </div>

        <div style={{ padding: "16px 22px 18px" }}>
          {[
            { name: "Hyperscaler avg", value: demo.hyperscalerRatePerHour, color: "var(--red)", you: true },
            { name: demo.floorProviderShort, value: demo.floorRatePerHour, color: "var(--green)", floor: true },
          ].map(r => {
            const pct = (r.value / demo.hyperscalerRatePerHour) * 100;
            return (
              <div key={r.name} style={{ display: "grid", gridTemplateColumns: "120px 1fr 70px", gap: 12, alignItems: "center", height: 30 }}>
                <span style={{ ...SANS, fontSize: 12, color: r.you ? "var(--red)" : "var(--text-primary)", fontWeight: 600 }}>
                  {r.you ? "Your rate (example)" : r.name}
                  {r.floor && <span style={{ ...MONO, fontSize: 8.5, color: "var(--green)", marginLeft: 6 }}>floor</span>}
                </span>
                <div style={{ position: "relative" as const, height: 6, background: "var(--elevated)", borderRadius: 1 }}>
                  <div style={{ position: "absolute" as const, left: 0, width: `${Math.max(pct, 2)}%`, height: "100%", background: r.color, opacity: 0.85, borderRadius: 1 }} />
                </div>
                <span style={{ ...MONO, fontSize: 12, textAlign: "right" as const, fontWeight: 600, color: r.color }}>
                  {fmtP(r.value)}/hr
                </span>
              </div>
            );
          })}
          <div style={{ ...SANS, fontSize: 12, color: "var(--text-muted)", marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            This example uses today's live market prices, not your bill. Upload your bill above ↑ for your real number.
          </div>
        </div>
      </div>
    </section>
  );
}
