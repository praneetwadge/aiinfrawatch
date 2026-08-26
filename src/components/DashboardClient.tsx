"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import MarketTicker from "@/components/MarketTicker";
import AuditTool from "@/components/AuditTool";
import {
  GpuListing, HYPERSCALERS, PROVIDER_META,
  getMeta, fmtP, fmtMoney, minsAgo,
} from "@/lib/market-helpers";
import { computeMarketStats } from "@/lib/market-stats";

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

const Rule = ({ my = 0 }: { my?: number }) => (
  <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: `${my}px 0` }} />
);

// ── Market Hero ───────────────────────────────────────────────────────────────

interface MarketHeroProps {
  listings: GpuListing[];
  summary: MarketSummary | null;
  activeProviders: number;
  cheapestH100High: GpuListing | undefined;
  h100Prices: number[];
  premiumPct: number | null;
  a100PremiumPct: number | null;
}

function MarketHero({ listings, summary, activeProviders, cheapestH100High, h100Prices, premiumPct, a100PremiumPct }: MarketHeroProps) {
  const effectivePremium = (premiumPct !== null && premiumPct > 0) ? premiumPct
    : (a100PremiumPct !== null && a100PremiumPct > 0) ? a100PremiumPct
    : null;
  const premiumIsH100 = premiumPct !== null && premiumPct > 0;

  // H100 stat (stat 1)
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
      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "56px 32px 48px" }}>

        <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 460px", gap: 64, alignItems: "start" }}>
          {/* Left: headline + CTAs */}
          <div>
            <div style={{ ...MONO, fontSize: 10, color: "var(--blue)", letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 16 }}>
              Market Data
            </div>
            <h1 style={{ ...SERIF, fontSize: 52, fontWeight: 400, lineHeight: 1.08, color: "var(--text-primary)", marginBottom: 20, maxWidth: 640 }}>
              AI compute costs, from silicon to megawatt.
            </h1>
            <p style={{ ...SANS, fontSize: 17, color: "var(--text-secondary)", lineHeight: 1.65, maxWidth: 520, marginBottom: 26 }}>
              GPU price intelligence across {activeProviders} providers, mapped to the regional energy costs that set the real floor. See what your stack should actually cost.
            </p>
            <p style={{ ...SANS, fontSize: 12.5, color: "var(--text-muted)", marginTop: 14, lineHeight: 1.5 }}>
              Most stacks overpay by 20–40%. Paste a bill or describe your setup to find out exactly.
            </p>
          </div>


          {/* Right: market state strip */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 1, border: "1px solid var(--border)", background: "var(--border)" }}>
            {/* Stat 1: H100 floor */}
            <div style={{ background: "var(--bg)", padding: "20px 24px" }}>
              <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 5 }}>
                {cheapestH100High ? "H100 — production safe from" : h100Prices.length ? "H100 — observed floor (not reliable)" : "H100 — not in snapshot"}
              </div>
              {h100Value ? (
                <>
                  <div style={{ ...MONO, fontSize: 24, fontWeight: 500, color: h100Color, letterSpacing: "-0.02em", lineHeight: 1 }}>
                    {h100Value}<span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 300 }}>/hr</span>
                  </div>
                  {h100Sub && <div style={{ ...SANS, fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{h100Sub}</div>}
                </>
              ) : (
                <div style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)" }}>Request audit for current H100 options</div>
              )}
            </div>

            {/* Stat 2: Hyperscaler premium */}
            <div style={{ background: "var(--bg)", padding: "20px 24px" }}>
              <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 5 }}>
                {effectivePremium !== null && effectivePremium > 0
                  ? `Hyperscaler overprice vs specialists (${premiumIsH100 ? "H100" : "A100"})`
                  : "Hyperscaler vs specialist pricing"}
              </div>
              {effectivePremium !== null && effectivePremium > 0 ? (
                <>
                  <div style={{ ...MONO, fontSize: 24, fontWeight: 500, color: "var(--amber)", letterSpacing: "-0.02em", lineHeight: 1 }}>
                    +{Math.round(effectivePremium)}%
                  </div>
                  <div style={{ ...SANS, fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>more than specialist clouds</div>
                </>
              ) : (
                <div style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)" }}>No material premium right now</div>
              )}
            </div>

            {/* Stat 3: interactive calculator — replaces the old H100 market-range
                tile (lowest-value stat per prior review). Same underlying
                AuditTool component as "/", parameterized compact — prefilled
                from live market data, editable in place, no logic fork. */}
            <div style={{ background: "var(--bg)", padding: "20px 24px" }}>
              <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 10 }}>
                Try it — edit the numbers
              </div>
              <AuditTool listings={listings} compact />
            </div>
          </div>
        </div>
      </div>
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

