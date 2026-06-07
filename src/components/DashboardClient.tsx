// @ts-nocheck
"use client";

import { useState, useMemo } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
  Legend,
} from "recharts";
import type { GpuListing } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONO = { fontFamily: "monospace" } as const;
const UPPER = { textTransform: "uppercase" as const, letterSpacing: "0.08em" };
const GREEN = "#00d084";
const BLUE = "#3b82f6";
const AMBER = "#f59e0b";
const PURPLE = "#8b5cf6";
const RED = "#ef4444";
const MUTED = "#555";
const BORDER = "1px solid #1a1a1a";
const BORDER_DIM = "1px solid #111";

const HYPERSCALERS = new Set(["aws", "azure", "gcp", "oci", "ibm"]);
const DC_GPU_PATTERNS = [
  "H100", "A100", "L40S", "L40", "B200", "H200", "A10G", "A40",
  "RTX 6000", "RTX A6000", "L4",
];

const PROVIDER_LABELS: Record<string, string> = {
  aws: "AWS", azure: "Azure", gcp: "GCP", oci: "Oracle Cloud",
  ibm: "IBM Cloud", runpod: "RunPod", coreweave: "CoreWeave",
  lambda: "Lambda Labs", nebius: "Nebius", fluidstack: "FluidStack",
  crusoe: "Crusoe", paperspace: "Paperspace", tensordock: "TensorDock",
  gmi: "GMI Cloud", voltagepark: "Voltage Park", vastai: "vast.ai",
};

const GPU_FAMILY_ORDER = ["H100", "A100", "L40S", "H200", "B200", "L4", "A10G", "A40"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isDcGpu(model: string): boolean {
  return DC_GPU_PATTERNS.some((p) => model.toUpperCase().includes(p.toUpperCase()));
}

function gpuFamily(model: string): string {
  if (model.includes("H100")) return "H100";
  if (model.includes("A100")) return "A100";
  if (model.includes("L40S")) return "L40S";
  if (model.includes("H200")) return "H200";
  if (model.includes("B200")) return "B200";
  if (model.includes("L4") && !model.includes("L40")) return "L4";
  if (model.includes("A10G") || model.includes("A10 ")) return "A10G";
  if (model.includes("A40")) return "A40";
  return model.split(" ").slice(0, 2).join(" ");
}

function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

function hoursAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(ms / 3600000);
  if (h === 0) return "< 1h ago";
  if (h < 24) return `~${h}h ago`;
  return `~${Math.floor(h / 24)}d ago`;
}

function availColor(avail: string): string {
  if (avail === "high") return GREEN;
  if (avail === "medium") return AMBER;
  if (avail === "low") return RED;
  return MUTED;
}

function providerType(slug: string): "hyperscaler" | "neocloud" | "marketplace" {
  if (HYPERSCALERS.has(slug)) return "hyperscaler";
  if (slug === "vastai" || slug === "tensordock") return "marketplace";
  return "neocloud";
}

// ─── Derived metrics ──────────────────────────────────────────────────────────

function computeMetrics(listings: GpuListing[]) {
  const dc = listings.filter((l) => isDcGpu(l.gpu_model));
  const h100 = dc.filter((l) => l.gpu_model.includes("H100"));
  const a100 = dc.filter((l) => l.gpu_model.includes("A100"));

  // Cheapest reliable = high availability, on-demand or spot, per gpu family
  function cheapestReliable(pool: GpuListing[]) {
    const high = pool.filter(
      (l) => l.availability === "high" && l.price_per_hour > 0 && l.gpu_count === 1
    );
    if (!high.length) return null;
    high.sort((a, b) => a.price_per_hour - b.price_per_hour);
    return high[0];
  }

  const cheapestH100 = cheapestReliable(h100);
  const cheapestA100 = cheapestReliable(a100);

  // Hyperscaler premium: median hyperscaler vs neocloud for H100
  const hyperH100 = h100.filter(
    (l) => HYPERSCALERS.has(l.provider) && l.availability === "high" && l.gpu_count === 1 && l.price_per_hour > 0
  );
  const neoH100 = h100.filter(
    (l) => !HYPERSCALERS.has(l.provider) && l.availability === "high" && l.gpu_count === 1 && l.price_per_hour > 0
  );

  function median(arr: number[]): number {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  const medHyper = median(hyperH100.map((l) => l.price_per_hour));
  const medNeo = median(neoH100.map((l) => l.price_per_hour));
  const hyperPremium = medNeo > 0 ? medHyper / medNeo : null;

  // Provider concentration (by dc listing count)
  const provCounts: Record<string, number> = {};
  dc.forEach((l) => { provCounts[l.provider] = (provCounts[l.provider] || 0) + 1; });
  const totalDc = dc.length;
  const topProv = Object.entries(provCounts).sort((a, b) => b[1] - a[1])[0];
  const topShare = topProv && totalDc > 0 ? topProv[1] / totalDc : null;

  // Spot-on-demand spread for H100
  const h100Spot = h100.filter((l) => l.pricing_type === "spot" && l.availability === "high" && l.gpu_count === 1 && l.price_per_hour > 0);
  const h100OD = h100.filter((l) => l.pricing_type === "on-demand" && l.availability === "high" && l.gpu_count === 1 && l.price_per_hour > 0);
  const minSpot = h100Spot.length ? Math.min(...h100Spot.map((l) => l.price_per_hour)) : null;
  const minOD = h100OD.length ? Math.min(...h100OD.map((l) => l.price_per_hour)) : null;
  const spotOdSpread = minSpot && minOD ? ((minOD - minSpot) / minOD) * 100 : null;

  // Freshness
  const fetched = listings.map((l) => l.fetched_at).filter(Boolean).sort().reverse();
  const lastFetch = fetched[0] || null;

  // Active providers (with >0 listings)
  const activeProviders = Object.keys(provCounts).length;

  return {
    cheapestH100,
    cheapestA100,
    hyperPremium,
    medHyper,
    medNeo,
    topProv: topProv?.[0],
    topShare,
    spotOdSpread,
    minSpot,
    minOD,
    lastFetch,
    activeProviders,
    totalListings: listings.length,
    dcListings: dc.length,
  };
}

// ─── Chart data builders ──────────────────────────────────────────────────────

function buildHyperPremiumData(listings: GpuListing[]) {
  const families = ["H100", "A100", "L40S", "A10G"];
  return families.map((fam) => {
    const pool = listings.filter(
      (l) => gpuFamily(l.gpu_model) === fam && l.availability === "high" && l.gpu_count === 1 && l.price_per_hour > 0
    );
    const hyper = pool.filter((l) => HYPERSCALERS.has(l.provider)).map((l) => l.price_per_hour);
    const neo = pool.filter((l) => !HYPERSCALERS.has(l.provider)).map((l) => l.price_per_hour);
    function med(a: number[]) {
      if (!a.length) return null;
      const s = [...a].sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    }
    const mh = med(hyper);
    const mn = med(neo);
    return { family: fam, hyperscaler: mh ? +mh.toFixed(2) : null, neocloud: mn ? +mn.toFixed(2) : null };
  }).filter((d) => d.hyperscaler || d.neocloud);
}

function buildScatterData(listings: GpuListing[]) {
  const dc = listings.filter(
    (l) => isDcGpu(l.gpu_model) && l.gpu_count === 1 && l.price_per_hour > 0 && l.price_per_hour < 80
  );
  const availScore = { high: 1, medium: 0.6, low: 0.2, unavailable: 0 };
  return dc.map((l) => ({
    x: +l.price_per_hour.toFixed(2),
    y: availScore[l.availability] ?? 0,
    gpu: gpuFamily(l.gpu_model),
    provider: PROVIDER_LABELS[l.provider] || l.provider,
    type: providerType(l.provider),
    avail: l.availability,
  }));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  accent,
  caveat,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: string;
  caveat?: string;
}) {
  return (
    <div style={{ borderRight: BORDER, padding: "20px 24px", minWidth: 0 }}>
      <div style={{ ...UPPER, fontSize: 10, color: MUTED, marginBottom: 6 }}>{label}</div>
      <div style={{ ...MONO, fontSize: 22, fontWeight: 700, color: accent || GREEN, marginBottom: 2 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: MUTED }}>{sub}</div>}
      {caveat && (
        <div style={{ fontSize: 10, color: AMBER, marginTop: 4 }}>⚠ {caveat}</div>
      )}
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ padding: "32px 0 16px" }}>
      <div style={{ ...UPPER, fontSize: 11, color: MUTED, marginBottom: 4 }}>{sub || "Market Intelligence"}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: "#e5e5e5" }}>{title}</div>
    </div>
  );
}

