"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import SiteNav from "@/components/SiteNav";
import MarketTicker from "@/components/MarketTicker";
import {
  GpuListing, HYPERSCALERS, PROVIDER_META,
  getMeta, fmtP, fmtMoney, minsAgo,
} from "@/lib/market-helpers";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MarketSummary {
  h100_spot_avg: number; a100_spot_avg: number;
  active_providers: number; total_listings: number;
  energy_cheapest_price: number; last_updated: string;
  cheapest_h100?: GpuListing | null; cheapest_a100?: GpuListing | null;
}
interface Props { summary: MarketSummary | null; listings: GpuListing[]; }

// ── Design tokens ─────────────────────────────────────────────────────────────

const MONO:  React.CSSProperties = { fontFamily: "var(--font-mono)" };
const SERIF: React.CSSProperties = { fontFamily: "var(--font-serif)" };
const SANS:  React.CSSProperties = { fontFamily: "var(--font-sans)" };
const BODY:  React.CSSProperties = { fontFamily: "var(--font-body)" };

// ── Constants ─────────────────────────────────────────────────────────────────

const TOTAL_TRACKED = 16;
const DATA_CAVEAT   =
  "Prices are normalised per provider — methodology varies. Some GPUs (including H100) may be absent from a given snapshot window. For current pricing on a specific GPU or region, request a cost audit.";

const ALL_PROVIDERS = [
  { slug: "runpod",      name: "RunPod",       cat: "Marketplace", status: "live" },
  { slug: "aws",         name: "AWS",          cat: "Hyperscaler", status: "live" },
  { slug: "azure",       name: "Azure",        cat: "Hyperscaler", status: "live" },
  { slug: "gcp",         name: "GCP",          cat: "Hyperscaler", status: "live" },
  { slug: "coreweave",   name: "CoreWeave",    cat: "Neocloud",    status: "live" },
  { slug: "lambda",      name: "Lambda Labs",  cat: "Neocloud",    status: "live" },
  { slug: "nebius",      name: "Nebius",       cat: "Neocloud",    status: "live" },
  { slug: "tensordock",  name: "TensorDock",   cat: "Marketplace", status: "live" },
  { slug: "oci",         name: "Oracle Cloud", cat: "Hyperscaler", status: "live" },
  { slug: "paperspace",  name: "Paperspace",   cat: "Neocloud",    status: "live" },
  { slug: "crusoe",      name: "Crusoe",       cat: "Neocloud",    status: "live" },
  { slug: "fluidstack",  name: "FluidStack",   cat: "Marketplace", status: "live" },
  { slug: "ibm",         name: "IBM Cloud",    cat: "Hyperscaler", status: "live" },
  { slug: "gmi",         name: "GMI Cloud",    cat: "Neocloud",    status: "live" },
  { slug: "voltagepark", name: "VoltagePark",  cat: "Neocloud",    status: "live" },
  { slug: "vastai",      name: "Vast.ai",      cat: "Marketplace", status: "partial" },
];

const GPU_FAMILIES  = ["All", "H100", "A100", "L40S", "A10G", "B200"];

// DC GPU matching — word-boundary aware ("A40" must not match "RTX A4000")
const DC_GPU_KEYWORDS = ["H100","H200","A100","L40S","L40","A10G","A10","A30","A40","B200","MI300"];
const isDcGpu = (model: string): boolean => {
  const m = model.toUpperCase();
  return DC_GPU_KEYWORDS.some(k => {
    const idx = m.indexOf(k);
    if (idx === -1) return false;
    const after = m[idx + k.length];
    return !after || !/\d/.test(after);
  });
};

const availColor = (a: string) =>
  a === "high" ? "var(--green)" : a === "medium" ? "var(--amber)" : a === "low" ? "var(--red)" : "var(--text-muted)";

// ── Confidence Badge ──────────────────────────────────────────────────────────

type ConfidenceLevel = "high-avail" | "observed" | "partial" | "pending" | "reliable";
function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const config: Record<ConfidenceLevel, { label: string; color: string; bg: string; border: string }> = {
    "high-avail": { label: "High availability", color: "var(--green)", bg: "var(--green-dim)", border: "rgba(8,127,91,0.2)" },
    "observed":   { label: "Observed only",     color: "var(--text-muted)", bg: "var(--elevated)", border: "var(--border-mid)" },
    "partial":    { label: "Coverage partial",  color: "var(--amber)", bg: "var(--amber-dim)", border: "rgba(183,121,31,0.2)" },
    "pending":    { label: "Not in snapshot",    color: "var(--amber)", bg: "var(--amber-dim)", border: "rgba(183,121,31,0.2)" },
    "reliable":   { label: "Reliable",          color: "var(--blue)",  bg: "var(--blue-dim)",  border: "rgba(30,94,255,0.2)" },
  };
  const c = config[level];
  return (
    <span style={{
      ...SANS, fontSize: 9.5, color: c.color,
      background: c.bg, border: `1px solid ${c.border}`,
      padding: "2px 7px", borderRadius: 2, letterSpacing: "0.04em",
      textTransform: "uppercase" as const, whiteSpace: "nowrap" as const, fontWeight: 500,
    }}>{c.label}</span>
  );
}

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

const Rule = ({ my = 0 }: { my?: number }) => (
  <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: `${my}px 0` }} />
);

// ── Header ────────────────────────────────────────────────────────────────────

// ── Market Hero ───────────────────────────────────────────────────────────────

interface MarketHeroProps {
  listings: GpuListing[];
  summary: MarketSummary | null;
  activeProviders: number;
  cheapestH100High: GpuListing | undefined;
  h100Prices: number[];
  premiumPct: number | null;
  a100PremiumPct: number | null;
  capacityConf: number;
}