// ── GPU Small Multiples ───────────────────────────────────────────────────────

function GpuSmallMultiples({ listings }: { listings: GpuListing[] }) {
  const cards = ["H100", "A100", "L40S", "A10G"].map(family => {
    const ls = listings.filter(l => l.gpu_model.includes(family));
    if (!ls.length) return null;
    const prices   = ls.map(l => l.price_per_hour).sort((a, b) => a - b);
    const highLs   = ls.filter(l => l.availability === "high" && l.pricing_type !== "spot");
    const minReliable = highLs.length ? Math.min(...highLs.map(l => l.price_per_hour)) : null;
    const gapPct   = minReliable && prices[0] > 0
      ? Math.round(((minReliable - prices[0]) / prices[0]) * 100) : null;
    return { family, count: ls.length, min: prices[0], minReliable, gapPct };
  }).filter(Boolean) as { family: string; count: number; min: number; minReliable: number | null; gapPct: number | null }[];

  if (!cards.length) return <div style={{ ...SANS, fontSize: 12, color: "var(--text-muted)", padding: "20px 0" }}>No DC GPU data.</div>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
      {cards.map(c => {
        const hasGap = c.gapPct !== null && c.gapPct > 0;
        return (
          <div key={c.family} style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: "16px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
              <span style={{ ...MONO, fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{c.family}</span>
              <span style={{ ...SANS, fontSize: 10, color: "var(--text-muted)" }}>{c.count} listings</span>
            </div>

            {!c.minReliable ? (
              <div style={{ marginBottom: 12 }}>
                <div style={{ ...MONO, fontSize: 26, fontWeight: 600, color: "var(--amber)", letterSpacing: "-0.02em", lineHeight: 1 }}>No reliable supply</div>
                <div style={{ ...SANS, fontSize: 11.5, color: "var(--amber)", marginTop: 5 }}>Cheapest observed {fmtP(c.min)}/hr is not a production routing target.</div>
              </div>
            ) : hasGap ? (
              <div style={{ marginBottom: 12 }}>
                <div style={{ ...MONO, fontSize: 26, fontWeight: 600, color: "var(--amber)", letterSpacing: "-0.02em", lineHeight: 1 }}>+{c.gapPct}%</div>
                <div style={{ ...SANS, fontSize: 11.5, color: "var(--text-secondary)", marginTop: 5 }}>for confirmed availability — {fmtP(c.min)} observed vs {fmtP(c.minReliable)} reliable</div>
              </div>
            ) : (
              <div style={{ marginBottom: 12 }}>
                <div style={{ ...MONO, fontSize: 26, fontWeight: 600, color: "var(--green)", letterSpacing: "-0.02em", lineHeight: 1 }}>Floor is reliable</div>
                <div style={{ ...SANS, fontSize: 11.5, color: "var(--text-secondary)", marginTop: 5 }}>High-availability supply at {fmtP(c.min)}/hr — no markup needed for confirmed uptime.</div>
              </div>
            )}

            <div style={{ display: "flex", gap: 16, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
              <div>
                <div style={{ ...SANS, fontSize: 9.5, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 2 }}>Observed</div>
                <div style={{ ...MONO, fontSize: 13.5, fontWeight: 500, color: "var(--text-secondary)" }}>{fmtP(c.min)}</div>
              </div>
              <div>
                <div style={{ ...SANS, fontSize: 9.5, color: c.minReliable ? "var(--green)" : "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 2 }}>Reliable</div>
                <div style={{ ...MONO, fontSize: 13.5, fontWeight: 500, color: c.minReliable ? "var(--green)" : "var(--text-muted)" }}>{c.minReliable ? fmtP(c.minReliable) : "—"}</div>
              </div>
            </div>
          </div>
        );
      })}
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
                    <td style={{ ...MONO, padding: "12px 12px 12px 0", fontSize: 12, color: hasGap ? "var(--text-muted)" : "var(--green)", textAlign: "right" as const }}>
                      <span style={{ ...SANS, fontSize: 9.5, color: "var(--text-muted)", display: "block", marginBottom: 1 }}>OBSERVED</span>
                      {fmtP(cheapestP)}
                    </td>
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
  const { activeProviders, cheapestH100High, h100Prices, premiumPct, a100PremiumPct } = computeMarketStats(listings);

  const updatedAgo = minsAgo(summary?.last_updated);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text-primary)" }}>
      <style>{`
        .tsort:hover { color: var(--blue) !important; }
        tr:hover td { background: rgba(20,20,20,0.015) !important; }
        select option { background: #fff; color: #171717; }
        input::placeholder { color: var(--text-muted); }
        @media (max-width: 900px) {
          .hero-grid    { grid-template-columns: 1fr !important; gap: 28px !important; }
          .charts-grid  { grid-template-columns: 1fr !important; }
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
      />

      {/* ── Market data ── */}
      <div id="market-data">
      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "40px 32px 0" }}>

        <div style={{ marginBottom: 24 }}>
          <div style={{ ...SANS, fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.09em", marginBottom: 8 }}>The cheapest price and the cheapest safe price are not the same.</div>
          <div className="charts-grid" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 14 }}>
            <H100SpreadChart listings={listings} />
            <GpuSmallMultiples listings={listings} />
          </div>
        </div>

        {/* Provider Explorer — collapsed by default */}
        <div style={{ marginBottom: 44 }}>
          <details>
            <summary style={{
              ...SANS, fontSize: 13, fontWeight: 600, color: "var(--text-primary)",
              cursor: "pointer", padding: "14px 0", borderTop: "1px solid var(--border)",
              borderBottom: "1px solid var(--border)", listStyle: "none",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span>Explore full provider index</span>
              <span style={{ ...MONO, fontSize: 12, color: "var(--text-muted)" }}>↓</span>
            </summary>
            <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderTop: "none", padding: "0 20px" }}>
              <ProviderExplorer listings={listings} />
            </div>
          </details>
        </div>

      </div>
      </div>{/* end #market-data */}

      {/* ── Methodology ── */}
      <div style={{ borderTop: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 1360, margin: "0 auto", padding: "28px 32px 24px" }}>
          <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 10 }}>
            Data Sources &amp; Methodology
          </div>
          <p style={{ ...SANS, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 10, maxWidth: 860 }}>
            Prices from public pricing APIs and dated provider rate cards across {activeProviders} providers — live-API sources refresh daily; rate-card sources are verified periodically.
            {" "}<strong style={{ fontWeight: 600, color: "var(--text-primary)" }}>Observed</strong> = listing exists, availability unconfirmed.
            {" "}<strong style={{ fontWeight: 600, color: "var(--text-primary)" }}>Reliable</strong> = confirmed high availability, non-spot.
          </p>
          <Link href="/methodology" style={{ ...SANS, fontSize: 12.5, color: "var(--blue)", textDecoration: "none", fontWeight: 600 }}>
            See full methodology &amp; per-provider data sources →
          </Link>
        </div>
      </div>

      {/* ── Research teaser ── */}
      <div style={{ background: "var(--elevated)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 1360, margin: "0 auto", padding: "40px 32px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 32, flexWrap: "wrap" as const }}>
            <div style={{ flex: "1 1 520px", maxWidth: 640 }}>
              <div style={{ ...SANS, fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.09em", marginBottom: 10 }}>Research</div>
              <div style={{ ...SERIF, fontSize: 26, fontWeight: 400, color: "var(--text-primary)", lineHeight: 1.2, marginBottom: 10 }}>
                AI infrastructure economics, from the compute-and-energy edge.
              </div>
              <div style={{ ...SANS, fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                Weekly analysis of what's actually moving in GPU pricing — and the regional power dynamics nobody else is tracking. First deep-dive drops soon.
              </div>
            </div>
            <div style={{ flexShrink: 0, alignSelf: "flex-start" as const, paddingTop: 8 }}>
              <Link
                href="/research"
                style={{
                  ...SANS, fontSize: 13, fontWeight: 600,
                  color: "#F7F3EA", background: "#171717",
                  padding: "10px 20px", borderRadius: 3, textDecoration: "none",
                  whiteSpace: "nowrap" as const, letterSpacing: "0.01em",
                  display: "inline-block",
                }}
              >
                Get The Research →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "24px 32px 64px" }}>
        <Rule />
        <div style={{ paddingTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: 10 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" as const }}>
            <span style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)" }}>AIInfraWatch · {activeProviders} {activeProviders === 1 ? "provider" : "providers"} · Updated daily</span>
            <Link href="/methodology" style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)", textDecoration: "none" }}>Methodology</Link>
            <Link href="/research" style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)", textDecoration: "none" }}>Research</Link>
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
