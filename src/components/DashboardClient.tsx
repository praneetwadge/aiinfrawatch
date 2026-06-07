"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import SiteNav from "@/components/SiteNav";

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

// ── Design tokens ─────────────────────────────────────────────────────────────

const MONO: React.CSSProperties  = { fontFamily: "var(--font-mono)" };
const SERIF: React.CSSProperties = { fontFamily: "var(--font-serif)" };
const SANS: React.CSSProperties  = { fontFamily: "var(--font-sans)" };
const BODY: React.CSSProperties  = { fontFamily: "var(--font-body)" };

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
const HYPERSCALERS  = ["aws", "azure", "gcp", "oci", "ibm", "ibm cloud", "google cloud", "oracle cloud"];

// DC GPU matching — word-boundary aware to prevent "A40" matching "RTX A4000"
const DC_GPU_KEYWORDS = ["H100", "H200", "A100", "L40S", "L40", "A10G", "A10", "A30", "A40", "B200", "MI300"];
const isDcGpu = (model: string): boolean => {
  const m = model.toUpperCase();
  return DC_GPU_KEYWORDS.some(k => {
    const idx = m.indexOf(k);
    if (idx === -1) return false;
    // Must NOT be immediately followed by a digit (prevents "A40" matching "A4000")
    const charAfter = m[idx + k.length];
    return !charAfter || !/\d/.test(charAfter);
  });
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const getMeta = (p: string) =>
  PROVIDER_META[p.toLowerCase()] ?? { cat: "Unknown", color: "var(--text-muted)", status: "unknown", short: p };

const fmt  = (n: number, d = 2) => n.toFixed(d);
const fmtP = (n: number) => n < 1 ? `$${n.toFixed(2)}` : n < 10 ? `$${n.toFixed(2)}` : `$${Math.round(n)}`;

const minsAgo = (iso?: string): string => {
  if (!iso) return "—";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
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
    "pending":    { label: "Normalizing",       color: "var(--amber)", bg: "var(--amber-dim)", border: "rgba(183,121,31,0.2)" },
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

// ── Market Ribbon ─────────────────────────────────────────────────────────────

function MarketRibbon({ listings, summary }: { listings: GpuListing[]; summary: MarketSummary | null }) {
  const items = useMemo(() => {
    const h100s = listings.filter(l => l.gpu_model.includes("H100") && l.pricing_type === "spot");
    const a100s = listings.filter(l => l.gpu_model.includes("A100") && l.pricing_type === "spot");
    const cheapestAny = [...listings].sort((a, b) => a.price_per_hour - b.price_per_hour)[0];

    const base = [
      "AI Compute Market  ·  Live",
      ...(cheapestAny ? [`From ${fmtP(cheapestAny.price_per_hour)}/hr · ${getMeta(cheapestAny.provider).short}`] : []),
      ...(h100s.length ? [`H100 from ${fmtP(Math.min(...h100s.map(l => l.price_per_hour)))}/hr`] : ["H100: coverage normalizing"]),
      ...(a100s.length ? [`A100 from ${fmtP(Math.min(...a100s.map(l => l.price_per_hour)))}/hr`] : []),
      `${new Set(listings.map(l => l.provider)).size} providers · ${listings.length.toLocaleString()} listings`,
      ...(summary?.last_updated ? [`Updated ${minsAgo(summary.last_updated)}`] : []),
    ];
    return [...base, ...base];
  }, [listings, summary]);

  return (
    <div style={{
      height: 30, background: "#171717",
      borderBottom: "1px solid rgba(20,20,20,0.15)",
      overflow: "hidden", display: "flex", alignItems: "center",
    }}>
      <div style={{ display: "flex", whiteSpace: "nowrap", animation: "ribbon-scroll 70s linear infinite" }}>
        {items.map((item, i) => (
          <span key={i} style={{
            ...MONO, fontSize: 10.5, color: "rgba(247,243,234,0.55)",
            padding: "0 28px", borderRight: "1px solid rgba(247,243,234,0.1)", letterSpacing: "0.03em",
          }}>{item}</span>
        ))}
      </div>
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

// ── Funnel Banner (above the fold — paid product hook) ────────────────────────

function FunnelBanner({ listings }: { listings: GpuListing[] }) {
  const cheapestHigh = listings.filter(l => l.availability === "high").sort((a, b) => a.price_per_hour - b.price_per_hour)[0];
  const highAvailCount = listings.filter(l => l.availability === "high").length;
  const capacityConf   = listings.length > 0 ? Math.round((highAvailCount / listings.length) * 100) : 0;

  return (
    <div style={{ background: "#171717", borderBottom: "1px solid rgba(247,243,234,0.1)" }}>
      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "36px 32px 32px" }}>
        <div className="funnel-grid" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 52, alignItems: "center" }}>
          <div>
            <p style={{ ...MONO, fontSize: 10, color: "rgba(247,243,234,0.35)", letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 14 }}>
              AI Compute Cost Intelligence
            </p>
            <h2 style={{ ...SERIF, fontSize: 33, fontWeight: 400, lineHeight: 1.15, color: "#F7F3EA", marginBottom: 14 }}>
              Public prices show the market.<br />
              <em>A cost audit shows your decision.</em>
            </h2>
            <p style={{ ...SANS, fontSize: 14, color: "rgba(247,243,234,0.58)", lineHeight: 1.7, maxWidth: 500 }}>
              We track GPU and API prices across every major provider. Enterprise teams use the private cost desk to find out if they're overpaying — and what to do about it.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
            <Link href="/cost-audit" style={{
              display: "block", textAlign: "center" as const,
              ...SANS, fontSize: 13.5, fontWeight: 600,
              color: "#171717", background: "#F7F3EA",
              padding: "13px 24px", borderRadius: 3, textDecoration: "none",
              letterSpacing: "0.01em",
            }}>
              Request cost audit →
            </Link>
            <a href="#market-data" style={{
              display: "block", textAlign: "center" as const,
              ...SANS, fontSize: 13, color: "rgba(247,243,234,0.6)",
              padding: "11px 24px", borderRadius: 3, textDecoration: "none",
              border: "1px solid rgba(247,243,234,0.15)",
            }}>
              Explore market data ↓
            </a>
            {cheapestHigh && (
              <div style={{ padding: "10px 14px", background: "rgba(247,243,234,0.05)", border: "1px solid rgba(247,243,234,0.1)", borderRadius: 3 }}>
                <div style={{ ...MONO, fontSize: 9.5, color: "rgba(247,243,234,0.3)", letterSpacing: "0.09em", marginBottom: 4 }}>RELIABLE CAPACITY NOW</div>
                <div style={{ ...MONO, fontSize: 15, fontWeight: 500, color: "#F7F3EA" }}>
                  {fmtP(cheapestHigh.price_per_hour)}<span style={{ fontSize: 11, color: "rgba(247,243,234,0.38)" }}>/hr</span>
                </div>
                <div style={{ ...SANS, fontSize: 11, color: "rgba(247,243,234,0.4)", marginTop: 2 }}>
                  {getMeta(cheapestHigh.provider).short} · {cheapestHigh.gpu_model}
                </div>
              </div>
            )}
            <div style={{ ...SANS, fontSize: 11, color: "rgba(247,243,234,0.3)", textAlign: "center" as const }}>
              {capacityConf}% of {listings.length.toLocaleString()} indexed listings high-availability
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Market Brief ──────────────────────────────────────────────────────────────

function MarketBrief({ listings, summary }: { listings: GpuListing[]; summary: MarketSummary | null }) {
  const cheapestAny  = [...listings].sort((a, b) => a.price_per_hour - b.price_per_hour)[0];
  const cheapestHigh = listings.filter(l => l.availability === "high").sort((a, b) => a.price_per_hour - b.price_per_hour)[0];

  const h100All  = listings.filter(l => l.gpu_model.includes("H100"));
  const h100High = h100All.filter(l => l.availability === "high");
  const cheapestH100High = [...h100High].sort((a, b) => a.price_per_hour - b.price_per_hour)[0];

  const counts: Record<string, number> = {};
  listings.forEach(l => { counts[l.provider] = (counts[l.provider] || 0) + 1; });
  const topProvider = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const topPct = topProvider ? Math.round((topProvider[1] / listings.length) * 100) : 0;

  const highAvailCount = listings.filter(l => l.availability === "high").length;
  const capacityConf = listings.length > 0 ? Math.round((highAvailCount / listings.length) * 100) : 0;

  const briefItems = [
    cheapestAny && {
      label: "Cheapest observed",
      value: `${fmtP(cheapestAny.price_per_hour)}/hr`,
      sub: `${getMeta(cheapestAny.provider).short} · ${cheapestAny.gpu_model}`,
      badge: "observed" as ConfidenceLevel,
      color: "var(--text-secondary)",
    },
    cheapestHigh && {
      label: "Cheapest high-availability",
      value: `${fmtP(cheapestHigh.price_per_hour)}/hr`,
      sub: `${getMeta(cheapestHigh.provider).short} · ${cheapestHigh.gpu_model}`,
      badge: "high-avail" as ConfidenceLevel,
      color: "var(--green)",
    },
    cheapestH100High ? {
      label: "H100 reliable from",
      value: `${fmtP(cheapestH100High.price_per_hour)}/hr`,
      sub: `${getMeta(cheapestH100High.provider).short} · high avail.`,
      badge: "high-avail" as ConfidenceLevel,
      color: "var(--blue)",
    } : {
      label: "H100 coverage",
      value: h100All.length > 0 ? `${h100All.length} listings` : "Normalizing",
      sub: h100All.length > 0 ? "Reliability data pending" : "Not yet normalized",
      badge: "pending" as ConfidenceLevel,
      color: "var(--amber)",
    },
    topProvider && {
      label: "Supply concentration",
      value: `${topPct}%`,
      sub: `${getMeta(topProvider[0]).short} of ${listings.length.toLocaleString()} listings`,
      badge: topPct >= 40 ? "observed" as ConfidenceLevel : "reliable" as ConfidenceLevel,
      color: topPct >= 40 ? "var(--amber)" : "var(--text-secondary)",
    },
    {
      label: "Capacity confidence",
      value: `${capacityConf}%`,
      sub: `${highAvailCount.toLocaleString()} of ${listings.length.toLocaleString()} high avail.`,
      badge: capacityConf >= 60 ? "high-avail" as ConfidenceLevel : "observed" as ConfidenceLevel,
      color: capacityConf >= 60 ? "var(--green)" : "var(--text-secondary)",
    },
  ].filter(Boolean) as { label: string; value: string; sub: string; badge: ConfidenceLevel; color: string }[];

  return (
    <div style={{ background: "var(--panel)", borderBottom: "2px solid var(--border)" }}>
      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "48px 32px 40px" }}>
        <div className="brief-grid" style={{ display: "grid", gridTemplateColumns: "1fr 316px", gap: 60, alignItems: "start" }}>

          {/* Left */}
          <div>
            <p style={{ ...SANS, fontSize: 10.5, color: "var(--text-muted)", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: 14, fontWeight: 500 }}>
              AI Infrastructure · Market Intelligence
            </p>
            <h1 style={{ ...SERIF, fontSize: 40, fontWeight: 400, lineHeight: 1.12, color: "var(--text-primary)", marginBottom: 18 }}>
              Know the real price of compute<br />
              <em>— before you sign.</em>
            </h1>
            <p style={{ ...BODY, fontSize: 15.5, color: "var(--text-secondary)", lineHeight: 1.72, maxWidth: 540, fontWeight: 300 }}>
              Spot prices, hyperscaler premiums, and capacity signals across {ALL_PROVIDERS.filter(p => p.status === "live").length} providers — so you can see what a quote hides before you commit.
            </p>
            <p style={{ ...SANS, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, maxWidth: 500, marginTop: 14, borderLeft: "2px solid var(--border-mid)", paddingLeft: 12 }}>
              Low posted prices are useful only when capacity is available and reliable. This index surfaces both.
            </p>
          </div>

          {/* Right: brief card */}
          <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderTop: "3px solid var(--text-primary)" }}>
            <div style={{ padding: "11px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ ...SANS, fontSize: 11, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "0.03em" }}>Today's Market Brief</span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", display: "inline-block", animation: "pulse-live 2.5s ease-in-out infinite" }} />
                <span style={{ ...MONO, fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em" }}>LIVE</span>
              </span>
            </div>
            {briefItems.map((b, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                padding: "10px 16px",
                borderBottom: i < briefItems.length - 1 ? "1px solid var(--border)" : "none",
                gap: 10,
              }}>
                <div>
                  <div style={{ ...SANS, fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>{b.label}</div>
                  <ConfidenceBadge level={b.badge} />
                </div>
                <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
                  <div style={{ ...MONO, fontSize: 13.5, fontWeight: 500, color: b.color }}>{b.value}</div>
                  <div style={{ ...SANS, fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>{b.sub}</div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}

// ── What We Know Right Now strip ──────────────────────────────────────────────

function WhatWeKnow({ listings }: { listings: GpuListing[] }) {
  const h100All = listings.filter(l => l.gpu_model.includes("H100"));
  const cheapestH100 = [...h100All].sort((a, b) => a.price_per_hour - b.price_per_hour)[0];
  const cheapestH100High = listings.filter(l => l.gpu_model.includes("H100") && l.availability === "high").sort((a, b) => a.price_per_hour - b.price_per_hour)[0];

  const counts: Record<string, number> = {};
  listings.forEach(l => { counts[l.provider] = (counts[l.provider] || 0) + 1; });
  const topEntry = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const topMeta  = topEntry ? getMeta(topEntry[0]) : null;
  const topPct   = topEntry ? Math.round((topEntry[1] / listings.length) * 100) : 0;

  const hyperListings    = listings.filter(l => HYPERSCALERS.includes(l.provider.toLowerCase()));
  const nonHyperListings = listings.filter(l => !HYPERSCALERS.includes(l.provider.toLowerCase()));
  const hyperCheapest    = [...hyperListings].sort((a, b) => a.price_per_hour - b.price_per_hour)[0];
  const nonHyperCheapest = [...nonHyperListings].sort((a, b) => a.price_per_hour - b.price_per_hour)[0];

  const facts = [
    topMeta && {
      label: "Supply leader",
      text: `${topMeta.short} holds ${topPct}% of indexed listings (${topEntry[1].toLocaleString()} active) — ${topMeta.cat === "Marketplace" ? "marketplace" : topMeta.cat.toLowerCase()} GPU supply.`,
      color: "var(--blue)",
    },
    nonHyperCheapest && hyperCheapest && {
      label: "Where prices are lower",
      text: `Cheapest listings are marketplace and neocloud — not hyperscaler. ${getMeta(nonHyperCheapest.provider).short} ${nonHyperCheapest.gpu_model} from ${fmtP(nonHyperCheapest.price_per_hour)}/hr vs ${getMeta(hyperCheapest.provider).short} from ${fmtP(hyperCheapest.price_per_hour)}/hr.`,
      color: "var(--green)",
    },
    {
      label: h100All.length > 0 ? "H100 coverage" : "H100 status",
      text: h100All.length > 0
        ? `${h100All.length} H100 listings across ${new Set(h100All.map(l => l.provider)).size} providers.${cheapestH100High ? ` Reliable from ${fmtP(cheapestH100High.price_per_hour)}/hr (${getMeta(cheapestH100High.provider).short}, high avail.).` : " Reliability-verified listings are limited."} Hyperscaler normalization varies — treat published rates as indicative.`
        : "H100 data not yet available in this query window. Coverage is being normalized across providers.",
      color: "var(--amber)",
    },
  ].filter(Boolean) as { label: string; text: string; color: string }[];

  return (
    <div style={{ borderTop: "1px solid var(--border)", borderBottom: "2px solid var(--border)", background: "var(--elevated)" }}>
      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "20px 32px" }}>
        <div className="facts-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32 }}>
          {facts.map((f, i) => (
            <div key={i}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
                <div style={{ width: 3, height: 13, background: f.color, flexShrink: 0 }} />
                <span style={{ ...SANS, fontSize: 10.5, fontWeight: 600, color: f.color, textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>{f.label}</span>
              </div>
              <p style={{ ...SANS, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.65, margin: 0 }}>{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Private Cost Desk ─────────────────────────────────────────────────────────

function CostDesk({ listings }: { listings: GpuListing[] }) {
  const [gpu, setGpu]     = useState("H100");
  const [hours, setHours] = useState(720);

  const recs = useMemo(() => {
    const ls = listings.filter(l => l.gpu_model.includes(gpu));
    if (!ls.length) return [];
    const sorted   = [...ls].sort((a, b) => a.price_per_hour - b.price_per_hour);
    const reliable = ls.filter(l => l.availability === "high").sort((a, b) => a.price_per_hour - b.price_per_hour);
    const hyper    = ls.filter(l => HYPERSCALERS.includes(l.provider.toLowerCase())).sort((a, b) => a.price_per_hour - b.price_per_hour);
    return [
      sorted[0]             && { label: "Cheapest available",   listing: sorted[0],   color: "var(--blue)" },
      (reliable[0] ?? null) && { label: "Highest reliability",  listing: reliable[0], color: "var(--green)" },
      (hyper[0] ?? null)    && { label: "Hyperscaler baseline", listing: hyper[0],    color: "var(--amber)" },
    ].filter(r => r && r.listing) as { label: string; listing: GpuListing; color: string }[];
  }, [listings, gpu]);

  const cheapest    = recs[0]?.listing;
  const hyperscaler = recs.find(r => r.label === "Hyperscaler baseline")?.listing;
  const savings     = cheapest && hyperscaler && hyperscaler.price_per_hour > cheapest.price_per_hour
    ? Math.round((1 - cheapest.price_per_hour / hyperscaler.price_per_hour) * 100) : null;

  return (
    <div style={{ background: "var(--panel)", border: "1px solid rgba(183,121,31,0.3)", borderTop: "3px solid var(--amber)", boxShadow: "var(--shadow-md)" }}>
      <div style={{ padding: "22px 28px 20px", borderBottom: "1px solid var(--border)", display: "flex", gap: 28, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: "var(--amber)", textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 7 }}>Private Cost Desk</div>
          <h3 style={{ ...SERIF, fontSize: 22, fontWeight: 400, color: "var(--text-primary)", lineHeight: 1.2, marginBottom: 6 }}>
            Run your workload through the market.
          </h3>
          <p style={{ ...SANS, fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.65, maxWidth: 540 }}>
            Public prices show the surface. A private estimate accounts for GPU mix, utilization, region, reliability, API usage, contract terms, and migration risk.
          </p>
        </div>
        {/* Redacted sample card */}
        <div style={{ flexShrink: 0, width: 174, border: "1px solid var(--border)", background: "var(--bg)", padding: "12px 14px", position: "relative" as const, overflow: "hidden" }}>
          <div style={{ ...SANS, fontSize: 8.5, fontWeight: 600, color: "var(--amber)", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 7 }}>Sample Estimate</div>
          <div style={{ filter: "blur(3.5px)", pointerEvents: "none" }}>
            {[["8×H100 · 3 weeks","$214k/mo"],["Optimized mix","$128k/mo"],["Savings","−40%"],["Concentration risk","HIGH"]].map(([l,v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ ...SANS, fontSize: 9.5, color: "var(--text-muted)" }}>{l}</span>
                <span style={{ ...MONO, fontSize: 9.5, fontWeight: 600, color: "var(--text-primary)" }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ position: "absolute" as const, inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(247,243,234,0.45)" }}>
            <span style={{ ...SANS, fontSize: 10.5, fontWeight: 600, color: "var(--amber)", letterSpacing: "0.04em" }}>Private</span>
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 28px 20px" }}>
        {/* GPU selector + hours */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginBottom: 14, alignItems: "center" }}>
          {["H100", "A100", "L40S", "A10G"].map(g => (
            <button key={g} onClick={() => setGpu(g)} style={{
              ...MONO, fontSize: 12, padding: "5px 13px",
              border: `1px solid ${gpu === g ? "var(--amber)" : "var(--border-mid)"}`,
              background: gpu === g ? "var(--amber-dim)" : "var(--panel)",
              color: gpu === g ? "var(--amber)" : "var(--text-secondary)",
              borderRadius: 3, fontWeight: gpu === g ? 500 : 400,
            }}>{g}</button>
          ))}
          <div style={{ width: 1, height: 16, background: "var(--border)" }} />
          <label style={{ display: "flex", alignItems: "center", gap: 6, ...SANS, fontSize: 12, color: "var(--text-secondary)" }}>
            hrs/mo:
            <input type="number" value={hours} onChange={e => setHours(Number(e.target.value))} min={1} max={8760}
              style={{ ...MONO, width: 66, background: "var(--panel)", border: "1px solid var(--border-mid)", color: "var(--text-primary)", padding: "4px 8px", fontSize: 12.5, borderRadius: 3, outline: "none" }}
            />
          </label>
          {savings !== null && (
            <span style={{ ...SANS, fontSize: 11, color: "var(--green)", background: "var(--green-dim)", border: "1px solid rgba(8,127,91,0.2)", padding: "3px 9px", borderRadius: 3, fontWeight: 500 }}>
              Up to {savings}% vs hyperscaler
            </span>
          )}
        </div>

        {/* Results row */}
        {recs.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))", gap: 10, marginBottom: 16 }}>
            {recs.map(r => (
              <div key={r.label} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderTop: `3px solid ${r.color}`, padding: "14px 16px" }}>
                <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: r.color, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 7 }}>{r.label}</div>
                <div style={{ ...MONO, fontSize: 24, fontWeight: 500, color: r.color, letterSpacing: "-0.025em", lineHeight: 1 }}>
                  {fmtP(r.listing.price_per_hour)}<span style={{ fontSize: 11, fontWeight: 300, color: "var(--text-muted)" }}>/hr</span>
                </div>
                <div style={{ ...SANS, fontSize: 11.5, color: "var(--text-secondary)", margin: "6px 0 2px", fontWeight: 500 }}>{getMeta(r.listing.provider).short}</div>
                <div style={{ ...SANS, fontSize: 10.5, color: "var(--text-muted)" }}>{r.listing.gpu_model}</div>
                <Rule my={9} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ ...SANS, fontSize: 10.5, color: "var(--text-muted)" }}>{hours}h est.</span>
                  <span style={{ ...MONO, fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                    ${(r.listing.price_per_hour * hours).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ ...SANS, fontSize: 13, color: "var(--text-muted)", padding: "12px 0 16px" }}>
            No {gpu} listings in the current window. Coverage expanding — check back shortly.
          </div>
        )}

        {/* CTA */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
          <div style={{ ...SANS, fontSize: 12.5, color: "#fff", fontWeight: 600, background: "var(--amber)", padding: "8px 20px", letterSpacing: "0.01em", cursor: "pointer", borderRadius: 2 }}>
            Request private estimate
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            {["Cloud bill", "Architecture diagram", "Workload description"].map(inp => (
              <span key={inp} style={{ ...SANS, fontSize: 11, color: "var(--text-muted)", background: "var(--elevated)", padding: "3px 8px", borderRadius: 2, border: "1px solid var(--border)" }}>{inp}</span>
            ))}
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
  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", padding: "18px 20px", display: "flex", flexDirection: "column" as const, gap: 5, borderTop: `3px solid ${color}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, minHeight: 18 }}>
        <div style={{ ...SANS, fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.07em", fontWeight: 600 }}>{label}</div>
        {badge && <ConfidenceBadge level={badge} />}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div style={{ ...MONO, fontSize: 26, fontWeight: 500, color, lineHeight: 1.05, letterSpacing: "-0.02em" }}>{value}</div>
          {note && <div style={{ ...SANS, fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{note}</div>}
        </div>
        {spark && spark.length >= 2 && <Sparkline values={spark} color={color} width={56} height={24} />}
      </div>
      {footnote && <><Rule my={5} /><div style={{ ...SANS, fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.5 }}>{footnote}</div></>}
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
    const ls     = listings.filter(l => l.gpu_model.includes(family));
    if (!ls.length) return null;
    const prices = ls.map(l => l.price_per_hour).sort((a, b) => a - b);
    const highLs = ls.filter(l => l.availability === "high");
    return {
      family, count: ls.length,
      min: prices[0], max: prices[prices.length - 1],
      avg: prices.reduce((s, p) => s + p, 0) / prices.length,
      minReliable: highLs.length ? Math.min(...highLs.map(l => l.price_per_hour)) : null,
      spark: prices.slice(0, 9),
    };
  }).filter(Boolean) as { family: string; count: number; min: number; max: number; avg: number; minReliable: number | null; spark: number[] }[];

  if (!cards.length) return <div style={{ ...SANS, fontSize: 12, color: "var(--text-muted)", padding: "20px 0" }}>No DC GPU data.</div>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
      {cards.map(c => (
        <div key={c.family} style={{ background: "var(--panel)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
            <span style={{ ...MONO, fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{c.family}</span>
            <span style={{ ...SANS, fontSize: 10, color: "var(--text-muted)" }}>{c.count} listings</span>
          </div>
          <div style={{ ...MONO, fontSize: 22, fontWeight: 500, color: "var(--blue)", letterSpacing: "-0.025em", lineHeight: 1 }}>
            {fmtP(c.min)}
          </div>
          <div style={{ ...SANS, fontSize: 10.5, color: "var(--text-muted)", margin: "3px 0 8px" }}>from /hr · avg {fmtP(c.avg)}</div>
          {c.minReliable !== null && (
            <div style={{ ...SANS, fontSize: 10.5, color: "var(--green)", marginBottom: 8 }}>Reliable from {fmtP(c.minReliable)}/hr</div>
          )}
          <Rule />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 7 }}>
            <div style={{ ...SANS, fontSize: 10, color: "var(--text-muted)" }}>max {fmtP(c.max)}</div>
            <Sparkline values={c.spark} color="var(--blue)" width={48} height={18} />
          </div>
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
  const [gpuFamily,   setGpuFamily]   = useState("H100");
  const [search,      setSearch]      = useState("");
  const [catFilter,   setCatFilter]   = useState("all");
  const [typeFilter,  setTypeFilter]  = useState("all");
  const [availFilter, setAvailFilter] = useState("all");
  const [sortKey,     setSortKey]     = useState<"price" | "gpu" | "provider">("price");
  const [sortDir,     setSortDir]     = useState<"asc" | "desc">("asc");
  const [expanded,    setExpanded]    = useState<Set<string>>(new Set());
  const [grouped,     setGrouped]     = useState(true);

  // Default to H100; if no H100 listings exist, fall back to "All"
  const hasH100 = useMemo(() => listings.some(l => l.gpu_model.includes("H100")), [listings]);
  const effectiveFamily = gpuFamily === "H100" && !hasH100 ? "All" : gpuFamily;

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
                const isOpen     = expanded.has(gpu);
                const cheapestP  = Math.min(...rows.map(r => r.price_per_hour));
                const provSet    = new Set(rows.map(r => r.provider));
                const highCount  = rows.filter(r => r.availability === "high").length;
                return [
                  <tr key={`g-${gpu}`} onClick={() => toggleExpand(gpu)} style={{ cursor: "pointer", borderBottom: "1px solid var(--border)", background: isOpen ? "var(--blue-dim)" : "var(--bg)" }}>
                    <td style={{ ...MONO, padding: "12px 4px 12px 0", fontSize: 8, color: "var(--text-muted)" }}>{isOpen ? "▼" : "▶"}</td>
                    <td style={{ ...SANS, padding: "12px 12px 12px 0", fontWeight: 600, color: "var(--text-primary)", fontSize: 13 }}>{gpu}</td>
                    <td style={{ ...SANS, padding: "12px 12px 12px 0", fontSize: 11.5, color: "var(--text-muted)" }}>
                      {[...provSet].slice(0, 3).join(", ")}{provSet.size > 3 ? ` +${provSet.size - 3}` : ""}
                    </td>
                    <td style={{ ...SANS, padding: "12px 12px 12px 0", fontSize: 11, color: "var(--text-muted)" }}>
                      {rows.length} listings · {provSet.size} providers
                    </td>
                    <td>
                      {highCount > 0 && <ConfidenceBadge level="high-avail" />}
                    </td>
                    <td style={{ ...MONO, padding: "12px 12px 12px 0", textAlign: "right" as const, fontWeight: 600, color: "var(--green)", fontSize: 14 }}>
                      from {fmtP(cheapestP)}
                    </td>
                    <td colSpan={2} />
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

      <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
        <p style={{ ...SANS, fontSize: 11, color: "var(--text-muted)" }}>
          Prices sourced from public APIs and published rate cards. Normalization varies by provider — treat as indicative. Hardcoded rates are noted per-provider in methodology.
        </p>
      </div>
    </div>
  );
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 16, paddingBottom: 10, borderBottom: "2px solid var(--text-primary)" }}>
      <h2 style={{ ...SANS, fontSize: 17, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.015em", lineHeight: 1.2 }}>{title}</h2>
      {sub && <p style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)", marginTop: 3 }}>{sub}</p>}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DashboardClient({ summary, listings }: Props) {
  const h100Spot   = listings.filter(l => l.gpu_model.includes("H100") && l.pricing_type === "spot");
  const h100High   = listings.filter(l => l.gpu_model.includes("H100") && l.availability === "high");
  const a100Spot   = listings.filter(l => l.gpu_model.includes("A100") && l.pricing_type === "spot");
  const h100Prices = h100Spot.map(l => l.price_per_hour).sort((a, b) => a - b);
  const a100Prices = a100Spot.map(l => l.price_per_hour).sort((a, b) => a - b);

  const cheapestH100High = [...h100High].sort((a, b) => a.price_per_hour - b.price_per_hour)[0];
  const cheapestAny      = [...listings].sort((a, b) => a.price_per_hour - b.price_per_hour)[0];

  // Credibility-guarded averages
  const h100Avg = h100Prices.length ? h100Prices.reduce((s, p) => s + p, 0) / h100Prices.length : 0;
  const a100Avg = a100Prices.length ? a100Prices.reduce((s, p) => s + p, 0) / a100Prices.length : 0;

  // Hyperscaler premium (A100 or H100, whichever has data from both sides)
  const h100Hyper  = listings.filter(l => l.gpu_model.includes("H100") && HYPERSCALERS.includes(l.provider.toLowerCase()));
  const h100Spec   = listings.filter(l => l.gpu_model.includes("H100") && !HYPERSCALERS.includes(l.provider.toLowerCase()));
  const hyperAvg   = h100Hyper.length ? h100Hyper.reduce((s, l) => s + l.price_per_hour, 0) / h100Hyper.length : 0;
  const specAvg    = h100Spec.length  ? h100Spec.reduce((s, l)  => s + l.price_per_hour, 0) / h100Spec.length  : 0;
  const premiumPct = specAvg > 0 && hyperAvg > 0 ? ((hyperAvg / specAvg - 1) * 100) : null;

  const highAvailCount = listings.filter(l => l.availability === "high").length;
  const capacityConf   = listings.length > 0 ? Math.round((highAvailCount / listings.length) * 100) : 0;

  const updatedAgo = minsAgo(summary?.last_updated);

  const signals = useMemo(() => {
    if (!listings.length) return [];
    const counts: Record<string, number> = {};
    listings.forEach(l => { counts[l.provider] = (counts[l.provider] || 0) + 1; });
    const top    = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const topPct = top ? Math.round((top[1] / listings.length) * 100) : 0;
    const partialPs = ALL_PROVIDERS.filter(p => p.status === "partial");

    return [
      top && {
        headline: "Supply concentration",
        body: `${getMeta(top[0]).short} accounts for ${topPct}% of the current index (${top[1].toLocaleString()} listings). Single-provider dependency is a risk signal for production workloads.`,
        type: topPct >= 40 ? "warn" as const : "info" as const,
      },
      h100Prices.length >= 2 && {
        headline: "H100 spread",
        body: `Spot prices range ${fmtP(h100Prices[0])} – ${fmtP(h100Prices[h100Prices.length - 1])}/hr across ${new Set(h100Spot.map(l => l.provider)).size} providers.`,
        sub: `${h100Prices.length} spot listings · ${h100High.length} high availability`,
        type: "warn" as const,
      },
      highAvailCount > 0 && {
        headline: "Reliable capacity",
        body: `${highAvailCount.toLocaleString()} of ${listings.length.toLocaleString()} listings (${capacityConf}%) report confirmed high availability — suitable for production workloads.`,
        type: "success" as const,
      },
      partialPs.length > 0 && {
        headline: "Partial coverage",
        body: `${partialPs.map(p => p.name).join(", ")} — normalization in progress. Pricing may be incomplete or delayed.`,
        type: "neutral" as const,
      },
    ].filter(Boolean) as { headline: string; body: string; sub?: string; type: "info" | "warn" | "success" | "neutral" }[];
  }, [listings, h100Prices, h100High, h100Spot, highAvailCount, capacityConf]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text-primary)" }}>
      <style>{`
        .tsort:hover { color: var(--blue) !important; }
        tr:hover td { background: rgba(20,20,20,0.015) !important; }
        select option { background: #fff; color: #171717; }
        input::placeholder { color: var(--text-muted); }
        @media (max-width: 900px) {
          .brief-grid  { grid-template-columns: 1fr !important; gap: 28px !important; }
          .charts-grid { grid-template-columns: 1fr !important; }
          .tiles-grid  { grid-template-columns: repeat(2, 1fr) !important; }
          .facts-grid  { grid-template-columns: 1fr !important; gap: 20px !important; }
          .funnel-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
        }
        @media (max-width: 540px) {
          .tiles-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <MarketRibbon listings={listings} summary={summary} />
      <SiteNav />
      <FunnelBanner listings={listings} />
      <div id="market-data">
      <MarketBrief listings={listings} summary={summary} />
      <WhatWeKnow listings={listings} />

      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "40px 32px 80px" }}>

        {/* ── Cost Desk (high placement) ── */}
        <div style={{ marginBottom: 44 }}>
          <CostDesk listings={listings} />
        </div>

        {/* ── Market Index ── */}
        <div style={{ marginBottom: 44 }}>
          <SectionHead title="Market Index" sub="Decision-relevant benchmarks — credibility-guarded" />
          <div className="tiles-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
            <IndexTile
              label="Cheapest any GPU"
              value={cheapestAny ? fmtP(cheapestAny.price_per_hour) : "—"}
              note={cheapestAny ? `${getMeta(cheapestAny.provider).short} · ${cheapestAny.gpu_model}` : "no data"}
              color="var(--text-secondary)"
              badge="observed"
            />
            <IndexTile
              label="Cheapest reliable H100"
              value={cheapestH100High ? fmtP(cheapestH100High.price_per_hour) : h100Prices.length ? fmtP(h100Prices[0]) : "—"}
              note={cheapestH100High ? `${getMeta(cheapestH100High.provider).short} · high avail.` : h100Prices.length ? "medium avail. only" : "H100 data pending"}
              color={cheapestH100High ? "var(--blue)" : "var(--amber)"}
              spark={h100Prices.slice(0, 10)}
              badge={cheapestH100High ? "high-avail" : h100Prices.length ? "observed" : "pending"}
              footnote={h100Prices.length >= 2 ? `Range ${fmtP(h100Prices[0])} – ${fmtP(h100Prices[h100Prices.length - 1])}` : undefined}
            />
            <IndexTile
              label="Hyperscaler premium"
              value={premiumPct !== null ? `+${premiumPct.toFixed(0)}%` : "—"}
              note="H100 vs. specialist clouds"
              color={premiumPct !== null ? "var(--amber)" : "var(--text-muted)"}
              badge={premiumPct !== null ? "observed" : "pending"}
              footnote={premiumPct !== null ? `${(hyperAvg / specAvg).toFixed(1)}× on avg.` : "Needs data from both sides"}
            />
            <IndexTile
              label="Capacity confidence"
              value={`${capacityConf}%`}
              note={`${highAvailCount.toLocaleString()} of ${listings.length.toLocaleString()} high avail.`}
              color={capacityConf >= 60 ? "var(--green)" : "var(--amber)"}
              badge={capacityConf >= 60 ? "high-avail" : "observed"}
              footnote="Share of listings with confirmed availability"
            />
            <IndexTile
              label="A100 spot avg."
              value={a100Avg > 0 ? fmtP(a100Avg) : "—"}
              note={a100Prices.length > 0 ? `${a100Prices.length} spot listings` : "no A100 spot data"}
              color={a100Avg > 0 ? "var(--blue)" : "var(--text-muted)"}
              spark={a100Prices.slice(0, 10)}
              badge={a100Prices.length >= 3 ? "observed" : "pending"}
              footnote={a100Prices.length >= 2 ? `${fmtP(a100Prices[0])} – ${fmtP(a100Prices[a100Prices.length - 1])}` : undefined}
            />
          </div>
        </div>

        {/* ── Price Analysis ── */}
        <div style={{ marginBottom: 44 }}>
          <SectionHead title="Price Analysis" sub="What the headline price hides — spreads, premiums, and family comparisons" />
          <div className="charts-grid" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 14, marginBottom: 14 }}>
            <H100SpreadChart listings={listings} />
            <GpuSmallMultiples listings={listings} />
          </div>
          <PriceByFamily listings={listings} />
        </div>

        {/* ── Market Signals ── */}
        {signals.length > 0 && (
          <div style={{ marginBottom: 44 }}>
            <SectionHead title="Market Signals" sub="Automated analysis of supply, pricing, and data quality" />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const }}>
              {signals.map((s, i) => <SignalCard key={i} {...s} />)}
            </div>
          </div>
        )}

        {/* ── Provider Explorer ── */}
        <div style={{ marginBottom: 44 }}>
          <SectionHead title="Provider Explorer" sub="All indexed GPU listings — filter, sort, compare" />
          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", padding: "0 20px" }}>
            <ProviderExplorer listings={listings} />
          </div>
        </div>

        {/* ── Methodology ── */}
        <div style={{ marginBottom: 28 }}>
          <Rule my={0} />
          <div style={{ padding: "18px 0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 24 }}>
            {[
              { title: "Coverage", text: `${ALL_PROVIDERS.filter(p => p.status === "live").length} providers live · ${ALL_PROVIDERS.filter(p => p.status === "partial").length} partial · ${listings.length.toLocaleString()} listings in the current 25-hour window.` },
              { title: "Methodology", text: "Prices from public APIs and published rate cards. Hardcoded where live APIs are unavailable or too large for serverless. Normalization varies by provider." },
              { title: "Freshness", text: `Last ingestion: ${updatedAgo}. Runs daily via Vercel cron. Freshness badges flag listings older than 25 hours.` },
            ].map(s => (
              <div key={s.title}>
                <div style={{ ...SANS, fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 5 }}>{s.title}</div>
                <div style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.65 }}>{s.text}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer ── */}
        <Rule />
        <div style={{ paddingTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: 10 }}>
          <div style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)" }}>AIInfraWatch · Prices are indicative only.</div>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            {[["API","/api/gpu-prices"],["llms.txt","/llms.txt"],["OpenAPI","/openapi.json"]].map(([l,h]) => (
              <a key={l} href={h} style={{ ...MONO, fontSize: 10.5, color: "var(--text-muted)", textDecoration: "none" }}>{l}</a>
            ))}
            <span style={{ ...MONO, fontSize: 10.5, color: "var(--text-muted)" }}>{updatedAgo}</span>
          </div>
        </div>
      </div>
      </div>{/* end #market-data */}
    </div>
  );
}