function MarketHero({ listings, summary, activeProviders, cheapestH100High, h100Prices, premiumPct, a100PremiumPct, capacityConf }: MarketHeroProps) {
  // Only show premium when it is meaningfully positive (>0)
  const effectivePremium = (premiumPct !== null && premiumPct > 0) ? premiumPct
    : (a100PremiumPct !== null && a100PremiumPct > 0) ? a100PremiumPct
    : null;
  const premiumIsH100 = premiumPct !== null && premiumPct > 0;

  // H100 stat
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
    <div style={{ background: "var(--panel)", borderBottom: "2px solid var(--border)" }}>
      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "44px 32px 36px" }}>
        {/* Eyebrow */}
        <p style={{ ...MONO, fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: 16 }}>
          {activeProviders} {activeProviders === 1 ? "PROVIDER" : "PROVIDERS"} · UPDATED DAILY
        </p>

        <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 52, alignItems: "center" }}>
          {/* Left: headline + CTAs */}
          <div>
            <h1 style={{ ...SERIF, fontSize: 40, fontWeight: 400, lineHeight: 1.12, color: "var(--text-primary)", marginBottom: 14 }}>
              Your AI compute bill is probably priced wrong.
            </h1>
            <p style={{ ...BODY, fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: 520, marginBottom: 24 }}>
              AIInfraWatch compares live GPU prices, availability, and workload fit so you know what to keep, what to move, and where you may be overpaying.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <Link href="/cost-audit" style={{
                ...SANS, fontSize: 13.5, fontWeight: 600,
                color: "#F7F3EA", background: "#171717",
                padding: "11px 22px", borderRadius: 3, textDecoration: "none",
                letterSpacing: "0.01em", whiteSpace: "nowrap" as const,
              }}>
                Run a cost audit →
              </Link>
              <a href="#market-data" style={{
                ...SANS, fontSize: 13, color: "var(--text-secondary)",
                padding: "11px 20px", borderRadius: 3, textDecoration: "none",
                border: "1px solid var(--border-mid)", whiteSpace: "nowrap" as const,
              }}>
                View live market ↓
              </a>
            </div>
          </div>

          {/* Right: 3-stat strip */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 1, border: "1px solid var(--border)", background: "var(--border)" }}>
            {/* Stat 1: Cheapest reliable H100 */}
            <div style={{ background: "var(--bg)", padding: "14px 18px" }}>
              <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 5 }}>
                {cheapestH100High ? "Cheapest reliable H100" : h100Prices.length ? "Cheapest observed H100" : "H100"}
              </div>
              {h100Value ? (
                <>
                  <div style={{ ...MONO, fontSize: 22, fontWeight: 500, color: h100Color, letterSpacing: "-0.02em", lineHeight: 1 }}>
                    {h100Value}<span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 300 }}>/hr</span>
                  </div>
                  {h100Sub && <div style={{ ...SANS, fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{h100Sub}</div>}
                </>
              ) : (
                <div style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)" }}>Not in current snapshot</div>
              )}
            </div>

            {/* Stat 2: Hyperscaler premium — only shown when meaningfully positive */}
            <div style={{ background: "var(--bg)", padding: "14px 18px" }}>
              <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 5 }}>
                Hyperscaler premium{effectivePremium !== null ? ` (${premiumIsH100 ? "H100" : "A100"})` : ""}
              </div>
              {effectivePremium !== null ? (
                <>
                  <div style={{ ...MONO, fontSize: 22, fontWeight: 500, color: "var(--amber)", letterSpacing: "-0.02em", lineHeight: 1 }}>
                    +{Math.round(effectivePremium)}%
                  </div>
                  <div style={{ ...SANS, fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>vs. specialist clouds</div>
                </>
              ) : (
                <div style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)" }}>No premium right now</div>
              )}
            </div>

            {/* Stat 3: Capacity confidence */}
            <div style={{ background: "var(--bg)", padding: "14px 18px" }}>
              <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 5 }}>
                Capacity confidence
              </div>
              <div style={{ ...MONO, fontSize: 22, fontWeight: 500, color: capacityConf >= 60 ? "var(--green)" : "var(--amber)", letterSpacing: "-0.02em", lineHeight: 1 }}>
                {capacityConf}%
              </div>
              <div style={{ ...SANS, fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                of {listings.length.toLocaleString()} {listings.length === 1 ? "listing" : "listings"} high-avail.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// ── Market Index Tiles ────────────────────────────────────────────────────────

function IndexTile({ label, value, note, color, spark, footnote, badge }: {
  label: string; value: string; note?: string; color: string;
  spark?: number[]; footnote?: string; badge?: ConfidenceLevel;
}) {
  const showBadge = badge && badge !== "high-avail" && badge !== "reliable";
  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: "20px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 10 }}>
        <div style={{ ...SANS, fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", fontWeight: 600 }}>{label}</div>
        {showBadge && <ConfidenceBadge level={badge} />}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div style={{ ...MONO, fontSize: 32, fontWeight: 500, color, lineHeight: 1, letterSpacing: "-0.03em" }}>{value}</div>
          {note && <div style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)", marginTop: 5 }}>{note}</div>}
        </div>
        {spark && spark.length >= 2 && <Sparkline values={spark} color={color} width={60} height={28} />}
      </div>
      {footnote && <div style={{ ...SANS, fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)" }}>{footnote}</div>}
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
      .map(([name, { prices, cat }]) => ({ name, cat, min: Math.min(...prices), max: Math.max(...prices), avg: prices.reduce((s, p) => s + p, 0) / prices.length }))
      .sort((a, b) => a.min - b.min)
      .slice(0, 12);
  }, [listings]);

  if (!data.length) return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", padding: "24px 28px" }}>
      <div style={{ ...SANS, fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>H100 Pricing by Provider</div>
      <div style={{ ...SANS, fontSize: 12.5, color: "var(--text-muted)", padding: "20px 0" }}>No H100 listings in the current window. Coverage is expanding.</div>
    </div>
  );

  const hyperRows = data.filter(d => d.cat === "Hyperscaler");
  const specRows  = data.filter(d => d.cat !== "Hyperscaler");
  const hyperAvg  = hyperRows.length ? hyperRows.reduce((s, d) => s + d.avg, 0) / hyperRows.length : 0;
  const specAvg   = specRows.length  ? specRows.reduce((s, d)  => s + d.avg, 0) / specRows.length  : 0;
  const premiumX  = specAvg > 0 && hyperAvg > 0 ? (hyperAvg / specAvg).toFixed(1) : null;
  const absMax    = Math.max(...data.map(d => d.max));
  const catColor  = (cat: string) => cat === "Hyperscaler" ? "var(--amber)" : cat === "Neocloud" ? "var(--blue)" : "var(--violet)";

  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", padding: "24px 28px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <div>
          <h3 style={{ ...SANS, fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>H100 Pricing by Provider</h3>
          <p style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>What the headline price hides — spreads and premiums</p>
        </div>
        {premiumX && (
          <div style={{ textAlign: "right" as const, background: "var(--amber-dim)", border: "1px solid rgba(183,121,31,0.25)", padding: "6px 12px" }}>
            <div style={{ ...MONO, fontSize: 18, fontWeight: 500, color: "var(--amber)" }}>{premiumX}×</div>
            <div style={{ ...SANS, fontSize: 9.5, color: "var(--text-muted)" }}>hyperscaler multiple</div>
          </div>
        )}
      </div>
      <Rule my={14} />
      <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 88px", gap: 12, marginBottom: 6 }}>
        <div /><div style={{ display: "flex", justifyContent: "space-between" }}>
          {[0, absMax / 2, absMax].map(v => <span key={v} style={{ ...MONO, fontSize: 9, color: "var(--text-muted)" }}>{fmtP(v)}</span>)}
        </div><div />
      </div>
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 7 }}>
        {data.map(d => {
          const barLeft  = (d.min / absMax) * 100;
          const barWidth = Math.max(((d.max - d.min) / absMax) * 100, 0.8);
          const avgPct   = (d.avg / absMax) * 100;
          const cc = catColor(d.cat);
          const isFirst = d === data[0];
          return (
            <div key={d.name} style={{ display: "grid", gridTemplateColumns: "100px 1fr 88px", gap: 12, alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 2, height: 12, background: cc, flexShrink: 0 }} />
                <span style={{ ...SANS, fontSize: 12, color: isFirst ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: isFirst ? 600 : 400, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</span>
              </div>
              <div style={{ position: "relative" as const, height: 6, background: "var(--elevated)", borderRadius: 1 }}>
                <div style={{ position: "absolute" as const, left: `${barLeft}%`, width: `${barWidth}%`, height: "100%", background: cc, opacity: 0.85, borderRadius: 1 }} />
                <div style={{ position: "absolute" as const, left: `${avgPct}%`, width: 1.5, height: "140%", top: "-20%", background: "rgba(20,20,20,0.3)", transform: "translateX(-0.75px)" }} />
              </div>
              <div style={{ textAlign: "right" as const }}>
                <span style={{ ...MONO, fontSize: 12, fontWeight: isFirst ? 600 : 400, color: isFirst ? "var(--green)" : "var(--text-secondary)" }}>
                  {fmtP(d.min)}{d.max > d.min * 1.1 ? <span style={{ fontSize: 10, color: "var(--text-muted)" }}>–{fmtP(d.max)}</span> : null}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <Rule my={14} />
      <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 14, alignItems: "center" }}>
        {[["Hyperscaler","var(--amber)"],["Neocloud","var(--blue)"],["Marketplace","var(--violet)"]].map(([l,c]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, background: c, borderRadius: 1 }} />
            <span style={{ ...SANS, fontSize: 11, color: "var(--text-muted)" }}>{l}</span>
          </div>
        ))}
        {premiumX && <span style={{ ...SANS, fontSize: 11, color: "var(--text-muted)", flex: 1, textAlign: "right" as const }}>Hyperscalers {premiumX}× more than specialists on avg.</span>}
      </div>
    </div>
  );
}

// ── Price by GPU Family (horizontal bar) ──────────────────────────────────────

function PriceByFamily({ listings }: { listings: GpuListing[] }) {
  const data = useMemo(() => {
    const families = ["H100 SXM5 80GB","H100 SXM 80GB","H100 PCIe 80GB","H100 NVL 80GB","A100 SXM 80GB","A100 PCIe 80GB","A100 SXM 40GB","L40S 48GB","L40 48GB","A10G 24GB","A40","L4 24GB"];
    return families
      .map(fam => {
        const ls = listings.filter(l => l.gpu_model === fam || l.gpu_model.includes(fam.split(" ")[0] + " " + fam.split(" ")[1]));
        const exact = listings.filter(l => l.gpu_model === fam);
        const pool  = exact.length ? exact : ls;
        if (!pool.length) return null;
        const prices  = pool.map(l => l.price_per_hour);
        const highAvL = pool.filter(l => l.availability === "high");
        const minHighAv = highAvL.length ? Math.min(...highAvL.map(l => l.price_per_hour)) : null;
        const cat = getMeta(pool.sort((a, b) => a.price_per_hour - b.price_per_hour)[0].provider).cat;
        return { name: fam, min: Math.min(...prices), minReliable: minHighAv, cat, count: pool.length };
      })
      .filter(Boolean)
      .sort((a, b) => a!.min - b!.min) as { name: string; min: number; minReliable: number | null; cat: string; count: number }[];
  }, [listings]);

  if (!data.length) return null;

  const catColor = (cat: string): string => {
    if (cat === "Hyperscaler") return "#B7791F";
    if (cat === "Neocloud")    return "#1E5EFF";
    return "#6741D9";
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={{ background: "var(--panel)", border: "1px solid var(--border-mid)", padding: "8px 12px", boxShadow: "var(--shadow-md)" }}>
        <div style={{ ...SANS, fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3 }}>{d.name}</div>
        <div style={{ ...MONO, fontSize: 11, color: "var(--text-muted)" }}>From {fmtP(d.min)}/hr · {d.count} listings</div>
        {d.minReliable !== null && <div style={{ ...MONO, fontSize: 11, color: "var(--green)" }}>Reliable from {fmtP(d.minReliable)}/hr</div>}
      </div>
    );
  };

  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", padding: "24px 28px" }}>
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ ...SANS, fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>Posted price vs capacity signal</h3>
        <p style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>Lowest observed price per GPU family — bars show cheapest available, dots show cheapest high-availability</p>
      </div>
      <ResponsiveContainer width="100%" height={data.length * 28 + 40}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 80, bottom: 0, left: 110 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(20,20,20,0.06)" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={v => fmtP(v)}
            tick={{ fontFamily: "var(--font-sans)", fontSize: 10, fill: "#858B94" }}
            tickCount={5}
            domain={[0, "dataMax + 1"]}
          />
          <YAxis
            type="category" dataKey="name" width={110}
            tick={{ fontFamily: "var(--font-sans)", fontSize: 10.5, fill: "#555B63" }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(20,20,20,0.04)" }} />
          <Bar dataKey="min" radius={[0, 2, 2, 0]} maxBarSize={12}>
            {data.map((d, i) => <Cell key={i} fill={catColor(d.cat)} fillOpacity={0.8} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" as const, marginTop: 10 }}>
        {[["Hyperscaler","#B7791F"],["Neocloud","#1E5EFF"],["Marketplace","#6741D9"]].map(([l,c]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 10, height: 10, background: c, opacity: 0.8, borderRadius: 1 }} />
            <span style={{ ...SANS, fontSize: 11, color: "var(--text-muted)" }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── GPU Small Multiples ───────────────────────────────────────────────────────

function GpuSmallMultiples({ listings }: { listings: GpuListing[] }) {
  const cards = ["H100", "A100", "L40S", "A10G"].map(family => {
    const ls = listings.filter(l => l.gpu_model.includes(family));
    if (!ls.length) return null;
    const prices   = ls.map(l => l.price_per_hour).sort((a, b) => a - b);
    const highLs   = ls.filter(l => l.availability === "high");
    const minReliable = highLs.length ? Math.min(...highLs.map(l => l.price_per_hour)) : null;
    const gapPct   = minReliable && prices[0] > 0
      ? Math.round(((minReliable - prices[0]) / prices[0]) * 100) : null;
    return { family, count: ls.length, min: prices[0], max: prices[prices.length - 1], minReliable, gapPct };
  }).filter(Boolean) as { family: string; count: number; min: number; max: number; minReliable: number | null; gapPct: number | null }[];

  if (!cards.length) return <div style={{ ...SANS, fontSize: 12, color: "var(--text-muted)", padding: "20px 0" }}>No DC GPU data.</div>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
      {cards.map(c => (
        <div key={c.family} style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: "16px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <span style={{ ...MONO, fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{c.family}</span>
            <span style={{ ...SANS, fontSize: 10, color: "var(--text-muted)" }}>{c.count} listings</span>
          </div>

          {/* The gap is the story */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <div style={{ ...SANS, fontSize: 9.5, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 3 }}>Cheapest observed</div>
              <div style={{ ...MONO, fontSize: 20, fontWeight: 500, color: "var(--text-secondary)", letterSpacing: "-0.02em" }}>{fmtP(c.min)}</div>
            </div>
            <div>
              <div style={{ ...SANS, fontSize: 9.5, color: c.minReliable ? "var(--green)" : "var(--amber)", textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 3 }}>
                {c.minReliable ? "Reliable from" : "No reliable listings"}
              </div>
              {c.minReliable ? (
                <div style={{ ...MONO, fontSize: 20, fontWeight: 500, color: "var(--green)", letterSpacing: "-0.02em" }}>{fmtP(c.minReliable)}</div>
              ) : (
                <div style={{ ...SANS, fontSize: 11, color: "var(--amber)", marginTop: 2 }}>Observed only</div>
              )}
            </div>
          </div>

          {/* Gap annotation */}
          {c.gapPct !== null && c.gapPct > 0 && (
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border)", ...SANS, fontSize: 11, color: "var(--text-muted)" }}>
              +{c.gapPct}% for confirmed availability
            </div>
          )}
          {!c.minReliable && (
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border)", ...SANS, fontSize: 11, color: "var(--amber)" }}>
              Not a production routing target.
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Signal Cards ──────────────────────────────────────────────────────────────

function SignalCard({ headline, body, sub, type }: {
  headline: string; body: string; sub?: string;
  type: "info" | "warn" | "success" | "neutral";
}) {
  const colors = { info: "var(--blue)", warn: "var(--amber)", success: "var(--green)", neutral: "var(--text-muted)" } as const;
  const c = colors[type];
  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderTop: `3px solid ${c}`, boxShadow: "var(--shadow-sm)", padding: "14px 18px", flex: "1 1 190px", minWidth: 180 }}>
      <div style={{ ...SANS, fontSize: 10.5, fontWeight: 600, color: c, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 6 }}>{headline}</div>
      <div style={{ ...SANS, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>{body}</div>
      {sub && <div style={{ ...SANS, fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Freshness Badge ───────────────────────────────────────────────────────────

function FreshnessBadge({ iso }: { iso?: string }) {
  const mins = iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 60000) : 999;
  const color = mins < 120 ? "var(--green)" : mins < 720 ? "var(--amber)" : "var(--red)";
  return (
    <span style={{
      ...MONO, fontSize: 10, color,
      background: mins < 120 ? "var(--green-dim)" : mins < 720 ? "var(--amber-dim)" : "var(--red-dim)",
      border: `1px solid ${color}30`, padding: "2px 6px", borderRadius: 2, whiteSpace: "nowrap" as const,
    }}>{minsAgo(iso)}</span>
  );
}

// ── Provider Explorer ─────────────────────────────────────────────────────────

function ProviderExplorer({ listings }: { listings: GpuListing[] }) {
  // Determine the best default tab synchronously: H100 > A100 > All
  const getDefaultFamily = () => {
    if (listings.some(l => l.gpu_model.includes("H100"))) return "H100";
    if (listings.some(l => l.gpu_model.includes("A100"))) return "A100";
    return "All";
  };

  const [gpuFamily,   setGpuFamily]   = useState(getDefaultFamily);
  const [search,      setSearch]      = useState("");
  const [catFilter,   setCatFilter]   = useState("all");
  const [typeFilter,  setTypeFilter]  = useState("all");
  const [availFilter, setAvailFilter] = useState("all");
  const [sortKey,     setSortKey]     = useState<"price" | "gpu" | "provider">("price");
  const [sortDir,     setSortDir]     = useState<"asc" | "desc">("asc");
  const [expanded,    setExpanded]    = useState<Set<string>>(new Set());
  const [grouped,     setGrouped]     = useState(true);

  const effectiveFamily = gpuFamily;

  const filtered = useMemo(() => {
    let r = listings;
    if (effectiveFamily !== "All") r = r.filter(l => l.gpu_model.toUpperCase().includes(effectiveFamily.toUpperCase()));
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(l => l.gpu_model.toLowerCase().includes(q) || l.provider.toLowerCase().includes(q) || l.region.toLowerCase().includes(q));
    }
    if (catFilter   !== "all") r = r.filter(l => getMeta(l.provider).cat === catFilter);
    if (typeFilter  !== "all") r = r.filter(l => l.pricing_type === typeFilter);
    if (availFilter !== "all") r = r.filter(l => l.availability === availFilter);
    return [...r].sort((a, b) => {
      const [av, bv] = sortKey === "price" ? [a.price_per_hour, b.price_per_hour]
        : sortKey === "provider" ? [a.provider, b.provider] : [a.gpu_model, b.gpu_model];
      return sortDir === "asc" ? (av < bv ? -1 : av > bv ? 1 : 0) : (av > bv ? -1 : av < bv ? 1 : 0);
    });
  }, [listings, effectiveFamily, search, catFilter, typeFilter, availFilter, sortKey, sortDir]);

  const groupMap = useMemo(() => {
    const m = new Map<string, GpuListing[]>();
    filtered.forEach(l => { if (!m.has(l.gpu_model)) m.set(l.gpu_model, []); m.get(l.gpu_model)!.push(l); });
    return [...m.entries()].sort((a, b) => Math.min(...a[1].map(l => l.price_per_hour)) - Math.min(...b[1].map(l => l.price_per_hour)));
  }, [filtered]);

  const concentrationChip = useMemo(() => {
    if (!filtered.length) return null;
    const counts: Record<string, number> = {};
    filtered.forEach(l => { counts[l.provider] = (counts[l.provider] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return { provider: getMeta(top[0]).short, pct: Math.round((top[1] / filtered.length) * 100) };
  }, [filtered]);

  const toggleSort   = (k: typeof sortKey) => { if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortKey(k); setSortDir("asc"); } };
  const toggleExpand = (gpu: string) => setExpanded(prev => { const n = new Set(prev); n.has(gpu) ? n.delete(gpu) : n.add(gpu); return n; });

  const SortIcon = ({ k }: { k: typeof sortKey }) => (
    <span style={{ marginLeft: 3, color: sortKey === k ? "var(--blue)" : "var(--text-muted)", fontSize: 8 }}>
      {sortKey === k ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
    </span>
  );

  const inputSt: React.CSSProperties = {
    ...SANS, background: "var(--panel)", border: "1px solid var(--border-mid)",
    color: "var(--text-primary)", padding: "6px 10px", fontSize: 12.5, outline: "none",
    borderRadius: 3, boxShadow: "var(--shadow-sm)",
  };
  const thSt: React.CSSProperties = {
    ...SANS, fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)",
    textTransform: "uppercase" as const, letterSpacing: "0.06em",
    padding: "9px 12px 9px 0", textAlign: "left" as const,
    borderBottom: "2px solid var(--border-mid)", background: "var(--panel)",
    position: "sticky" as const, top: 0, whiteSpace: "nowrap" as const,
  };

  return (
    <div>
      {/* GPU tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", overflowX: "auto" }}>
        {GPU_FAMILIES.map(f => (
          <button key={f} onClick={() => setGpuFamily(f)} style={{
            ...SANS, fontSize: 13, padding: "9px 16px",
            background: "none", border: "none",
            borderBottom: gpuFamily === f ? "2px solid var(--blue)" : "2px solid transparent",
            color: gpuFamily === f ? "var(--blue)" : "var(--text-muted)",
            cursor: "pointer", whiteSpace: "nowrap" as const, marginBottom: -1,
            fontWeight: gpuFamily === f ? 600 : 400,
          }}>{f}</button>
        ))}
        <div style={{ flex: 1 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 5, ...SANS, fontSize: 11.5, color: "var(--text-muted)", cursor: "pointer", padding: "0 14px" }}>
          <input type="checkbox" checked={grouped} onChange={e => setGrouped(e.target.checked)} style={{ accentColor: "var(--blue)" }} />
          Group by GPU
        </label>
      </div>

      {/* Filters row */}
      <div style={{ display: "flex", gap: 8, padding: "10px 0", flexWrap: "wrap" as const, alignItems: "center", borderBottom: "1px solid var(--border)" }}>
        <input placeholder="Search GPU, provider, region…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputSt, width: 200 }} />
        {[
          { v: catFilter,   set: setCatFilter,   opts: [["all","All categories"],["Hyperscaler","Hyperscaler"],["Neocloud","Neocloud"],["Marketplace","Marketplace"]] },
          { v: typeFilter,  set: setTypeFilter,  opts: [["all","All types"],["spot","Spot"],["on-demand","On-demand"],["reserved-1yr","Reserved 1yr"]] },
          { v: availFilter, set: setAvailFilter, opts: [["all","All availability"],["high","High"],["medium","Medium"],["low","Low"]] },
        ].map((s, i) => (
          <select key={i} value={s.v} onChange={e => s.set(e.target.value)} style={{ ...inputSt, cursor: "pointer" }}>
            {s.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}
        <div style={{ flex: 1 }} />
        {concentrationChip && concentrationChip.pct >= 60 && (
          <span style={{ ...SANS, fontSize: 10.5, color: "var(--amber)", background: "var(--amber-dim)", border: "1px solid rgba(183,121,31,0.25)", padding: "3px 9px", borderRadius: 2, fontWeight: 500 }}>
            ⚠ {concentrationChip.pct}% supply: {concentrationChip.provider}
          </span>
        )}
        <span style={{ ...SANS, fontSize: 11, color: "var(--text-muted)" }}>
          Showing {filtered.length.toLocaleString()} of {listings.length.toLocaleString()} listings
          {effectiveFamily !== "All" ? ` · ${effectiveFamily}` : ""}
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", maxHeight: 560, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr>
              {grouped && <th style={{ ...thSt, width: 20, padding: "9px 4px 9px 0" }} />}
              <th className="tsort" onClick={() => toggleSort("gpu")} style={{ ...thSt, cursor: "pointer" }}>GPU <SortIcon k="gpu" /></th>
              <th className="tsort" onClick={() => toggleSort("provider")} style={{ ...thSt, cursor: "pointer" }}>Provider <SortIcon k="provider" /></th>
              <th style={thSt}>Region</th>
              <th style={thSt}>Type</th>
              <th className="tsort" onClick={() => toggleSort("price")} style={{ ...thSt, textAlign: "right" as const, cursor: "pointer" }}>$/hr <SortIcon k="price" /></th>
              <th style={thSt}>Avail.</th>
              <th style={{ ...thSt, paddingRight: 0 }}>Updated</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={grouped ? 8 : 7} style={{ ...SANS, padding: "3rem", color: "var(--text-muted)", textAlign: "center", fontSize: 13 }}>
                  No listings match your filters. <span style={{ color: "var(--blue)", cursor: "pointer" }} onClick={() => { setSearch(""); setCatFilter("all"); setTypeFilter("all"); setAvailFilter("all"); setGpuFamily("All"); }}>Clear all</span>
                </td>
              </tr>
            ) : grouped ? (
              groupMap.flatMap(([gpu, rows]) => {
                const isOpen      = expanded.has(gpu);
                const provSet     = new Set(rows.map(r => r.provider));
                const allPrices   = rows.map(r => r.price_per_hour).sort((a, b) => a - b);
                const highRows    = rows.filter(r => r.availability === "high");
                const cheapestP   = allPrices[0];
                const reliableP   = highRows.length ? Math.min(...highRows.map(r => r.price_per_hour)) : null;
                const hasGap      = reliableP !== null && reliableP > cheapestP * 1.01;
                return [
                  <tr key={`g-${gpu}`} onClick={() => toggleExpand(gpu)} style={{ cursor: "pointer", borderBottom: "1px solid var(--border)", background: isOpen ? "var(--blue-dim)" : "var(--bg)" }}>
                    <td style={{ ...MONO, padding: "12px 4px 12px 0", fontSize: 8, color: "var(--text-muted)" }}>{isOpen ? "▼" : "▶"}</td>
                    <td style={{ ...SANS, padding: "12px 12px 12px 0", fontWeight: 600, color: "var(--text-primary)", fontSize: 13 }}>{gpu}</td>
                    <td style={{ ...SANS, padding: "12px 12px 12px 0", fontSize: 11.5, color: "var(--text-muted)" }}>
                      {[...provSet].slice(0, 3).join(", ")}{provSet.size > 3 ? ` +${provSet.size - 3}` : ""}
                    </td>
                    {/* Observed floor */}
                    <td style={{ ...MONO, padding: "12px 12px 12px 0", fontSize: 12, color: hasGap ? "var(--text-muted)" : "var(--green)", textAlign: "right" as const }}>
                      <span style={{ ...SANS, fontSize: 9.5, color: "var(--text-muted)", display: "block", marginBottom: 1 }}>OBSERVED</span>
                      {fmtP(cheapestP)}
                    </td>
                    {/* Reliable floor */}
                    <td style={{ ...MONO, padding: "12px 12px 12px 0", fontSize: 12, color: reliableP ? "var(--green)" : "var(--amber)", textAlign: "right" as const }}>
                      <span style={{ ...SANS, fontSize: 9.5, color: reliableP ? "var(--green)" : "var(--amber)", display: "block", marginBottom: 1 }}>RELIABLE</span>
                      {reliableP ? fmtP(reliableP) : "none"}
                    </td>
                    <td colSpan={3} />
                  </tr>,
                  ...(isOpen ? rows.map((l, idx) => {
                    const meta = getMeta(l.provider);
                    return (
                      <tr key={`${gpu}-${idx}`} style={{ borderBottom: "1px solid rgba(20,20,20,0.04)", background: "var(--panel)" }}>
                        <td />
                        <td style={{ ...SANS, padding: "8px 12px 8px 16px", fontSize: 11.5, color: "var(--text-muted)" }}>└ {l.gpu_model}</td>
                        <td style={{ padding: "8px 12px 8px 0" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 2, height: 11, background: meta.color, flexShrink: 0 }} />
                            <span style={{ ...SANS, fontSize: 11.5, color: "var(--text-secondary)" }}>{l.provider}</span>
                          </div>
                        </td>
                        <td style={{ ...MONO, padding: "8px 12px 8px 0", fontSize: 10.5, color: "var(--text-muted)" }}>{l.region || "—"}</td>
                        <td style={{ padding: "8px 12px 8px 0" }}>
                          <span style={{ ...SANS, fontSize: 10, color: "var(--text-muted)", background: "var(--elevated)", border: "1px solid var(--border)", padding: "2px 6px", borderRadius: 2 }}>{l.pricing_type}</span>
                        </td>
                        <td style={{ ...MONO, padding: "8px 12px 8px 0", textAlign: "right" as const, fontWeight: 600, color: "var(--green)", fontSize: 13.5 }}>
                          {fmtP(l.price_per_hour)}
                        </td>
                        <td style={{ padding: "8px 12px 8px 0" }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: availColor(l.availability), display: "inline-block", marginRight: 5 }} />
                          <span style={{ ...SANS, fontSize: 10, color: availColor(l.availability) }}>{l.availability || "—"}</span>
                        </td>
                        <td style={{ padding: "8px 0" }}><FreshnessBadge iso={l.fetched_at} /></td>
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
                    <td style={{ ...SANS, padding: "10px 12px 10px 0", fontWeight: 500, color: "var(--text-primary)", fontSize: 13 }}>{l.gpu_model}</td>
                    <td style={{ padding: "10px 12px 10px 0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 2, height: 12, background: meta.color, flexShrink: 0 }} />
                        <span style={{ ...SANS, fontSize: 11.5, color: "var(--text-secondary)" }}>{l.provider}</span>
                      </div>
                    </td>
                    <td style={{ ...MONO, padding: "10px 12px 10px 0", fontSize: 10.5, color: "var(--text-muted)" }}>{l.region || "—"}</td>
                    <td style={{ padding: "10px 12px 10px 0" }}>
                      <span style={{ ...SANS, fontSize: 10, color: "var(--text-muted)", background: "var(--elevated)", border: "1px solid var(--border)", padding: "2px 6px", borderRadius: 2 }}>{l.pricing_type}</span>
                    </td>
                    <td style={{ ...MONO, padding: "10px 12px 10px 0", textAlign: "right" as const, fontWeight: 600, color: "var(--green)", fontSize: 13.5 }}>{fmtP(l.price_per_hour)}</td>
                    <td style={{ padding: "10px 12px 10px 0" }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: availColor(l.availability), display: "inline-block", marginRight: 5 }} />
                      <span style={{ ...SANS, fontSize: 10, color: availColor(l.availability) }}>{l.availability || "—"}</span>
                    </td>
                    <td style={{ padding: "10px 0" }}><FreshnessBadge iso={l.fetched_at} /></td>
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


// ── Main ──────────────────────────────────────────────────────────────────────

export default function DashboardClient({ summary, listings }: Props) {
  // ── Single-source derived counts ─────────────────────────────────────────────
  const activeProviders = new Set(listings.map(l => l.provider)).size;
  const totalListings   = listings.length;

  const h100Spot   = listings.filter(l => l.gpu_model.includes("H100") && l.pricing_type === "spot");
  const h100High   = listings.filter(l => l.gpu_model.includes("H100") && l.availability === "high");
  const a100Spot   = listings.filter(l => l.gpu_model.includes("A100") && l.pricing_type === "spot");
  const h100Prices = h100Spot.map(l => l.price_per_hour).sort((a, b) => a - b);
  const a100Prices = a100Spot.map(l => l.price_per_hour).sort((a, b) => a - b);

  const cheapestH100High = [...h100High].sort((a, b) => a.price_per_hour - b.price_per_hour)[0];

  // A100 on-demand reliable — fallback when A100 spot is absent
  const a100OnDemandReliable = listings
    .filter(l => l.gpu_model.includes("A100") && l.availability === "high" && l.pricing_type === "on-demand")
    .sort((a, b) => a.price_per_hour - b.price_per_hour)[0] ?? null;

  // Credibility-guarded averages
  const a100Avg = a100Prices.length ? a100Prices.reduce((s, p) => s + p, 0) / a100Prices.length : 0;

  // Hyperscaler premium — H100 preferred, falls back to A100
  const h100Hyper  = listings.filter(l => l.gpu_model.includes("H100") && HYPERSCALERS.includes(l.provider.toLowerCase()));
  const h100Spec   = listings.filter(l => l.gpu_model.includes("H100") && !HYPERSCALERS.includes(l.provider.toLowerCase()));
  const hyperAvg   = h100Hyper.length ? h100Hyper.reduce((s, l) => s + l.price_per_hour, 0) / h100Hyper.length : 0;
  const specAvg    = h100Spec.length  ? h100Spec.reduce((s, l)  => s + l.price_per_hour, 0) / h100Spec.length  : 0;
  const premiumPct = specAvg > 0 && hyperAvg > 0 ? ((hyperAvg / specAvg - 1) * 100) : null;

  // A100 hyperscaler premium (fallback when H100 premium is null)
  const a100Hyper    = listings.filter(l => l.gpu_model.includes("A100") && HYPERSCALERS.includes(l.provider.toLowerCase()));
  const a100Spec     = listings.filter(l => l.gpu_model.includes("A100") && !HYPERSCALERS.includes(l.provider.toLowerCase()));
  const a100HyperAvg = a100Hyper.length ? a100Hyper.reduce((s, l) => s + l.price_per_hour, 0) / a100Hyper.length : 0;
  const a100SpecAvg  = a100Spec.length  ? a100Spec.reduce((s, l)  => s + l.price_per_hour, 0) / a100Spec.length  : 0;
  const a100PremiumPct = a100SpecAvg > 0 && a100HyperAvg > 0 ? ((a100HyperAvg / a100SpecAvg - 1) * 100) : null;

  const highAvailCount = listings.filter(l => l.availability === "high").length;
  const capacityConf   = listings.length > 0 ? Math.round((highAvailCount / listings.length) * 100) : 0;

  const updatedAgo = minsAgo(summary?.last_updated);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text-primary)" }}>
      <style>{`
        .tsort:hover { color: var(--blue) !important; }
        tr:hover td { background: rgba(20,20,20,0.015) !important; }
        select option { background: #fff; color: #171717; }
        input::placeholder { color: var(--text-muted); }
        @media (max-width: 900px) {
          .hero-grid   { grid-template-columns: 1fr !important; gap: 28px !important; }
          .charts-grid { grid-template-columns: 1fr !important; }
          .tiles-grid  { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 540px) {
          .tiles-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <MarketTicker listings={listings} summary={summary} />
      <SiteNav />
      <MarketHero
        listings={listings}
        summary={summary}
        activeProviders={activeProviders}
        cheapestH100High={cheapestH100High}
        h100Prices={h100Prices}
        premiumPct={premiumPct}
        a100PremiumPct={a100PremiumPct}
        capacityConf={capacityConf}
      />

      {/* ── What buyers should do today (signals) ── */}
      <div style={{ background: "var(--panel)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 1360, margin: "0 auto", padding: "36px 32px" }}>
          <div style={{ ...SANS, fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.09em", marginBottom: 20 }}>What buyers should do today</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            {[
              {
                headline: "Cheapest observed H100 is not production-safe by default.",
                body: h100Prices.length && !cheapestH100High
                  ? `There are ${h100Prices.length} H100 listings in the index right now, but none with confirmed high availability. Treat that floor price as experimental capacity, not a production routing target.`
                  : cheapestH100High
                    ? `The cheapest H100 listing (${fmtP(h100Prices[0] ?? cheapestH100High.price_per_hour)}/hr) is observed-only pricing. The cheapest reliable option is ${fmtP(cheapestH100High.price_per_hour)}/hr at ${getMeta(cheapestH100High.provider).short} — a meaningful gap. Don't route production traffic to observed-only listings.`
                    : "H100 data is sparse in this snapshot. Treat any floor price as experimental until availability is confirmed.",
              },
              {
                headline: "A100 may be the more practical market.",
                body: a100OnDemandReliable
                  ? `For evals, batch inference, and fine-tuning, reliable A100 supply at ${fmtP(a100OnDemandReliable.price_per_hour)}/hr at ${getMeta(a100OnDemandReliable.provider).short} can beat chasing the cheapest H100 — especially when the H100 floor is observed-only.`
                  : "For many eval, batch, and fine-tuning workloads, deeper reliable A100 supply can beat chasing the cheapest H100. Check the A100 tab in the explorer.",
              },
              {
                headline: "Capacity confidence changes the price.",
                body: `${capacityConf}% of indexed listings have confirmed high availability. Discount a low headline price when availability is weak or provider concentration is high — the option may not be there when you need it.`,
              },
              {
                headline: "Provider concentration is a risk.",
                body: (() => {
                  const counts: Record<string, number> = {};
                  listings.forEach(l => { counts[l.provider] = (counts[l.provider] || 0) + 1; });
                  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
                  const topPct = top ? Math.round((top[1] / listings.length) * 100) : 0;
                  return top
                    ? `${getMeta(top[0]).short} is ${topPct}% of the current index. ${topPct >= 40 ? "Buyers routing critical workloads through a concentrated index need a fallback provider before they need it — not after." : "Supply is reasonably spread, but always have a fallback routing option before routing critical workloads."}`
                    : "Always have a fallback routing option before routing critical workloads through a single provider.";
                })(),
              },
            ].map(({ headline, body }) => (
              <div key={headline} style={{ borderLeft: "2px solid var(--border-mid)", paddingLeft: 16 }}>
                <div style={{ ...SANS, fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6, lineHeight: 1.35 }}>{headline}</div>
                <div style={{ ...SANS, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.65 }}>{body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Market data as proof ── */}
      <div id="market-data">
      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "40px 32px 0" }}>

        {/* 3 tiles */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ ...SANS, fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.09em", marginBottom: 14 }}>Market index</div>
          <div className="tiles-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            <IndexTile
              label={cheapestH100High ? "Cheapest reliable H100" : h100Prices.length ? "Cheapest observed H100" : "H100"}
              value={cheapestH100High ? fmtP(cheapestH100High.price_per_hour) : h100Prices.length ? fmtP(h100Prices[0]) : "Not in snapshot"}
              note={cheapestH100High
                ? `${getMeta(cheapestH100High.provider).short} · ${h100High.length} reliable ${h100High.length === 1 ? "listing" : "listings"}`
                : h100Prices.length ? `${h100Prices.length} ${h100Prices.length === 1 ? "listing" : "listings"} — observed only`
                : "Not in current snapshot"}
              color={cheapestH100High ? "var(--blue)" : h100Prices.length ? "var(--amber)" : "var(--text-muted)"}
              spark={h100Prices.slice(0, 10)}
              badge={!cheapestH100High && h100Prices.length ? "observed" : !h100Prices.length ? "pending" : undefined}
              footnote={h100Prices.length >= 2 ? `Range ${fmtP(h100Prices[0])} – ${fmtP(h100Prices[h100Prices.length - 1])}` : undefined}
            />
            <IndexTile
              label={a100Avg > 0 ? "A100 spot floor" : a100OnDemandReliable ? "A100 reliable floor" : "A100"}
              value={a100Avg > 0 ? fmtP(a100Prices[0]) : a100OnDemandReliable ? fmtP(a100OnDemandReliable.price_per_hour) : "Not in snapshot"}
              note={a100Avg > 0
                ? `${a100Prices.length} spot ${a100Prices.length === 1 ? "listing" : "listings"} · avg ${fmtP(a100Avg)}`
                : a100OnDemandReliable
                  ? `${getMeta(a100OnDemandReliable.provider).short} · on-demand`
                  : "Not in current snapshot"}
              color={a100Avg > 0 ? "var(--blue)" : a100OnDemandReliable ? "var(--green)" : "var(--text-muted)"}
              spark={a100Prices.length ? a100Prices.slice(0, 10) : undefined}
              badge={a100Prices.length < 3 && !a100OnDemandReliable ? "pending" : undefined}
            />
            <IndexTile
              label="Capacity confidence"
              value={`${capacityConf}%`}
              note={`${highAvailCount.toLocaleString()} of ${listings.length.toLocaleString()} ${listings.length === 1 ? "listing" : "listings"} high-avail.`}
              color={capacityConf >= 60 ? "var(--green)" : "var(--amber)"}
              badge={capacityConf < 60 ? "observed" : undefined}
            />
          </div>
        </div>

        {/* Chart: cheapest vs reliable gap */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ ...SANS, fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.09em", marginBottom: 8 }}>The cheapest price and the cheapest safe price are not the same.</div>
          <div className="charts-grid" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 14 }}>
            <H100SpreadChart listings={listings} />
            <GpuSmallMultiples listings={listings} />
          </div>
        </div>

        {/* Provider Explorer */}
        <div style={{ marginBottom: 44 }}>
          <div style={{ ...SANS, fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.09em", marginBottom: 6 }}>Provider Explorer</div>
          <p style={{ ...SANS, fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 12 }}>The full index — verify the numbers yourself.</p>
          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", padding: "0 20px" }}>
            <ProviderExplorer listings={listings} />
          </div>
        </div>

      </div>
      </div>{/* end #market-data */}

      {/* ── Load Balancer teaser ── */}
      <div style={{ background: "var(--elevated)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 1360, margin: "0 auto", padding: "28px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" as const }}>
          <div>
            <div style={{ ...SANS, fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.09em", marginBottom: 6 }}>Coming next</div>
            <div style={{ ...SERIF, fontSize: 20, fontWeight: 400, color: "var(--text-primary)", marginBottom: 4 }}>Automated routing for flexible workloads.</div>
            <div style={{ ...SANS, fontSize: 13, color: "var(--text-secondary)" }}>Keep production stable. Move evals, batch, and fine-tuning to cheaper reliable capacity automatically.</div>
          </div>
          <Link href="/load-balancer" style={{ ...SANS, fontSize: 13, fontWeight: 600, color: "var(--text-primary)", border: "1px solid var(--border-mid)", padding: "9px 20px", borderRadius: 3, textDecoration: "none", whiteSpace: "nowrap" as const }}>
            Learn about routing beta →
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "32px 32px 80px" }}>

        {/* ── Methodology ── */}
        <div style={{ marginBottom: 28 }}>
          <Rule my={0} />
          <div style={{ padding: "14px 0" }}>
            <p style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.65 }}>
              Prices from public APIs and published rate cards across {activeProviders} providers — updated daily at 00:00 UTC.
              {" "}<strong style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Observed</strong> = listing exists, availability unconfirmed.
              {" "}<strong style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Reliable</strong> = availability === "high" per provider API.
              {" "}Hardcoded rates: gcp, lambda, oci, paperspace, crusoe, fluidstack, ibm, gmi, voltagepark.
            </p>
          </div>
        </div>

        {/* ── Footer ── */}
        <Rule />
        <div style={{ paddingTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: 10 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" as const }}>
            <span style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)" }}>AIInfraWatch · {activeProviders} {activeProviders === 1 ? "provider" : "providers"} · Updated daily</span>
            <Link href="/load-balancer" style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)", textDecoration: "none" }}>Load Balancer beta</Link>
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            {[["API","/api/gpu-prices"],["llms.txt","/llms.txt"],["OpenAPI","/openapi.json"]].map(([l,h]) => (
              <a key={l} href={h} style={{ ...MONO, fontSize: 10.5, color: "var(--text-muted)", textDecoration: "none" }}>{l}</a>
            ))}
            <span style={{ ...MONO, fontSize: 10.5, color: "var(--text-muted)" }}>{updatedAgo}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
