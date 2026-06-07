"use client";

import { useState, useMemo } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GpuListing {
  provider: string;
  gpu_model: string;
  gpu_count: number;
  pricing_type: string;
  price_per_hour: number;
  region: string;
  availability: string;
  fetched_at?: string;
}
interface EnergyPrice { region: string; price_per_kwh: number; }
interface LatencyBenchmark { provider: string; region: string; latency_p50_ms: number; }
interface MarketSummary {
  h100_spot_avg: number; a100_spot_avg: number;
  active_providers: number; total_listings: number;
  energy_cheapest_price: number; last_updated: string;
  cheapest_h100?: GpuListing | null; cheapest_a100?: GpuListing | null;
}
interface Props { summary: MarketSummary | null; listings: GpuListing[]; energy: EnergyPrice[]; latency: LatencyBenchmark[]; }

// ── Design tokens (inline) ────────────────────────────────────────────────────

const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)" };
const SERIF: React.CSSProperties = { fontFamily: "var(--font-serif)" };
const BODY: React.CSSProperties = { fontFamily: "var(--font-body)" };

// ── Provider metadata ─────────────────────────────────────────────────────────

const PROVIDER_META: Record<string, { cat: string; color: string; status: string; short: string }> = {
  runpod:         { cat: "Marketplace",  color: "var(--violet)", status: "live",    short: "RunPod" },
  vastai:         { cat: "Marketplace",  color: "var(--violet)", status: "partial", short: "Vast.ai" },
  "vast.ai":      { cat: "Marketplace",  color: "var(--violet)", status: "partial", short: "Vast.ai" },
  aws:            { cat: "Hyperscaler",  color: "var(--amber)",  status: "live",    short: "AWS" },
  azure:          { cat: "Hyperscaler",  color: "var(--amber)",  status: "live",    short: "Azure" },
  gcp:            { cat: "Hyperscaler",  color: "var(--amber)",  status: "live",    short: "GCP" },
  "google cloud": { cat: "Hyperscaler",  color: "var(--amber)",  status: "live",    short: "GCP" },
  coreweave:      { cat: "Neocloud",     color: "var(--blue)",   status: "live",    short: "CoreWeave" },
  lambda:         { cat: "Neocloud",     color: "var(--blue)",   status: "live",    short: "Lambda" },
  "lambda labs":  { cat: "Neocloud",     color: "var(--blue)",   status: "live",    short: "Lambda" },
  nebius:         { cat: "Neocloud",     color: "var(--blue)",   status: "live",    short: "Nebius" },
  tensordock:     { cat: "Marketplace",  color: "var(--violet)", status: "live",    short: "TensorDock" },
  oci:            { cat: "Hyperscaler",  color: "var(--amber)",  status: "live",    short: "Oracle" },
  "oracle cloud": { cat: "Hyperscaler",  color: "var(--amber)",  status: "live",    short: "Oracle" },
  paperspace:     { cat: "Neocloud",     color: "var(--blue)",   status: "live",    short: "Paperspace" },
  crusoe:         { cat: "Neocloud",     color: "var(--blue)",   status: "live",    short: "Crusoe" },
  "crusoe energy":{ cat: "Neocloud",     color: "var(--blue)",   status: "live",    short: "Crusoe" },
  fluidstack:     { cat: "Marketplace",  color: "var(--violet)", status: "live",    short: "FluidStack" },
  ibm:            { cat: "Hyperscaler",  color: "var(--amber)",  status: "live",    short: "IBM" },
  "ibm cloud":    { cat: "Hyperscaler",  color: "var(--amber)",  status: "live",    short: "IBM" },
  gmi:            { cat: "Neocloud",     color: "var(--blue)",   status: "live",    short: "GMI" },
  "gmi cloud":    { cat: "Neocloud",     color: "var(--blue)",   status: "live",    short: "GMI" },
  voltagepark:    { cat: "Neocloud",     color: "var(--blue)",   status: "live",    short: "VoltagePark" },
  "voltage park": { cat: "Neocloud",     color: "var(--blue)",   status: "live",    short: "VoltagePark" },
};

const ALL_PROVIDERS = [
  { slug: "runpod",      name: "RunPod",        cat: "Marketplace", status: "live" },
  { slug: "aws",         name: "AWS",           cat: "Hyperscaler", status: "live" },
  { slug: "azure",       name: "Azure",         cat: "Hyperscaler", status: "live" },
  { slug: "gcp",         name: "GCP",           cat: "Hyperscaler", status: "live" },
  { slug: "coreweave",   name: "CoreWeave",     cat: "Neocloud",    status: "live" },
  { slug: "lambda",      name: "Lambda Labs",   cat: "Neocloud",    status: "live" },
  { slug: "nebius",      name: "Nebius",        cat: "Neocloud",    status: "live" },
  { slug: "tensordock",  name: "TensorDock",    cat: "Marketplace", status: "live" },
  { slug: "oci",         name: "Oracle Cloud",  cat: "Hyperscaler", status: "live" },
  { slug: "paperspace",  name: "Paperspace",    cat: "Neocloud",    status: "live" },
  { slug: "crusoe",      name: "Crusoe",        cat: "Neocloud",    status: "live" },
  { slug: "fluidstack",  name: "FluidStack",    cat: "Marketplace", status: "live" },
  { slug: "ibm",         name: "IBM Cloud",     cat: "Hyperscaler", status: "live" },
  { slug: "gmi",         name: "GMI Cloud",     cat: "Neocloud",    status: "live" },
  { slug: "voltagepark", name: "VoltagePark",   cat: "Neocloud",    status: "live" },
  { slug: "vastai",      name: "Vast.ai",       cat: "Marketplace", status: "partial" },
];

const GPU_FAMILIES = ["All", "H100", "A100", "L40S", "A10G", "B200"];
const HYPERSCALERS = ["aws", "azure", "gcp", "oci", "ibm", "ibm cloud", "google cloud", "oracle cloud"];

// ── Helpers ───────────────────────────────────────────────────────────────────