// ─── Cost Desk Teaser ─────────────────────────────────────────────────────────

function CostDeskTeaser() {
  return (
    <div
      style={{
        margin: "40px 0",
        border: "1px solid #2a2200",
        background: "#0a0800",
        padding: "40px 48px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Amber accent line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: AMBER,
          opacity: 0.6,
        }}
      />

      <div style={{ display: "flex", gap: 48, alignItems: "flex-start" }}>
        {/* Left: Copy */}
        <div style={{ flex: "1 1 55%", minWidth: 0 }}>
          <div style={{ ...UPPER, fontSize: 10, color: AMBER, marginBottom: 12, letterSpacing: "0.1em" }}>
            Private Cost Desk
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#f5f0e8", lineHeight: 1.3, marginBottom: 12 }}>
            Your workload isn't a row in a table.
          </div>
          <div style={{ fontSize: 14, color: "#888", lineHeight: 1.7, marginBottom: 28, maxWidth: 420 }}>
            Public prices are a floor, not a quote. A real estimate accounts for your GPU mix, region constraints, utilization pattern, contract terms, and provider concentration risk.
          </div>

          {/* Example prompts */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
            {[
              "Fine-tune a 70B model — 8×H100, ~3 weeks, EU, prefer reserved",
              "Benchmark my current AWS bill against neocloud alternatives",
              "200 concurrent inference replicas, A100-40GB, US-East, 99.9% uptime",
            ].map((ex, i) => (
              <div
                key={i}
                style={{
                  ...MONO,
                  fontSize: 12,
                  color: "#666",
                  background: "#0d0b05",
                  border: "1px solid #1e1a0a",
                  padding: "8px 14px",
                  borderLeft: `2px solid ${AMBER}`,
                  opacity: 0.9,
                }}
              >
                "{ex}"
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              style={{
                ...MONO,
                ...UPPER,
                fontSize: 11,
                background: AMBER,
                color: "#1a0f00",
                border: "none",
                padding: "10px 20px",
                cursor: "pointer",
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
              onClick={() => {
                const el = document.getElementById("estimator-section");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Open the estimator ↓
            </button>
            <span style={{ fontSize: 12, color: "#444" }}>No signup required</span>
          </div>
        </div>

        {/* Right: Redacted sample report */}
        <div
          style={{
            flex: "0 0 280px",
            border: "1px solid #1e1a0a",
            background: "#060500",
            padding: "20px",
            position: "relative",
          }}
        >
          <div style={{ ...UPPER, fontSize: 9, color: AMBER, marginBottom: 16 }}>Sample estimate · redacted</div>

          {[
            { label: "Estimated monthly spend", value: "$███,███", sub: "on-demand baseline" },
            { label: "Optimized (2-provider)", value: "$███,███", sub: "−██% vs baseline" },
            { label: "Hyperscaler premium", value: "█.█×", sub: "you're overpaying on A100" },
            { label: "Concentration risk", value: "███%", sub: "single-vendor — flag" },
          ].map((row, i) => (
            <div
              key={i}
              style={{
                borderBottom: "1px solid #111",
                padding: "10px 0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
              }}
            >
              <span style={{ fontSize: 11, color: "#444" }}>{row.label}</span>
              <div style={{ textAlign: "right" }}>
                <div style={{ ...MONO, fontSize: 14, color: "#2a2200", background: "#2a2200", borderRadius: 2 }}>
                  {row.value}
                </div>
                <div style={{ fontSize: 10, color: "#333", marginTop: 2 }}>{row.sub}</div>
              </div>
            </div>
          ))}

          <div
            style={{
              marginTop: 16,
              fontSize: 10,
              color: "#333",
              textAlign: "center",
              fontStyle: "italic",
            }}
          >
            Results are private. Not stored or shared.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Hyperscaler Premium Chart ────────────────────────────────────────────────

function HyperscalerPremiumChart({ data }: { data: ReturnType<typeof buildHyperPremiumData> }) {
  if (!data.length) return null;
  return (
    <div style={{ background: "#0c0c0c", border: BORDER, padding: "24px" }}>
      <div style={{ ...UPPER, fontSize: 10, color: MUTED, marginBottom: 4 }}>Price Analysis · Chart 1 of 3</div>
      <div style={{ fontSize: 15, color: "#ddd", marginBottom: 4 }}>The hyperscaler premium</div>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 20 }}>
        Median on-demand $/hr per GPU — hyperscaler vs neocloud. How much more are you paying for the brand?
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" barCategoryGap="30%" barGap={4}>
          <CartesianGrid horizontal={false} stroke="#1a1a1a" />
          <XAxis
            type="number"
            tick={{ fill: "#555", fontSize: 11, fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v}`}
          />
          <YAxis
            type="category"
            dataKey="family"
            tick={{ fill: "#888", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 0 }}
            labelStyle={{ color: "#aaa", fontSize: 12 }}
            itemStyle={{ color: "#ddd", fontFamily: "monospace", fontSize: 12 }}
            formatter={(v: number, name: string) => [`$${v.toFixed(2)}/hr`, name]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: MUTED, paddingTop: 8 }}
            iconSize={8}
            iconType="square"
          />
          <Bar dataKey="hyperscaler" name="Hyperscaler (AWS/GCP/Azure/OCI/IBM)" fill={BLUE} radius={0} />
          <Bar dataKey="neocloud" name="Neocloud (CoreWeave/Lambda/Crusoe…)" fill={GREEN} radius={0} />
        </BarChart>
      </ResponsiveContainer>
      <div style={{ fontSize: 11, color: "#333", marginTop: 12 }}>
        * Median of high-availability, single-GPU, on-demand listings. Hardcoded provider prices may not reflect latest rates.
      </div>
    </div>
  );
}

// ─── Scatter: Price vs Availability ──────────────────────────────────────────

const SCATTER_COLORS = { hyperscaler: BLUE, neocloud: GREEN, marketplace: PURPLE };

function PriceAvailabilityScatter({ data }: { data: ReturnType<typeof buildScatterData> }) {
  if (!data.length) return null;

  const hyperData = data.filter((d) => d.type === "hyperscaler");
  const neoData = data.filter((d) => d.type === "neocloud");
  const marketData = data.filter((d) => d.type === "marketplace");

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <div style={{ background: "#111", border: "1px solid #222", padding: "10px 14px" }}>
        <div style={{ fontFamily: "monospace", fontSize: 12, color: "#ddd" }}>{d?.gpu}</div>
        <div style={{ fontSize: 11, color: "#888" }}>{d?.provider}</div>
        <div style={{ fontFamily: "monospace", fontSize: 12, color: GREEN, marginTop: 4 }}>
          ${d?.x}/hr
        </div>
        <div style={{ fontSize: 11, color: availColor(d?.avail) }}>{d?.avail} availability</div>
      </div>
    );
  };

  return (
    <div style={{ background: "#0c0c0c", border: BORDER, padding: "24px" }}>
      <div style={{ ...UPPER, fontSize: 10, color: MUTED, marginBottom: 4 }}>Price Analysis · Chart 2 of 3</div>
      <div style={{ fontSize: 15, color: "#ddd", marginBottom: 4 }}>Price vs availability — the reliability frontier</div>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 20 }}>
        Cheap doesn't mean gettable. Each dot is a single-GPU listing. The bottom-right corner is cheap-but-risky; top-left is reliable-but-expensive. The sweet spot is top-right.
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart margin={{ top: 4, right: 24, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#1a1a1a" />
          <XAxis
            dataKey="x"
            name="Price"
            type="number"
            tick={{ fill: "#555", fontSize: 11, fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v}`}
            label={{ value: "$/hr", position: "insideBottomRight", offset: -4, fill: "#444", fontSize: 10 }}
          />
          <YAxis
            dataKey="y"
            type="number"
            domain={[0, 1.1]}
            tick={false}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip content={<CustomTooltip />} />
          {[
            { data: hyperData, color: BLUE, name: "Hyperscaler" },
            { data: neoData, color: GREEN, name: "Neocloud" },
            { data: marketData, color: PURPLE, name: "Marketplace" },
          ].map(({ data: d, color, name }) => (
            <Scatter key={name} name={name} data={d} fill={color} opacity={0.55} r={3} />
          ))}
          {/* Y-axis label annotations */}
          <ReferenceLine y={1} stroke="#1a1a1a" strokeDasharray="4 4" label={{ value: "High avail.", position: "insideRight", fill: "#333", fontSize: 10 }} />
          <ReferenceLine y={0.6} stroke="#1a1a1a" strokeDasharray="4 4" label={{ value: "Medium", position: "insideRight", fill: "#333", fontSize: 10 }} />
          <ReferenceLine y={0.2} stroke="#1a1a1a" strokeDasharray="4 4" label={{ value: "Low", position: "insideRight", fill: "#333", fontSize: 10 }} />
        </ScatterChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", gap: 20, marginTop: 8 }}>
        {[
          { color: BLUE, label: "Hyperscaler" },
          { color: GREEN, label: "Neocloud" },
          { color: PURPLE, label: "Marketplace" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
            <span style={{ fontSize: 11, color: MUTED }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── H100 Provider Spread Chart ───────────────────────────────────────────────

function ProviderSpreadChart({ listings }: { listings: GpuListing[] }) {
  const h100 = listings.filter(
    (l) => l.gpu_model.includes("H100") && l.availability === "high" && l.gpu_count === 1 && l.price_per_hour > 0
  );
  if (h100.length < 2) return null;

  const byProv: Record<string, number[]> = {};
  h100.forEach((l) => {
    if (!byProv[l.provider]) byProv[l.provider] = [];
    byProv[l.provider].push(l.price_per_hour);
  });

  const data = Object.entries(byProv)
    .map(([prov, prices]) => ({
      provider: PROVIDER_LABELS[prov] || prov,
      min: +Math.min(...prices).toFixed(2),
      max: +Math.max(...prices).toFixed(2),
      avg: +(prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2),
      isHyper: HYPERSCALERS.has(prov),
    }))
    .sort((a, b) => a.min - b.min);

  return (
    <div style={{ background: "#0c0c0c", border: BORDER, padding: "24px" }}>
      <div style={{ ...UPPER, fontSize: 10, color: MUTED, marginBottom: 4 }}>Price Analysis · Chart 3 of 3</div>
      <div style={{ fontSize: 15, color: "#ddd", marginBottom: 4 }}>H100 price spread by provider</div>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 20 }}>
        Min/avg single-GPU on-demand H100, high-availability listings only. Wide bars = wide per-region variance.
      </div>
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 36)}>
        <BarChart data={data} layout="vertical" barSize={10} barGap={0} barCategoryGap="35%">
          <CartesianGrid horizontal={false} stroke="#1a1a1a" />
          <XAxis
            type="number"
            tick={{ fill: "#555", fontSize: 11, fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v}`}
          />
          <YAxis
            type="category"
            dataKey="provider"
            tick={{ fill: "#888", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={90}
          />
          <Tooltip
            contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 0 }}
            labelStyle={{ color: "#aaa", fontSize: 12 }}
            itemStyle={{ color: "#ddd", fontFamily: "monospace", fontSize: 12 }}
            formatter={(v: number) => [`$${v.toFixed(2)}/hr`]}
          />
          <Bar dataKey="min" name="Min $/hr" stackId="a" fill="transparent" />
          <Bar dataKey="avg" name="Avg $/hr" stackId="a">
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.isHyper ? BLUE : GREEN} opacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{ fontSize: 11, color: "#333", marginTop: 8 }}>
        Blue = hyperscaler · Green = neocloud. Variance within a provider reflects per-GPU-count or per-region pricing.
      </div>
    </div>
  );
}

// ─── Screener Table ───────────────────────────────────────────────────────────

type ScreenerRow = {
  gpu: string;
  family: string;
  providers: string[];
  minPrice: number;
  minReliablePrice: number | null;
  cheapestProvider: string;
  hasHigh: boolean;
  hasMedium: boolean;
  count: number;
  spotCount: number;
  minSpot: number | null;
  minOD: number | null;
  isDc: boolean;
  lastFetch: string | null;
};

function buildScreenerRows(listings: GpuListing[]): ScreenerRow[] {
  const grouped: Record<string, GpuListing[]> = {};
  listings.forEach((l) => {
    const key = l.gpu_model;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(l);
  });

  return Object.entries(grouped).map(([gpu, rows]) => {
    const prices = rows.map((r) => r.price_per_hour).filter((p) => p > 0);
    const reliableRows = rows.filter((r) => r.availability === "high" && r.price_per_hour > 0);
    const spotRows = rows.filter((r) => r.pricing_type === "spot" && r.price_per_hour > 0);
    const odRows = rows.filter((r) => r.pricing_type === "on-demand" && r.price_per_hour > 0);
    const provSet = new Set(rows.map((r) => r.provider));
    const minReliable = reliableRows.length ? Math.min(...reliableRows.map((r) => r.price_per_hour)) : null;
    const cheapest = reliableRows.length
      ? reliableRows.reduce((a, b) => (a.price_per_hour < b.price_per_hour ? a : b))
      : rows.reduce((a, b) => (a.price_per_hour < b.price_per_hour ? a : b));
    const fetches = rows.map((r) => r.fetched_at).filter(Boolean).sort().reverse();

    return {
      gpu,
      family: gpuFamily(gpu),
      providers: [...provSet],
      minPrice: prices.length ? Math.min(...prices) : 0,
      minReliablePrice: minReliable,
      cheapestProvider: PROVIDER_LABELS[cheapest.provider] || cheapest.provider,
      hasHigh: reliableRows.length > 0,
      hasMedium: rows.some((r) => r.availability === "medium"),
      count: rows.length,
      spotCount: spotRows.length,
      minSpot: spotRows.length ? Math.min(...spotRows.map((r) => r.price_per_hour)) : null,
      minOD: odRows.length ? Math.min(...odRows.map((r) => r.price_per_hour)) : null,
      isDc: isDcGpu(gpu),
      lastFetch: fetches[0] || null,
    };
  });
}

function ScreenerTable({ listings }: { listings: GpuListing[] }) {
  const [dcOnly, setDcOnly] = useState(true);
  const [familyFilter, setFamilyFilter] = useState("All");
  const [sortKey, setSortKey] = useState<"price" | "reliable" | "providers">("reliable");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const allRows = useMemo(() => buildScreenerRows(listings), [listings]);

  const families = useMemo(() => {
    const s = new Set(allRows.filter((r) => r.isDc).map((r) => r.family));
    return ["All", ...GPU_FAMILY_ORDER.filter((f) => s.has(f))];
  }, [allRows]);

  const rows = useMemo(() => {
    let r = dcOnly ? allRows.filter((r) => r.isDc) : allRows;
    if (familyFilter !== "All") r = r.filter((row) => row.family === familyFilter);
    r = [...r].sort((a, b) => {
      if (sortKey === "price") return (a.minPrice || 999) - (b.minPrice || 999);
      if (sortKey === "reliable") {
        const ap = a.minReliablePrice ?? 999;
        const bp = b.minReliablePrice ?? 999;
        return ap - bp;
      }
      return b.providers.length - a.providers.length;
    });
    return r;
  }, [allRows, dcOnly, familyFilter, sortKey]);

  const toggle = (gpu: string) => {
    const s = new Set(expanded);
    if (s.has(gpu)) s.delete(gpu);
    else s.add(gpu);
    setExpanded(s);
  };

  // Detail rows for expanded GPU
  const detailListings = (gpu: string) =>
    listings
      .filter((l) => l.gpu_model === gpu && l.price_per_hour > 0)
      .sort((a, b) => a.price_per_hour - b.price_per_hour)
      .slice(0, 12);

  return (
    <div>
      {/* Filters */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#888", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={dcOnly}
            onChange={(e) => setDcOnly(e.target.checked)}
            style={{ accentColor: GREEN }}
          />
          Data-center GPUs only
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {families.map((f) => (
            <button
              key={f}
              onClick={() => setFamilyFilter(f)}
              style={{
                ...MONO,
                ...UPPER,
                fontSize: 10,
                padding: "4px 12px",
                background: familyFilter === f ? GREEN : "transparent",
                color: familyFilter === f ? "#000" : "#555",
                border: `1px solid ${familyFilter === f ? GREEN : "#222"}`,
                cursor: "pointer",
              }}
            >
              {f}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: MUTED }}>Sort:</span>
          {(["reliable", "price", "providers"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setSortKey(k)}
              style={{
                ...MONO,
                fontSize: 11,
                padding: "3px 10px",
                background: sortKey === k ? "#111" : "transparent",
                color: sortKey === k ? GREEN : "#444",
                border: `1px solid ${sortKey === k ? "#222" : "#111"}`,
                cursor: "pointer",
              }}
            >
              {k === "reliable" ? "best reliable" : k === "price" ? "cheapest" : "providers"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1a1a1a" }}>
              {["GPU", "Cheapest reliable $/hr", "Provider", "Spot", "On-demand", "Avail.", "Coverage", "Freshness"].map((h) => (
                <th
                  key={h}
                  style={{
                    ...UPPER,
                    fontSize: 9,
                    color: "#444",
                    textAlign: "left",
                    padding: "8px 12px",
                    fontWeight: 500,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <>
                <tr
                  key={row.gpu}
                  onClick={() => toggle(row.gpu)}
                  style={{
                    borderBottom: "1px solid #0f0f0f",
                    cursor: "pointer",
                    background: expanded.has(row.gpu) ? "#0c0c0c" : "transparent",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#0d0d0d")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = expanded.has(row.gpu) ? "#0c0c0c" : "transparent")}
                >
                  <td style={{ padding: "10px 12px", color: "#ccc" }}>
                    <span style={{ marginRight: 8, color: "#333", fontSize: 10 }}>
                      {expanded.has(row.gpu) ? "▼" : "▶"}
                    </span>
                    {row.gpu}
                  </td>
                  <td style={{ padding: "10px 12px", ...MONO }}>
                    {row.minReliablePrice != null ? (
                      <span style={{ color: GREEN }}>${fmt(row.minReliablePrice)}</span>
                    ) : (
                      <span style={{ color: "#333" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#888", fontSize: 12 }}>
                    {row.cheapestProvider}
                    {row.providers.length > 1 && (
                      <span style={{ color: "#444", marginLeft: 4 }}>+{row.providers.length - 1}</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px", ...MONO, fontSize: 12 }}>
                    {row.minSpot != null ? (
                      <span style={{ color: "#aaa" }}>${fmt(row.minSpot)}</span>
                    ) : (
                      <span style={{ color: "#333" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px", ...MONO, fontSize: 12 }}>
                    {row.minOD != null ? (
                      <span style={{ color: "#aaa" }}>${fmt(row.minOD)}</span>
                    ) : (
                      <span style={{ color: "#333" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span
                      style={{
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: row.hasHigh ? GREEN : row.hasMedium ? AMBER : RED,
                        marginRight: 6,
                      }}
                    />
                    <span style={{ fontSize: 11, color: MUTED }}>
                      {row.hasHigh ? "high" : row.hasMedium ? "medium" : "low"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ fontSize: 11, color: "#444" }}>
                      {row.providers.length} provider{row.providers.length !== 1 ? "s" : ""}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {row.lastFetch ? (
                      <span style={{ fontSize: 11, color: "#444" }}>{hoursAgo(row.lastFetch)}</span>
                    ) : (
                      <span style={{ color: "#333", fontSize: 11 }}>—</span>
                    )}
                  </td>
                </tr>

                {/* Expanded detail */}
                {expanded.has(row.gpu) && (
                  <tr key={`${row.gpu}-expanded`}>
                    <td colSpan={8} style={{ padding: "0 12px 16px 32px", background: "#080808" }}>
                      <div style={{ paddingTop: 12 }}>
                        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                          <thead>
                            <tr>
                              {["Provider", "Region", "Type", "$/hr", "Avail.", "GPUs"].map((h) => (
                                <th
                                  key={h}
                                  style={{
                                    ...UPPER,
                                    fontSize: 9,
                                    color: "#333",
                                    textAlign: "left",
                                    padding: "4px 8px",
                                    fontWeight: 400,
                                  }}
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {detailListings(row.gpu).map((l, i) => (
                              <tr key={i} style={{ borderBottom: "1px solid #0c0c0c" }}>
                                <td style={{ padding: "5px 8px", color: "#777" }}>
                                  {PROVIDER_LABELS[l.provider] || l.provider}
                                </td>
                                <td style={{ padding: "5px 8px", color: "#555", ...MONO, fontSize: 11 }}>
                                  {l.region || "—"}
                                </td>
                                <td style={{ padding: "5px 8px", color: "#555", fontSize: 11 }}>
                                  {l.pricing_type}
                                </td>
                                <td style={{ padding: "5px 8px", ...MONO, color: GREEN }}>
                                  ${fmt(l.price_per_hour)}
                                </td>
                                <td style={{ padding: "5px 8px" }}>
                                  <span style={{ color: availColor(l.availability), fontSize: 11 }}>
                                    {l.availability}
                                  </span>
                                </td>
                                <td style={{ padding: "5px 8px", color: "#555", fontSize: 11 }}>
                                  ×{l.gpu_count}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {detailListings(row.gpu).length === 12 && (
                          <div style={{ fontSize: 10, color: "#333", marginTop: 8 }}>
                            Showing top 12 listings by price. {row.count - 12} more in the index.
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {!dcOnly && (
        <div style={{ marginTop: 12, fontSize: 11, color: "#333" }}>
          ⚠ Consumer GPUs (RTX, gaming cards) are included. These are not suitable for production ML workloads.
        </div>
      )}
    </div>
  );
}

// ─── Workload Estimator ───────────────────────────────────────────────────────

function WorkloadEstimator({ listings }: { listings: GpuListing[] }) {
  const [gpuType, setGpuType] = useState("H100");
  const [hours, setHours] = useState(720);
  const [count, setCount] = useState(1);
  const [pricingType, setPricingType] = useState<"spot" | "on-demand">("on-demand");

  const results = useMemo(() => {
    const pool = listings.filter(
      (l) =>
        l.gpu_model.includes(gpuType) &&
        l.pricing_type === pricingType &&
        l.gpu_count >= count &&
        l.availability === "high" &&
        l.price_per_hour > 0
    );
    if (!pool.length) return null;
    pool.sort((a, b) => a.price_per_hour - b.price_per_hour);
    return pool.slice(0, 5).map((l) => ({
      provider: PROVIDER_LABELS[l.provider] || l.provider,
      priceHr: l.price_per_hour,
      total: l.price_per_hour * hours * count,
      region: l.region,
      type: providerType(l.provider),
    }));
  }, [listings, gpuType, hours, count, pricingType]);

  const GPU_TYPES = ["H100", "A100", "L40S", "A10G", "L4"];

  return (
    <div id="estimator-section" style={{ background: "#0c0c0c", border: BORDER, padding: "32px" }}>
      <div style={{ ...UPPER, fontSize: 10, color: GREEN, marginBottom: 4 }}>Workload estimator</div>
      <div style={{ fontSize: 15, color: "#ddd", marginBottom: 20 }}>
        Find the cheapest reliable deployment for your workload
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 28 }}>
        {/* GPU type */}
        <div>
          <div style={{ ...UPPER, fontSize: 9, color: MUTED, marginBottom: 6 }}>GPU type</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {GPU_TYPES.map((g) => (
              <button
                key={g}
                onClick={() => setGpuType(g)}
                style={{
                  ...MONO,
                  fontSize: 12,
                  padding: "4px 10px",
                  background: gpuType === g ? GREEN : "transparent",
                  color: gpuType === g ? "#000" : "#555",
                  border: `1px solid ${gpuType === g ? GREEN : "#1a1a1a"}`,
                  cursor: "pointer",
                }}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Pricing type */}
        <div>
          <div style={{ ...UPPER, fontSize: 9, color: MUTED, marginBottom: 6 }}>Pricing type</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["on-demand", "spot"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setPricingType(t)}
                style={{
                  ...MONO,
                  fontSize: 12,
                  padding: "4px 10px",
                  background: pricingType === t ? "#1a1a1a" : "transparent",
                  color: pricingType === t ? GREEN : "#555",
                  border: `1px solid ${pricingType === t ? "#222" : "#111"}`,
                  cursor: "pointer",
                }}
              >
                {t}
              </button>
            ))}
          </div>
          {pricingType === "spot" && (
            <div style={{ fontSize: 10, color: AMBER, marginTop: 4 }}>⚠ Spot may be preempted at any time</div>
          )}
        </div>

        {/* GPU count */}
        <div>
          <div style={{ ...UPPER, fontSize: 9, color: MUTED, marginBottom: 6 }}>
            GPU count: <span style={{ color: GREEN, fontFamily: "monospace" }}>{count}</span>
          </div>
          <input
            type="range"
            min={1}
            max={8}
            step={1}
            value={count}
            onChange={(e) => setCount(+e.target.value)}
            style={{ width: "100%", accentColor: GREEN }}
          />
        </div>

        {/* Hours */}
        <div>
          <div style={{ ...UPPER, fontSize: 9, color: MUTED, marginBottom: 6 }}>
            Hours/month: <span style={{ color: GREEN, fontFamily: "monospace" }}>{hours}h</span>
          </div>
          <input
            type="range"
            min={1}
            max={730}
            step={1}
            value={hours}
            onChange={(e) => setHours(+e.target.value)}
            style={{ width: "100%", accentColor: GREEN }}
          />
        </div>
      </div>

      {results && results.length > 0 ? (
        <div>
          <div style={{ ...UPPER, fontSize: 9, color: MUTED, marginBottom: 12 }}>
            Top options — high availability, {gpuType}, {pricingType}, ×{count} GPU
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {results.map((r, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 0",
                  borderBottom: "1px solid #111",
                }}
              >
                <div>
                  <div style={{ fontSize: 13, color: "#bbb" }}>{r.provider}</div>
                  <div style={{ fontSize: 11, color: "#444", marginTop: 2 }}>
                    {r.region || "region unspecified"} · {r.type}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ ...MONO, fontSize: 14, color: GREEN }}>${fmt(r.priceHr)}/hr</div>
                  <div style={{ ...MONO, fontSize: 12, color: "#555", marginTop: 2 }}>
                    ≈ ${r.total.toLocaleString("en-US", { maximumFractionDigits: 0 })}/mo
                  </div>
                </div>
              </div>
            ))}
          </div>
          {pricingType === "spot" && (
            <div style={{ marginTop: 12, fontSize: 11, color: "#333" }}>
              * Spot pricing varies by provider. Monthly total assumes continuous uptime — real spend may be lower (preemptions) or higher (retries).
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: "24px 0", color: MUTED, fontSize: 13 }}>
          No high-availability {gpuType} listings with ×{count} GPUs found for {pricingType} pricing.
          <br />
          <span style={{ fontSize: 11, color: "#333", marginTop: 6, display: "block" }}>
            Try reducing GPU count, switching to on-demand, or selecting a different GPU type.
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Market Brief Strip ───────────────────────────────────────────────────────

function MarketBrief({ metrics, listings }: { metrics: ReturnType<typeof computeMetrics>; listings: GpuListing[] }) {
  const {
    cheapestH100,
    cheapestA100,
    hyperPremium,
    topProv,
    topShare,
    spotOdSpread,
    minSpot,
    minOD,
    lastFetch,
    activeProviders,
    totalListings,
  } = metrics;

  return (
    <div style={{ background: "#0a0a0a", border: BORDER, marginBottom: 2 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 24px",
          borderBottom: BORDER,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN, boxShadow: "0 0 6px " + GREEN }} />
          <span style={{ ...UPPER, fontSize: 10, color: GREEN }}>Market brief</span>
        </div>
        <div style={{ fontSize: 11, color: "#333" }}>
          {lastFetch ? `Last ingestion: ${hoursAgo(lastFetch)}` : "Freshness unknown"}
          {" · "}
          <span style={{ color: "#222" }}>Updates daily via cron</span>
        </div>
      </div>

      {/* Metric grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <MetricCard
          label="Cheapest reliable H100"
          value={cheapestH100 ? `$${fmt(cheapestH100.price_per_hour)}/hr` : "—"}
          sub={cheapestH100 ? `${PROVIDER_LABELS[cheapestH100.provider] || cheapestH100.provider} · high avail.` : "No high-avail H100 found"}
          accent={GREEN}
          caveat={!cheapestH100 ? "Coverage expanding" : undefined}
        />
        <MetricCard
          label="Hyperscaler premium (H100)"
          value={hyperPremium ? `${fmt(hyperPremium, 1)}×` : "—"}
          sub={hyperPremium ? "vs neocloud median" : "Insufficient data for comparison"}
          accent={hyperPremium && hyperPremium > 2 ? AMBER : GREEN}
          caveat={!hyperPremium ? "Needs ≥1 hyperscaler + neocloud listing" : undefined}
        />
        <MetricCard
          label="H100 spot–OD spread"
          value={spotOdSpread != null ? `${fmt(spotOdSpread, 0)}% cheaper` : "—"}
          sub={
            spotOdSpread != null
              ? `spot $${fmt(minSpot!, 2)} vs OD $${fmt(minOD!, 2)}/hr`
              : "No comparable spot + OD pair"
          }
          accent={BLUE}
        />
        <MetricCard
          label="Supply concentration"
          value={topShare != null ? `${fmt(topShare * 100, 0)}%` : "—"}
          sub={topShare != null ? `${PROVIDER_LABELS[topProv!] || topProv} of DC listings` : "—"}
          accent={topShare && topShare > 0.5 ? AMBER : GREEN}
          caveat={topShare && topShare > 0.6 ? "Single-provider concentration risk" : undefined}
        />
        <MetricCard
          label="Active providers"
          value={String(activeProviders)}
          sub={`${totalListings.toLocaleString()} total listings`}
          accent="#888"
        />
      </div>
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ metrics }: { metrics: ReturnType<typeof computeMetrics> }) {
  const { cheapestH100, cheapestA100, lastFetch } = metrics;
  const headline = cheapestH100 || cheapestA100;
  const headlineGpu = cheapestH100 ? "H100" : "A100";

  return (
    <div style={{ padding: "48px 0 32px" }}>
      <div style={{ ...UPPER, fontSize: 10, color: GREEN, marginBottom: 16, letterSpacing: "0.12em" }}>
        AIInfraWatch · AI Infrastructure Market Intelligence
      </div>
      <h1
        style={{
          fontSize: 32,
          fontWeight: 700,
          color: "#e8e8e8",
          margin: 0,
          lineHeight: 1.2,
          marginBottom: 12,
          maxWidth: 640,
        }}
      >
        Know the real price of compute —<br />
        <span style={{ color: GREEN }}>before you commit.</span>
      </h1>
      <p style={{ fontSize: 15, color: "#666", maxWidth: 520, lineHeight: 1.7, margin: "0 0 32px" }}>
        Spot prices, hyperscaler premiums, and real capacity across hyperscalers, neoclouds, and GPU marketplaces. Not just a table — a market brief with decisions in it.
      </p>

      {headline && (
        <div style={{ display: "flex", gap: 32, alignItems: "baseline", flexWrap: "wrap" }}>
          <div>
            <div style={{ ...UPPER, fontSize: 9, color: MUTED, marginBottom: 4 }}>
              Cheapest reliable {headlineGpu} right now
            </div>
            <div style={{ ...MONO, fontSize: 28, fontWeight: 700, color: GREEN }}>
              ${fmt(headline.price_per_hour)}/hr
            </div>
            <div style={{ fontSize: 12, color: "#444", marginTop: 2 }}>
              {PROVIDER_LABELS[headline.provider] || headline.provider} · {headline.region || "region unspecified"} · high availability
            </div>
          </div>
          {metrics.hyperPremium && (
            <div>
              <div style={{ ...UPPER, fontSize: 9, color: MUTED, marginBottom: 4 }}>
                Hyperscaler premium vs neocloud
              </div>
              <div style={{ ...MONO, fontSize: 28, fontWeight: 700, color: AMBER }}>
                {fmt(metrics.hyperPremium, 1)}×
              </div>
              <div style={{ fontSize: 12, color: "#444", marginTop: 2 }}>
                Median AWS/GCP/Azure vs neocloud {headlineGpu}
              </div>
            </div>
          )}
        </div>
      )}

      {!headline && (
        <div style={{ fontSize: 13, color: AMBER }}>
          ⚠ No high-availability H100/A100 single-GPU listings in the current window.
          Data expands daily as scrapers run.
        </div>
      )}
    </div>
  );
}

// ─── Data coverage caveat ─────────────────────────────────────────────────────

function CoverageCaveat({ listings }: { listings: GpuListing[] }) {
  const provCounts: Record<string, number> = {};
  listings.forEach((l) => { provCounts[l.provider] = (provCounts[l.provider] || 0) + 1; });
  const hardcoded = ["gcp", "lambda", "oci", "paperspace", "crusoe", "fluidstack"];
  const partialProviders = Object.keys(provCounts).filter((p) => provCounts[p] < 5);

  return (
    <div
      style={{
        border: "1px solid #1a1500",
        background: "#0a0800",
        padding: "14px 20px",
        marginBottom: 32,
        fontSize: 12,
        color: "#555",
        lineHeight: 1.7,
      }}
    >
      <span style={{ color: AMBER, marginRight: 6 }}>⚠ Data quality note.</span>
      Some providers ({hardcoded.map((p) => PROVIDER_LABELS[p] || p).join(", ")}) use hardcoded pricing and may not reflect live rates.
      Prices are indicative only — verify with the provider before committing.
      Spot prices fluctuate; on-demand prices change on provider notice.
      {partialProviders.length > 0 && (
        <> Partial coverage: {partialProviders.map((p) => PROVIDER_LABELS[p] || p).join(", ")}.</>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  listings: GpuListing[];
}

export default function DashboardClient({ listings }: Props) {
  const metrics = useMemo(() => computeMetrics(listings), [listings]);
  const hyperPremiumData = useMemo(() => buildHyperPremiumData(listings), [listings]);
  const scatterData = useMemo(() => buildScatterData(listings), [listings]);

  return (
    <div
      style={{
        background: "#080808",
        color: "#c8c8c8",
        minHeight: "100vh",
        fontFamily: "'IBM Plex Mono', 'JetBrains Mono', 'Fira Code', monospace",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 32px 80px" }}>

        {/* ── 1. Hero ──────────────────────────────────────────────────────── */}
        <Hero metrics={metrics} />

        {/* ── 2. Market Brief Strip ────────────────────────────────────────── */}
        <MarketBrief metrics={metrics} listings={listings} />

        {/* ── 3. Cost Desk Teaser ──────────────────────────────────────────── */}
        <CostDeskTeaser />

        {/* ── 4. Coverage caveat ───────────────────────────────────────────── */}
        <CoverageCaveat listings={listings} />

        {/* ── 5. Price Analysis ────────────────────────────────────────────── */}
        <SectionHeader title="What the headline price hides" sub="Price Analysis · 3 charts" />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <HyperscalerPremiumChart data={hyperPremiumData} />
          <PriceAvailabilityScatter data={scatterData} />
          <ProviderSpreadChart listings={listings} />
        </div>

        {/* ── 6. Buyer Screener ─────────────────────────────────────────────── */}
        <SectionHeader title="GPU buyer screener" sub="Provider Explorer · DC GPUs default" />
        <ScreenerTable listings={listings} />

        {/* ── 7. Estimator ─────────────────────────────────────────────────── */}
        <div style={{ marginTop: 40 }}>
          <SectionHeader title="Workload cost estimator" sub="Quick estimate · public index" />
          <WorkloadEstimator listings={listings} />
        </div>

        {/* ── 8. Methodology ───────────────────────────────────────────────── */}
        <div
          style={{
            marginTop: 64,
            borderTop: BORDER_DIM,
            paddingTop: 32,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 24,
            fontSize: 12,
            color: "#333",
          }}
        >
          <div>
            <div style={{ ...UPPER, fontSize: 9, color: "#333", marginBottom: 8 }}>Coverage</div>
            <div>{metrics.activeProviders} providers · {metrics.totalListings.toLocaleString()} listings</div>
            <div style={{ marginTop: 4 }}>Query window: 25 hours</div>
            <div style={{ marginTop: 4 }}>Cron: once daily (Vercel Hobby)</div>
          </div>
          <div>
            <div style={{ ...UPPER, fontSize: 9, color: "#333", marginBottom: 8 }}>Methodology</div>
            <div>Prices normalized to per-GPU-per-hour</div>
            <div style={{ marginTop: 4 }}>Hyperscaler = AWS, GCP, Azure, OCI, IBM</div>
            <div style={{ marginTop: 4 }}>Reliable = high availability flag only</div>
          </div>
          <div>
            <div style={{ ...UPPER, fontSize: 9, color: "#333", marginBottom: 8 }}>Limitations</div>
            <div>Spot prices are not real-time bids</div>
            <div style={{ marginTop: 4 }}>Reserved pricing not in screener default</div>
            <div style={{ marginTop: 4 }}>Multi-GPU clusters may be priced differently</div>
          </div>
          <div>
            <div style={{ ...UPPER, fontSize: 9, color: "#333", marginBottom: 8 }}>API</div>
            <div style={{ color: "#2a2a2a" }}>GET /api/gpu-prices</div>
            <div style={{ color: "#2a2a2a", marginTop: 4 }}>GET /api/providers</div>
            <div style={{ marginTop: 4 }}>
              <a href="/openapi.json" style={{ color: "#333", textDecoration: "none" }}>openapi.json</a>
              {" · "}
              <a href="/llms.txt" style={{ color: "#333", textDecoration: "none" }}>llms.txt</a>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 32, fontSize: 11, color: "#222", borderTop: BORDER_DIM, paddingTop: 20 }}>
          AIInfraWatch · AI compute is a fragmented, live market. Prices are indicative only and may not reflect current availability.
          Always verify directly with the provider before making infrastructure decisions.
        </div>
      </div>
    </div>
  );
}