const getMeta = (p: string) =>
  PROVIDER_META[p.toLowerCase()] ?? { cat: "Unknown", color: "var(--text-muted)", status: "unknown", short: p };

const fmt = (n: number, d = 2) => n.toFixed(d);
const fmtK = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

const minsAgo = (iso?: string): string => {
  if (!iso) return "—";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
};

const availColor = (a: string) =>
  a === "high" ? "var(--green)" : a === "medium" ? "var(--amber)" : "var(--red)";

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ values, color = "var(--blue)", width = 56, height = 22 }: {
  values: number[]; color?: string; width?: number; height?: number;
}) {
  if (values.length < 2) return <span style={{ display: "inline-block", width, height }} />;
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * width},${height - ((v - min) / range) * (height - 3) - 1}`)
    .join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
    </svg>
  );
}

// ── Rule (thin Tufte-style divider) ──────────────────────────────────────────

const Rule = ({ my = 0 }: { my?: number }) => (
  <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: `${my}px 0` }} />
);

// ── Market Ribbon ─────────────────────────────────────────────────────────────

function MarketRibbon({ listings, summary }: { listings: GpuListing[]; summary: MarketSummary | null }) {
  const items = useMemo(() => {
    const h100s = listings.filter(l => l.gpu_model.includes("H100") && l.pricing_type === "spot");
    const a100s = listings.filter(l => l.gpu_model.includes("A100") && l.pricing_type === "spot");
    const counts: Record<string, number> = {};
    listings.forEach(l => { counts[l.provider] = (counts[l.provider] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

    const base = [
      "AI Compute Market  ·  Live",
      `${listings.length} listings indexed`,
      `${summary?.active_providers ?? "—"} providers tracked`,
      ...(h100s.length ? [`H100 from $${fmt(Math.min(...h100s.map(l => l.price_per_hour)))}/hr`] : []),
      ...(a100s.length ? [`A100 from $${fmt(Math.min(...a100s.map(l => l.price_per_hour)))}/hr`] : []),
      ...(top ? [`${top[0]}: ${top[1]} listings`] : []),
      ...(summary?.last_updated ? [`Updated ${minsAgo(summary.last_updated)}`] : []),
    ];
    return [...base, ...base];
  }, [listings, summary]);

  return (
    <div style={{
      height: 30,
      background: "#171717",
      borderBottom: "1px solid rgba(20,20,20,0.15)",
      overflow: "hidden",
      display: "flex",
      alignItems: "center",
    }}>
      <div style={{ display: "flex", whiteSpace: "nowrap", animation: "ribbon-scroll 70s linear infinite" }}>
        {items.map((item, i) => (
          <span key={i} style={{
            ...MONO,
            fontSize: 10.5,
            color: "rgba(247,243,234,0.55)",
            padding: "0 28px",
            borderRight: "1px solid rgba(247,243,234,0.1)",
            letterSpacing: "0.03em",
          }}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function Header({ listings, summary }: { listings: GpuListing[]; summary: MarketSummary | null }) {
  const live = ALL_PROVIDERS.filter(p => p.status === "live").length;
  const partial = ALL_PROVIDERS.filter(p => p.status === "partial").length;

  return (
    <header style={{
      borderBottom: "1px solid var(--border)",
      background: "var(--panel)",
      boxShadow: "0 1px 0 rgba(20,20,20,0.06)",
    }}>
      <div style={{
        maxWidth: 1360, margin: "0 auto", padding: "0 32px",
        height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24,
      }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width={22} height={22} viewBox="0 0 22 22" fill="none">
              <rect width={22} height={22} rx={3} fill="#171717" />
              <path d="M5 16l4-9 3.5 6 2-3.5L17 16" stroke="#F7F3EA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
            <span style={{ ...BODY, fontSize: 15, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              AIInfraWatch
            </span>
          </div>
          <div style={{ width: 1, height: 18, background: "var(--border)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%", background: "var(--green)",
              display: "inline-block", animation: "pulse-live 2.5s ease-in-out infinite",
            }} />
            <span style={{ ...BODY, fontSize: 12, color: "var(--text-muted)" }}>Live data</span>
          </div>
        </div>

        {/* Right stats */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{
              ...MONO, fontSize: 10, color: "var(--green)",
              background: "var(--green-dim)", border: "1px solid rgba(8,127,91,0.2)",
              padding: "2px 8px", borderRadius: 3, letterSpacing: "0.05em",
            }}>{live} live</span>
            {partial > 0 && (
              <span style={{
                ...MONO, fontSize: 10, color: "var(--amber)",
                background: "var(--amber-dim)", border: "1px solid rgba(183,121,31,0.2)",
                padding: "2px 8px", borderRadius: 3, letterSpacing: "0.05em",
              }}>{partial} partial</span>
            )}
          </div>
          <div style={{ width: 1, height: 18, background: "var(--border)" }} />
          <div style={{ display: "flex", gap: 24 }}>
            {[
              { val: fmtK(listings.length), label: "listings" },
              { val: String(summary?.active_providers ?? live), label: "providers" },
            ].map(({ val, label }) => (
              <div key={label} style={{ textAlign: "right" as const }}>
                <div style={{ ...MONO, fontSize: 15, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.2 }}>{val}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase" as const }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

// ── Hero / Market Brief ───────────────────────────────────────────────────────

function MarketBrief({ listings, summary }: { listings: GpuListing[]; summary: MarketSummary | null }) {
  const h100All = listings.filter(l => l.gpu_model.includes("H100"));
  const h100Spot = h100All.filter(l => l.pricing_type === "spot");
  const h100Hyper = h100All.filter(l => HYPERSCALERS.includes(l.provider.toLowerCase()));
  const h100Spec = h100All.filter(l => !HYPERSCALERS.includes(l.provider.toLowerCase()));

  const hyperAvg = h100Hyper.length ? h100Hyper.reduce((s, l) => s + l.price_per_hour, 0) / h100Hyper.length : 0;
  const specAvg = h100Spec.length ? h100Spec.reduce((s, l) => s + l.price_per_hour, 0) / h100Spec.length : 0;
  const premium = specAvg > 0 && hyperAvg > 0 ? ((hyperAvg / specAvg - 1) * 100) : null;

  const cheapestH100 = [...h100Spot].sort((a, b) => a.price_per_hour - b.price_per_hour)[0];
  const liveCount = ALL_PROVIDERS.filter(p => p.status === "live").length;
  const partialCount = ALL_PROVIDERS.filter(p => p.status === "partial").length;

  const briefItems = [
    cheapestH100 && {
      label: "Cheapest H100", value: `$${fmt(cheapestH100.price_per_hour)}/hr`,
      note: `${getMeta(cheapestH100.provider).short} · spot`, color: "var(--green)",
    },
    premium !== null && premium > 0 && {
      label: "Hyperscaler premium", value: `+${premium.toFixed(0)}%`,
      note: "vs. specialist clouds", color: "var(--amber)",
    },
    {
      label: "Provider coverage", value: `${liveCount} live`,
      note: `${partialCount} partial`, color: "var(--blue)",
    },
    {
      label: "Data freshness", value: minsAgo(summary?.last_updated),
      note: "last scrape cycle", color: "var(--text-secondary)",
    },
  ].filter(Boolean) as { label: string; value: string; note: string; color: string }[];

  return (
    <div style={{ background: "var(--panel)", borderBottom: "2px solid var(--border)" }}>
      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "52px 32px 44px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 64, alignItems: "start" }}>

          {/* Left: editorial headline */}
          <div>
            <p style={{ ...MONO, fontSize: 10.5, color: "var(--text-muted)", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: 16 }}>
              AI Infrastructure · Market Intelligence
            </p>
            <h1 style={{
              ...SERIF,
              fontSize: 42, fontWeight: 400, lineHeight: 1.12,
              color: "var(--text-primary)", marginBottom: 20,
            }}>
              The AI compute market,<br />
              <em style={{ fontStyle: "italic" }}>priced in real time.</em>
            </h1>
            <p style={{ ...BODY, fontSize: 16, color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: 560, fontWeight: 300 }}>
              Track GPU spot prices, provider spreads, region availability, and infrastructure cost volatility across hyperscalers, neoclouds, and GPU marketplaces — before you commit to a deployment.
            </p>
          </div>

          {/* Right: today's brief */}
          <div style={{
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderTop: "3px solid var(--text-primary)",
          }}>
            <div style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ ...BODY, fontSize: 12, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "0.02em" }}>
                Today's Market Brief
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", display: "inline-block", animation: "pulse-live 2.5s ease-in-out infinite" }} />
                <span style={{ ...MONO, fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em" }}>LIVE</span>
              </span>
            </div>
            <div style={{ padding: "4px 0" }}>
              {briefItems.map((b, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "11px 16px",
                  borderBottom: i < briefItems.length - 1 ? "1px solid var(--border)" : "none",
                }}>
                  <span style={{ ...BODY, fontSize: 12, color: "var(--text-muted)" }}>{b.label}</span>
                  <div style={{ textAlign: "right" as const }}>
                    <div style={{ ...MONO, fontSize: 13, fontWeight: 500, color: b.color }}>{b.value}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{b.note}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Market Index Tiles ────────────────────────────────────────────────────────

function IndexTile({ label, value, note, color, spark, footnote }: {
  label: string; value: string; note?: string;
  color: string; spark?: number[]; footnote?: string;
}) {
  return (
    <div style={{
      background: "var(--panel)",
      border: "1px solid var(--border)",
      boxShadow: "var(--shadow-sm)",
      padding: "20px 22px",
      display: "flex", flexDirection: "column" as const, gap: 6,
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ ...BODY, fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", fontWeight: 600 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div style={{ ...MONO, fontSize: 28, fontWeight: 500, color, lineHeight: 1.05, letterSpacing: "-0.025em" }}>{value}</div>
          {note && <div style={{ ...BODY, fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{note}</div>}
        </div>
        {spark && spark.length >= 2 && (
          <Sparkline values={spark} color={color} width={60} height={26} />
        )}
      </div>
      {footnote && (
        <>
          <Rule my={6} />
          <div style={{ ...BODY, fontSize: 11, color: "var(--text-muted)", lineHeight: 1.55, fontStyle: "italic" as const }}>{footnote}</div>
        </>
      )}
    </div>
  );
}

// ── H100 Spread Chart ─────────────────────────────────────────────────────────

function H100SpreadChart({ listings }: { listings: GpuListing[] }) {
  const data = useMemo(() => {
    const h100 = listings.filter(l => l.gpu_model.includes("H100"));
    const byProvider: Record<string, { prices: number[]; cat: string }> = {};
    h100.forEach(l => {
      const meta = getMeta(l.provider);
      const key = meta.short;
      if (!byProvider[key]) byProvider[key] = { prices: [], cat: meta.cat };
      byProvider[key].prices.push(l.price_per_hour);
    });
    return Object.entries(byProvider)
      .map(([name, { prices, cat }]) => ({
        name, cat,
        min: Math.min(...prices),
        max: Math.max(...prices),
        avg: prices.reduce((s, p) => s + p, 0) / prices.length,
      }))
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 12);
  }, [listings]);

  if (!data.length) return null;

  const absMax = Math.max(...data.map(d => d.max));
  const hyperRows = data.filter(d => d.cat === "Hyperscaler");
  const specRows = data.filter(d => d.cat !== "Hyperscaler");
  const hyperAvg = hyperRows.length ? hyperRows.reduce((s, d) => s + d.avg, 0) / hyperRows.length : 0;
  const specAvg = specRows.length ? specRows.reduce((s, d) => s + d.avg, 0) / specRows.length : 0;
  const premiumX = specAvg > 0 && hyperAvg > 0 ? (hyperAvg / specAvg).toFixed(1) : null;
  const cheapest = data[0].name;

  const catColor = (cat: string) =>
    cat === "Hyperscaler" ? "var(--amber)" : cat === "Neocloud" ? "var(--blue)" : "var(--violet)";

  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", padding: "26px 30px" }}>
      {/* Chart header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <h3 style={{ ...BODY, fontSize: 14, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
            H100 Pricing by Provider
          </h3>
          <p style={{ ...BODY, fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            Spot and on-demand rates, sorted by average price
          </p>
        </div>
        {premiumX && (
          <div style={{
            textAlign: "right" as const,
            background: "var(--amber-dim)",
            border: "1px solid rgba(183,121,31,0.25)",
            padding: "8px 14px",
          }}>
            <div style={{ ...MONO, fontSize: 20, fontWeight: 500, color: "var(--amber)" }}>{premiumX}×</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>hyperscaler multiple</div>
          </div>
        )}
      </div>

      <Rule my={16} />

      {/* Axis labels */}
      <div style={{ display: "grid", gridTemplateColumns: "108px 1fr 80px", gap: 14, marginBottom: 8 }}>
        <div />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ ...MONO, fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.06em" }}>$0</span>
          <span style={{ ...MONO, fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.06em" }}>${fmt(absMax / 2)}</span>
          <span style={{ ...MONO, fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.06em" }}>${fmt(absMax)}</span>
        </div>
        <div />
      </div>

      {/* Bars */}
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
        {data.map(d => {
          const barLeft = (d.min / absMax) * 100;
          const barWidth = Math.max(((d.max - d.min) / absMax) * 100, 1);
          const avgPct = (d.avg / absMax) * 100;
          const cc = catColor(d.cat);
          const isCheapest = d.name === cheapest;
          return (
            <div key={d.name} style={{ display: "grid", gridTemplateColumns: "108px 1fr 80px", gap: 14, alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 2, height: 13, background: cc, flexShrink: 0 }} />
                <span style={{
                  ...BODY, fontSize: 12.5, color: isCheapest ? "var(--text-primary)" : "var(--text-secondary)",
                  fontWeight: isCheapest ? 600 : 400,
                  whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis",
                }}>{d.name}</span>
              </div>
              {/* Bar track */}
              <div style={{ position: "relative" as const, height: 7, background: "var(--elevated)", borderRadius: 1 }}>
                <div style={{
                  position: "absolute" as const,
                  left: `${barLeft}%`, width: `${barWidth}%`, height: "100%",
                  background: cc, opacity: 0.85, borderRadius: 1,
                }} />
                {/* Avg tick */}
                <div style={{
                  position: "absolute" as const,
                  left: `${avgPct}%`, width: 1.5, height: "130%", top: "-15%",
                  background: "rgba(20,20,20,0.35)",
                  transform: "translateX(-0.75px)",
                }} />
              </div>
              <div style={{ textAlign: "right" as const }}>
                <span style={{ ...MONO, fontSize: 12.5, fontWeight: isCheapest ? 600 : 400, color: isCheapest ? "var(--green)" : "var(--text-secondary)" }}>
                  ${fmt(d.min)}
                </span>
                {d.max > d.min && (
                  <span style={{ ...MONO, fontSize: 11, color: "var(--text-muted)" }}>–{fmt(d.max)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Rule my={16} />

      {/* Legend + annotation */}
      <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 16, alignItems: "center" }}>
        {[
          { label: "Hyperscaler", color: "var(--amber)" },
          { label: "Neocloud",    color: "var(--blue)" },
          { label: "Marketplace", color: "var(--violet)" },
          { label: "Avg. price",  color: "rgba(20,20,20,0.35)", isLine: true },
        ].map(l => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {l.isLine
              ? <div style={{ width: 14, height: 1.5, background: l.color }} />
              : <div style={{ width: 8, height: 8, background: l.color, borderRadius: 1 }} />
            }
            <span style={{ ...BODY, fontSize: 11, color: "var(--text-muted)" }}>{l.label}</span>
          </div>
        ))}
        {premiumX && (
          <div style={{ flex: 1, textAlign: "right" as const }}>
            <span style={{ ...BODY, fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" as const }}>
              Hyperscalers are {premiumX}× more expensive than specialist GPU clouds on average.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── GPU Small Multiples ───────────────────────────────────────────────────────

function GpuSmallMultiples({ listings }: { listings: GpuListing[] }) {
  const cards = ["H100", "A100", "L40S", "A10G"].map(family => {
    const ls = listings.filter(l => l.gpu_model.includes(family));
    if (!ls.length) return null;
    const prices = ls.map(l => l.price_per_hour).sort((a, b) => a - b);
    const spotLs = ls.filter(l => l.pricing_type === "spot");
    return {
      family, count: ls.length, spotCount: spotLs.length,
      min: prices[0], max: prices[prices.length - 1],
      avg: prices.reduce((s, p) => s + p, 0) / prices.length,
      spark: prices.slice(0, 9),
    };
  }).filter(Boolean) as { family: string; count: number; spotCount: number; min: number; max: number; avg: number; spark: number[] }[];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
      {cards.map(c => (
        <div key={c.family} style={{ background: "var(--panel)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", padding: "16px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <span style={{ ...MONO, fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{c.family}</span>
            <span style={{ ...BODY, fontSize: 10, color: "var(--text-muted)" }}>{c.count} listings</span>
          </div>
          <div style={{ ...MONO, fontSize: 24, fontWeight: 500, color: "var(--blue)", letterSpacing: "-0.025em", lineHeight: 1 }}>
            ${fmt(c.min)}
          </div>
          <div style={{ ...BODY, fontSize: 11, color: "var(--text-muted)", margin: "4px 0 10px" }}>
            from /hr · avg ${fmt(c.avg)}
          </div>
          <Rule />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 8 }}>
            <div>
              <div style={{ ...BODY, fontSize: 10, color: "var(--text-muted)" }}>{c.spotCount} spot</div>
              <div style={{ ...BODY, fontSize: 10, color: "var(--text-muted)" }}>max ${fmt(c.max)}</div>
            </div>
            <Sparkline values={c.spark} color="var(--blue)" width={50} height={20} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Market Signal Cards ───────────────────────────────────────────────────────

function SignalCard({ headline, body, sub, type }: {
  headline: string; body: string; sub?: string;
  type: "info" | "warn" | "success" | "neutral";
}) {
  const colors = {
    info:    "var(--blue)",
    warn:    "var(--amber)",
    success: "var(--green)",
    neutral: "var(--text-muted)",
  } as const;
  const c = colors[type];

  return (
    <div style={{
      background: "var(--panel)",
      border: "1px solid var(--border)",
      borderTop: `3px solid ${c}`,
      boxShadow: "var(--shadow-sm)",
      padding: "16px 20px",
      flex: "1 1 200px", minWidth: 190,
    }}>
      <div style={{ ...BODY, fontSize: 11, fontWeight: 600, color: c, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 7 }}>{headline}</div>
      <div style={{ ...BODY, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{body}</div>
      {sub && <div style={{ ...BODY, fontSize: 11, color: "var(--text-muted)", marginTop: 5, fontStyle: "italic" as const }}>{sub}</div>}
    </div>
  );
}

// ── Freshness Badge ───────────────────────────────────────────────────────────

function FreshnessBadge({ iso }: { iso?: string }) {
  const ago = minsAgo(iso);
  const mins = iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 60000) : 999;
  const color = mins < 120 ? "var(--green)" : mins < 720 ? "var(--amber)" : "var(--red)";
  return (
    <span style={{
      ...MONO, fontSize: 10, color,
      background: mins < 120 ? "var(--green-dim)" : mins < 720 ? "var(--amber-dim)" : "var(--red-dim)",
      border: `1px solid ${color}30`,
      padding: "2px 7px", borderRadius: 2, whiteSpace: "nowrap" as const,
    }}>
      {ago}
    </span>
  );
}

// ── Provider Explorer Table ───────────────────────────────────────────────────

function ProviderExplorer({ listings }: { listings: GpuListing[] }) {
  const [gpuFamily, setGpuFamily] = useState("All");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [availFilter, setAvailFilter] = useState("all");
  const [sortKey, setSortKey] = useState<"price" | "gpu" | "provider">("price");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [grouped, setGrouped] = useState(true);

  const filtered = useMemo(() => {
    let r = listings;
    if (gpuFamily !== "All") r = r.filter(l => l.gpu_model.toUpperCase().includes(gpuFamily.toUpperCase()));
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(l => l.gpu_model.toLowerCase().includes(q) || l.provider.toLowerCase().includes(q) || l.region.toLowerCase().includes(q));
    }
    if (catFilter !== "all") r = r.filter(l => getMeta(l.provider).cat === catFilter);
    if (typeFilter !== "all") r = r.filter(l => l.pricing_type === typeFilter);
    if (availFilter !== "all") r = r.filter(l => l.availability === availFilter);
    return [...r].sort((a, b) => {
      const [av, bv] = sortKey === "price" ? [a.price_per_hour, b.price_per_hour]
        : sortKey === "provider" ? [a.provider, b.provider] : [a.gpu_model, b.gpu_model];
      return sortDir === "asc" ? (av < bv ? -1 : av > bv ? 1 : 0) : (av > bv ? -1 : av < bv ? 1 : 0);
    });
  }, [listings, gpuFamily, search, catFilter, typeFilter, availFilter, sortKey, sortDir]);

  const groupMap = useMemo(() => {
    const m = new Map<string, GpuListing[]>();
    filtered.forEach(l => { if (!m.has(l.gpu_model)) m.set(l.gpu_model, []); m.get(l.gpu_model)!.push(l); });
    return [...m.entries()].sort((a, b) => Math.min(...a[1].map(l => l.price_per_hour)) - Math.min(...b[1].map(l => l.price_per_hour)));
  }, [filtered]);

  const toggleSort = (k: typeof sortKey) => {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };
  const toggleExpand = (gpu: string) => setExpanded(prev => {
    const n = new Set(prev); n.has(gpu) ? n.delete(gpu) : n.add(gpu); return n;
  });

  const SortIcon = ({ k }: { k: typeof sortKey }) => (
    <span style={{ marginLeft: 3, color: sortKey === k ? "var(--blue)" : "var(--text-muted)", fontSize: 8 }}>
      {sortKey === k ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
    </span>
  );

  // Shared styles
  const inputStyle: React.CSSProperties = {
    ...BODY, background: "var(--panel)", border: "1px solid var(--border-mid)",
    color: "var(--text-primary)", padding: "6px 11px", fontSize: 13, outline: "none",
    borderRadius: 3, boxShadow: "var(--shadow-sm)",
  };
  const thStyle: React.CSSProperties = {
    ...BODY, fontSize: 11, fontWeight: 600, color: "var(--text-muted)",
    textTransform: "uppercase" as const, letterSpacing: "0.07em",
    padding: "10px 14px 10px 0", textAlign: "left" as const,
    borderBottom: "2px solid var(--border-mid)", background: "var(--panel)",
    position: "sticky" as const, top: 0, whiteSpace: "nowrap" as const,
  };

  return (
    <div>
      {/* GPU tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", overflowX: "auto" }}>
        {GPU_FAMILIES.map(f => (
          <button key={f} onClick={() => setGpuFamily(f)} style={{
            ...BODY, fontSize: 13, padding: "10px 18px",
            background: "none", border: "none",
            borderBottom: gpuFamily === f ? "2px solid var(--blue)" : "2px solid transparent",
            color: gpuFamily === f ? "var(--blue)" : "var(--text-muted)",
            cursor: "pointer", whiteSpace: "nowrap" as const, marginBottom: -1,
            fontWeight: gpuFamily === f ? 600 : 400,
          }}>
            {f}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, ...BODY, fontSize: 12, color: "var(--text-muted)", cursor: "pointer", padding: "0 16px" }}>
          <input type="checkbox" checked={grouped} onChange={e => setGrouped(e.target.checked)} style={{ accentColor: "var(--blue)" }} />
          Group by GPU
        </label>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, padding: "12px 0", flexWrap: "wrap" as const, alignItems: "center", borderBottom: "1px solid var(--border)" }}>
        <input
          placeholder="Search GPU, provider, region…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, width: 220 }}
        />
        {[
          { v: catFilter,  set: setCatFilter,  opts: [["all","All categories"],["Hyperscaler","Hyperscaler"],["Neocloud","Neocloud"],["Marketplace","Marketplace"]] },
          { v: typeFilter, set: setTypeFilter, opts: [["all","All types"],["spot","Spot"],["on-demand","On-demand"],["reserved-1yr","Reserved 1yr"]] },
          { v: availFilter,set: setAvailFilter,opts: [["all","All availability"],["high","High"],["medium","Medium"],["low","Low"]] },
        ].map((s, i) => (
          <select key={i} value={s.v} onChange={e => s.set(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
            {s.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ ...MONO, fontSize: 11, color: "var(--text-muted)" }}>{filtered.length} results</span>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", maxHeight: 580, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {grouped && <th style={{ ...thStyle, width: 24, padding: "10px 6px 10px 0" }} />}
              <th className="tsort" onClick={() => toggleSort("gpu")} style={{ ...thStyle, cursor: "pointer" }}>GPU <SortIcon k="gpu" /></th>
              <th className="tsort" onClick={() => toggleSort("provider")} style={{ ...thStyle, cursor: "pointer" }}>Provider <SortIcon k="provider" /></th>
              <th style={thStyle}>Region</th>
              <th style={thStyle}>Type</th>
              <th className="tsort" onClick={() => toggleSort("price")} style={{ ...thStyle, textAlign: "right" as const, cursor: "pointer" }}>$/hr <SortIcon k="price" /></th>
              <th style={thStyle}>Avail.</th>
              <th style={{ ...thStyle, paddingRight: 0 }}>Freshness</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={grouped ? 8 : 7} style={{ ...BODY, padding: "3rem", color: "var(--text-muted)", textAlign: "center", fontSize: 14 }}>
                  No listings match your filters.
                </td>
              </tr>
            ) : grouped ? (
              groupMap.flatMap(([gpu, rows]) => {
                const isOpen = expanded.has(gpu);
                const cheapest = Math.min(...rows.map(r => r.price_per_hour));
                const provSet = new Set(rows.map(r => r.provider));
                return [
                  <tr key={`g-${gpu}`} onClick={() => toggleExpand(gpu)} style={{
                    cursor: "pointer",
                    borderBottom: "1px solid var(--border)",
                    background: isOpen ? "var(--blue-dim)" : "var(--bg)",
                  }}>
                    <td style={{ ...MONO, padding: "13px 6px 13px 0", fontSize: 8, color: "var(--text-muted)" }}>{isOpen ? "▼" : "▶"}</td>
                    <td style={{ ...BODY, padding: "13px 14px 13px 0", fontWeight: 600, color: "var(--text-primary)", fontSize: 13.5 }}>{gpu}</td>
                    <td style={{ ...BODY, padding: "13px 14px 13px 0", fontSize: 12, color: "var(--text-muted)" }}>
                      {[...provSet].slice(0, 3).join(", ")}{provSet.size > 3 ? ` +${provSet.size - 3}` : ""}
                    </td>
                    <td style={{ ...MONO, padding: "13px 14px 13px 0", fontSize: 11, color: "var(--text-muted)" }}>
                      {rows.length} listings · {provSet.size} providers
                    </td>
                    <td />
                    <td style={{ ...MONO, padding: "13px 14px 13px 0", textAlign: "right" as const, fontWeight: 600, color: "var(--green)", fontSize: 15 }}>
                      from ${fmt(cheapest)}
                    </td>
                    <td colSpan={2} />
                  </tr>,
                  ...(isOpen ? rows.map((l, idx) => {
                    const meta = getMeta(l.provider);
                    return (
                      <tr key={`${gpu}-${idx}`} style={{ borderBottom: "1px solid rgba(20,20,20,0.04)", background: "var(--panel)" }}>
                        <td />
                        <td style={{ ...BODY, padding: "9px 14px 9px 18px", fontSize: 12, color: "var(--text-muted)" }}>└ {l.gpu_model}</td>
                        <td style={{ padding: "9px 14px 9px 0" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <div style={{ width: 2, height: 12, background: meta.color, flexShrink: 0 }} />
                            <span style={{ ...BODY, fontSize: 12, color: "var(--text-secondary)" }}>{l.provider}</span>
                          </div>
                        </td>
                        <td style={{ ...MONO, padding: "9px 14px 9px 0", fontSize: 11, color: "var(--text-muted)" }}>{l.region}</td>
                        <td style={{ padding: "9px 14px 9px 0" }}>
                          <span style={{
                            ...BODY, fontSize: 10.5, color: "var(--text-muted)",
                            background: "var(--elevated)", border: "1px solid var(--border)",
                            padding: "2px 7px", borderRadius: 2,
                          }}>{l.pricing_type}</span>
                        </td>
                        <td style={{ ...MONO, padding: "9px 14px 9px 0", textAlign: "right" as const, fontWeight: 600, color: "var(--green)", fontSize: 14 }}>
                          ${fmt(l.price_per_hour)}
                        </td>
                        <td style={{ padding: "9px 14px 9px 0" }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: availColor(l.availability), display: "inline-block" }} />
                        </td>
                        <td style={{ padding: "9px 0" }}><FreshnessBadge iso={l.fetched_at} /></td>
                      </tr>
                    );
                  }) : []),
                ];
              })
            ) : (
              filtered.map((l, i) => {
                const meta = getMeta(l.provider);
                return (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(20,20,20,0.05)" }}>
                    <td style={{ ...BODY, padding: "11px 14px 11px 0", fontWeight: 500, color: "var(--text-primary)", fontSize: 13.5 }}>{l.gpu_model}</td>
                    <td style={{ padding: "11px 14px 11px 0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <div style={{ width: 2, height: 13, background: meta.color, flexShrink: 0 }} />
                        <span style={{ ...BODY, fontSize: 12, color: "var(--text-secondary)" }}>{l.provider}</span>
                      </div>
                    </td>
                    <td style={{ ...MONO, padding: "11px 14px 11px 0", fontSize: 11, color: "var(--text-muted)" }}>{l.region}</td>
                    <td style={{ padding: "11px 14px 11px 0" }}>
                      <span style={{ ...BODY, fontSize: 10.5, color: "var(--text-muted)", background: "var(--elevated)", border: "1px solid var(--border)", padding: "2px 7px", borderRadius: 2 }}>
                        {l.pricing_type}
                      </span>
                    </td>
                    <td style={{ ...MONO, padding: "11px 14px 11px 0", textAlign: "right" as const, fontWeight: 600, color: "var(--green)", fontSize: 14 }}>
                      ${fmt(l.price_per_hour)}
                    </td>
                    <td style={{ padding: "11px 14px 11px 0" }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: availColor(l.availability), display: "inline-block" }} />
                    </td>
                    <td style={{ padding: "11px 0" }}><FreshnessBadge iso={l.fetched_at} /></td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Workload Optimizer ────────────────────────────────────────────────────────

function WorkloadOptimizer({ listings }: { listings: GpuListing[] }) {
  const [gpu, setGpu] = useState("H100");
  const [hours, setHours] = useState(720);

  const recs = useMemo(() => {
    const ls = listings.filter(l => l.gpu_model.includes(gpu));
    if (!ls.length) return [];
    const sorted = [...ls].sort((a, b) => a.price_per_hour - b.price_per_hour);
    const reliable = ls.filter(l => l.availability === "high").sort((a, b) => a.price_per_hour - b.price_per_hour);
    return [
      { label: "Cheapest available", listing: sorted[0], color: "var(--green)" },
      { label: "Highest reliability", listing: reliable[0] ?? sorted[0], color: "var(--blue)" },
    ].filter(r => r.listing);
  }, [listings, gpu]);

  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", borderTop: "3px solid var(--text-primary)" }}>
      {/* Header */}
      <div style={{ padding: "24px 28px 20px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ ...BODY, fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 8 }}>
          Workload Cost Estimator
        </div>
        <h3 style={{ ...SERIF, fontSize: 22, fontWeight: 400, color: "var(--text-primary)", lineHeight: 1.2, marginBottom: 6 }}>
          Find the cheapest reliable deployment for your workload.
        </h3>
        <p style={{ ...BODY, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.65 }}>
          Select a GPU type and runtime. Compare spot and on-demand options across all indexed providers.
        </p>
      </div>

      <div style={{ padding: "20px 28px" }}>
        {/* Controls */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginBottom: 20, alignItems: "center" }}>
          {["H100", "A100", "L40S", "A10G"].map(g => (
            <button key={g} onClick={() => setGpu(g)} style={{
              ...MONO, fontSize: 12, padding: "6px 14px",
              border: `1px solid ${gpu === g ? "var(--blue)" : "var(--border-mid)"}`,
              background: gpu === g ? "var(--blue-dim)" : "var(--panel)",
              color: gpu === g ? "var(--blue)" : "var(--text-secondary)",
              borderRadius: 3, fontWeight: gpu === g ? 500 : 400,
            }}>
              {g}
            </button>
          ))}
          <div style={{ width: 1, height: 18, background: "var(--border)" }} />
          <label style={{ display: "flex", alignItems: "center", gap: 7, ...BODY, fontSize: 12, color: "var(--text-secondary)" }}>
            Hours / month:
            <input
              type="number" value={hours} onChange={e => setHours(Number(e.target.value))} min={1} max={8760}
              style={{
                ...MONO, width: 72, background: "var(--panel)", border: "1px solid var(--border-mid)",
                color: "var(--text-primary)", padding: "5px 9px", fontSize: 13, borderRadius: 3, outline: "none",
              }}
            />
          </label>
        </div>

        {/* Results */}
        {recs.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {recs.map(r => r.listing && (
              <div key={r.label} style={{
                background: "var(--bg)", border: "1px solid var(--border)",
                borderTop: `3px solid ${r.color}`, padding: "18px 20px",
              }}>
                <div style={{ ...BODY, fontSize: 11, fontWeight: 600, color: r.color, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 10 }}>
                  {r.label}
                </div>
                <div style={{ ...MONO, fontSize: 28, fontWeight: 500, color: r.color, letterSpacing: "-0.025em", lineHeight: 1 }}>
                  ${fmt(r.listing.price_per_hour)}
                  <span style={{ fontSize: 13, fontWeight: 300, color: "var(--text-muted)" }}>/hr</span>
                </div>
                <div style={{ ...BODY, fontSize: 13, color: "var(--text-secondary)", margin: "8px 0 3px", fontWeight: 500 }}>{r.listing.provider}</div>
                <div style={{ ...BODY, fontSize: 11, color: "var(--text-muted)" }}>{r.listing.gpu_model} · {r.listing.region}</div>
                <Rule my={12} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ ...BODY, fontSize: 11, color: "var(--text-muted)" }}>{hours}h estimate</span>
                  <span style={{ ...MONO, fontSize: 15, fontWeight: 500, color: "var(--text-primary)" }}>
                    ${fmt(r.listing.price_per_hour * hours)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ ...BODY, fontSize: 13, color: "var(--text-muted)", padding: "24px 0" }}>No {gpu} listings available.</div>
        )}
      </div>
    </div>
  );
}

// ── Section heading (Economist-style) ─────────────────────────────────────────

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 18, paddingBottom: 12, borderBottom: "2px solid var(--text-primary)" }}>
      <h2 style={{ ...BODY, fontSize: 18, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>{title}</h2>
      {sub && <p style={{ ...BODY, fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DashboardClient({ summary, listings }: Props) {
  const h100Spot = listings.filter(l => l.gpu_model.includes("H100") && l.pricing_type === "spot");
  const a100Spot = listings.filter(l => l.gpu_model.includes("A100") && l.pricing_type === "spot");
  const h100Prices = h100Spot.map(l => l.price_per_hour).sort((a, b) => a - b);
  const a100Prices = a100Spot.map(l => l.price_per_hour).sort((a, b) => a - b);

  const h100Avg = summary?.h100_spot_avg ?? (h100Prices.length ? h100Prices.reduce((s, p) => s + p, 0) / h100Prices.length : 0);
  const a100Avg = summary?.a100_spot_avg ?? (a100Prices.length ? a100Prices.reduce((s, p) => s + p, 0) / a100Prices.length : 0);
  const updatedAgo = minsAgo(summary?.last_updated);

  const signals = useMemo(() => {
    if (!listings.length) return [];
    const counts: Record<string, number> = {};
    listings.forEach(l => { counts[l.provider] = (counts[l.provider] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const h100s = listings.filter(l => l.gpu_model.includes("H100") && l.pricing_type === "spot");
    const partialProviders = ALL_PROVIDERS.filter(p => p.status === "partial");
    const highAvail = listings.filter(l => l.availability === "high");

    return [
      top && {
        headline: "Supply leader",
        body: `${top[0]} leads the index with ${top[1]} active listings — the largest single-provider footprint currently tracked.`,
        type: "info" as const,
      },
      h100s.length >= 2 && {
        headline: "H100 spread",
        body: `Spot pricing spans $${fmt(Math.min(...h100s.map(l => l.price_per_hour)))} to $${fmt(Math.max(...h100s.map(l => l.price_per_hour)))}/hr across ${new Set(h100s.map(l => l.provider)).size} providers.`,
        sub: `${h100s.length} spot listings active`,
        type: "warn" as const,
      },
      highAvail.length > 0 && {
        headline: "High availability",
        body: `${highAvail.length} listings report confirmed high availability — lower interruption risk for production workloads.`,
        type: "success" as const,
      },
      partialProviders.length > 0 && {
        headline: "Partial data",
        body: `${partialProviders.map(p => p.name).join(", ")} — normalization in progress. Pricing data may be incomplete or delayed.`,
        type: "neutral" as const,
      },
    ].filter(Boolean) as { headline: string; body: string; sub?: string; type: "info" | "warn" | "success" | "neutral" }[];
  }, [listings]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text-primary)" }}>
      <style>{`
        .tsort:hover { color: var(--blue) !important; }
        tr:hover td { background: rgba(20,20,20,0.018) !important; }
        select option { background: #fff; color: #171717; }
        input::placeholder { color: var(--text-muted); }
        @media (max-width: 860px) {
          .brief-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
          .charts-grid { grid-template-columns: 1fr !important; }
          .tiles-grid  { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 540px) {
          .tiles-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <MarketRibbon listings={listings} summary={summary} />
      <Header listings={listings} summary={summary} />
      <MarketBrief listings={listings} summary={summary} />

      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "44px 32px 80px" }}>

        {/* ── Market Index ── */}
        <div style={{ marginBottom: 48 }}>
          <SectionHead title="Market Index" sub="Real-time price benchmarks across GPU families" />
          <div className="tiles-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
            <IndexTile
              label="H100 Spot Avg."
              value={h100Avg > 0 ? `$${fmt(h100Avg)}` : "—"}
              note={`${h100Prices.length} spot listings`}
              color="var(--blue)"
              spark={h100Prices.slice(0, 10)}
              footnote={h100Prices.length >= 2 ? `Range $${fmt(h100Prices[0])} – $${fmt(h100Prices[h100Prices.length - 1])}` : undefined}
            />
            <IndexTile
              label="A100 Spot Avg."
              value={a100Avg > 0 ? `$${fmt(a100Avg)}` : "—"}
              note={`${a100Prices.length} spot listings`}
              color="var(--green)"
              spark={a100Prices.slice(0, 10)}
              footnote={a100Prices.length >= 2 ? `Range $${fmt(a100Prices[0])} – $${fmt(a100Prices[a100Prices.length - 1])}` : undefined}
            />
            <IndexTile
              label="Active Providers"
              value={String(summary?.active_providers ?? ALL_PROVIDERS.filter(p => p.status === "live").length)}
              note={`of ${ALL_PROVIDERS.length} tracked`}
              color="var(--amber)"
              footnote={`${ALL_PROVIDERS.filter(p => p.status === "partial").length} partial coverage`}
            />
            <IndexTile
              label="Total Listings"
              value={fmtK(listings.length)}
              note="last 25 hours"
              color="var(--text-primary)"
              spark={[listings.length * 0.6, listings.length * 0.72, listings.length * 0.83, listings.length * 0.93, listings.length]}
              footnote={`${new Set(listings.map(l => l.provider)).size} active providers`}
            />
            <IndexTile
              label="Data Freshness"
              value={updatedAgo}
              note="last ingestion"
              color="var(--text-muted)"
              footnote="Refreshes daily via cron"
            />
          </div>
        </div>

        {/* ── Charts ── */}
        <div style={{ marginBottom: 48 }}>
          <SectionHead title="Price Analysis" sub="Provider spread, GPU families, and hyperscaler premiums" />
          <div className="charts-grid" style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 16 }}>
            <H100SpreadChart listings={listings} />
            <div>
              <GpuSmallMultiples listings={listings} />
            </div>
          </div>
        </div>

        {/* ── Market Signals ── */}
        {signals.length > 0 && (
          <div style={{ marginBottom: 48 }}>
            <SectionHead title="Market Signals" sub="Automated analysis of supply, pricing, and data quality" />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const }}>
              {signals.map((s, i) => <SignalCard key={i} {...s} />)}
            </div>
          </div>
        )}

        {/* ── Provider Explorer ── */}
        <div style={{ marginBottom: 48 }}>
          <SectionHead title="Provider Explorer" sub="Live GPU listings — filter, sort, and compare" />
          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", padding: "0 22px" }}>
            <ProviderExplorer listings={listings} />
          </div>
        </div>

        {/* ── Workload Optimizer ── */}
        <div style={{ marginBottom: 48 }}>
          <WorkloadOptimizer listings={listings} />
        </div>

        {/* ── Footer ── */}
        <Rule />
        <div style={{ paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: 12 }}>
          <div style={{ ...BODY, fontSize: 12, color: "var(--text-muted)" }}>
            AIInfraWatch · AI compute is a fragmented, live market. Prices are indicative only.
          </div>
          <div style={{ ...MONO, fontSize: 11, color: "var(--text-muted)" }}>
            {listings.length} listings · {updatedAgo}
          </div>
        </div>
      </div>
    </div>
  );
}
