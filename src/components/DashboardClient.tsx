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

// ── Constants ─────────────────────────────────────────────────────────────────

const MONO = { fontFamily: "monospace" } as const;
const UPPER = { textTransform: "uppercase" as const, letterSpacing: "0.08em" };
const TH_STYLE = { ...MONO, ...UPPER, fontSize: 9, fontWeight: 400, color: "#444", padding: "8px 12px 8px 0", textAlign: "left" as const };
const GPU_FAMILIES = ["All", "H100", "A100", "L40S", "A10G", "A2000"];
const GPU_COLS = ["H100", "A100", "L40S", "A10G", "RTX"];

const PROVIDER_META: Record<string, { cat: string; color: string; status: string }> = {
  runpod:       { cat: "Marketplace", color: "#8b5cf6", status: "live" },
  vastai:       { cat: "Marketplace", color: "#8b5cf6", status: "partial" },
  "vast.ai":    { cat: "Marketplace", color: "#8b5cf6", status: "partial" },
  aws:          { cat: "Hyperscaler", color: "#f59e0b", status: "live" },
  azure:        { cat: "Hyperscaler", color: "#f59e0b", status: "live" },
  gcp:          { cat: "Hyperscaler", color: "#f59e0b", status: "live" },
  "google cloud":{ cat: "Hyperscaler", color: "#f59e0b", status: "live" },
  coreweave:    { cat: "Neocloud",    color: "#3b82f6", status: "live" },
  lambda:       { cat: "Neocloud",    color: "#3b82f6", status: "live" },
  "lambda labs":{ cat: "Neocloud",    color: "#3b82f6", status: "live" },
  nebius:       { cat: "Neocloud",    color: "#3b82f6", status: "live" },
  tensordock:   { cat: "Marketplace", color: "#8b5cf6", status: "live" },
  oci:          { cat: "Hyperscaler", color: "#f59e0b", status: "live" },
  "oracle cloud":{ cat: "Hyperscaler",color: "#f59e0b", status: "live" },
  paperspace:   { cat: "Neocloud",    color: "#3b82f6", status: "live" },
  crusoe:       { cat: "Neocloud",    color: "#3b82f6", status: "live" },
  "crusoe energy":{ cat: "Neocloud",  color: "#3b82f6", status: "live" },
  fluidstack:   { cat: "Marketplace", color: "#8b5cf6", status: "live" },
  ibm:          { cat: "Hyperscaler", color: "#f59e0b", status: "live" },
  "ibm cloud":  { cat: "Hyperscaler", color: "#f59e0b", status: "live" },
  gmi:          { cat: "Neocloud",    color: "#3b82f6", status: "live" },
  "gmi cloud":  { cat: "Neocloud",    color: "#3b82f6", status: "live" },
  voltagepark:  { cat: "Neocloud",    color: "#3b82f6", status: "live" },
  "voltage park": { cat: "Neocloud",  color: "#3b82f6", status: "live" },
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
  { slug: "vastai",      name: "vast.ai",       cat: "Marketplace", status: "partial" },
  { slug: "ibm",         name: "IBM Cloud",     cat: "Hyperscaler", status: "live" },
  { slug: "gmi",         name: "GMI Cloud",     cat: "Neocloud",    status: "live" },
  { slug: "voltagepark", name: "VoltagePark",   cat: "Neocloud",    status: "live" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const getMeta = (p: string) => PROVIDER_META[p.toLowerCase()] || { cat: "Unknown", color: "#555", status: "unknown" };
const getSlug = (p: string) => p.toLowerCase().replace(/[\s.]/g, "").replace("googlecloud", "gcp").replace("lambdalabs", "lambda").replace("oraclecloud", "oci").replace("crusodenergy", "crusoe");
const fmt = (n: number, d = 2) => n.toFixed(d);
const minsAgo = (iso?: string) => {
  if (!iso) return null;
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
};
const catColor = (c: string) => c === "Hyperscaler" ? "#f59e0b" : c === "Neocloud" ? "#3b82f6" : c === "Marketplace" ? "#8b5cf6" : "#555";
const statusColor = (s: string) => s === "live" ? "#00d084" : s === "partial" ? "#f59e0b" : s === "pending" ? "#444" : "#ef4444";
const availColor = (a: string) => a === "high" ? "#00d084" : a === "medium" ? "#f59e0b" : "#ef4444";

// ── Small components ──────────────────────────────────────────────────────────

const PulseDot = ({ color = "#00d084" }) => (
  <span style={{ position: "relative", display: "inline-flex", width: 7, height: 7, flexShrink: 0 }}>
    <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color, animation: "ping 1.5s ease-in-out infinite", opacity: 0.5 }} />
    <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, position: "relative" }} />
  </span>
);

const Badge = ({ label, color }: { label: string; color: string }) => (
  <span style={{ ...MONO, ...UPPER, fontSize: 9, color, background: `${color}15`, border: `1px solid ${color}30`, padding: "1px 5px", borderRadius: 2, whiteSpace: "nowrap" as const }}>
    {label}
  </span>
);

const SortBtn = ({ active, dir }: { active: boolean; dir: "asc" | "desc" }) => (
  <span style={{ marginLeft: 3, fontSize: 8, color: active ? "#00d084" : "#2a2a2a" }}>
    {active ? (dir === "asc" ? "▲" : "▼") : "⇅"}
  </span>
);

// ── Market Tape ───────────────────────────────────────────────────────────────

function MarketTape({ listings }: { listings: GpuListing[] }) {
  const items = useMemo(() => {
    const counts: Record<string, number> = {};
    listings.forEach(l => { counts[l.provider] = (counts[l.provider] || 0) + 1; });
    const base = Object.entries(counts).sort((a, b) => b[1] - a[1])
      .map(([p, c]) => `${p.toUpperCase()}  ${c} listings`);
    const h100 = listings.filter(l => l.gpu_model.includes("H100") && l.pricing_type === "spot");
    if (h100.length) base.push(`H100 SPOT FROM $${fmt(Math.min(...h100.map(l => l.price_per_hour)))}/HR`);
    const a100 = listings.filter(l => l.gpu_model.includes("A100") && l.pricing_type === "spot");
    if (a100.length) base.push(`A100 SPOT FROM $${fmt(Math.min(...a100.map(l => l.price_per_hour)))}/HR`);
    base.push(`${listings.length} LISTINGS INDEXED`, "AI COMPUTE MARKET · LIVE");
    return [...base, ...base]; // doubled for seamless loop
  }, [listings]);

  return (
    <div style={{ overflow: "hidden", height: 26, display: "flex", alignItems: "center", background: "#050505", borderBottom: "1px solid #111" }}>
      <div style={{ display: "flex", whiteSpace: "nowrap", animation: "tape 50s linear infinite" }}>
        {items.map((item, i) => (
          <span key={i} style={{ ...MONO, fontSize: 10, color: "#333", padding: "0 20px", borderRight: "1px solid #111" }}>
            <span style={{ color: "#00d084", marginRight: 8 }}>◆</span>{item}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Metric Card ───────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, color = "#00d084", spark }: { label: string; value: string; sub?: string; color?: string; spark?: number[] }) {
  const w = 48, h = 18;
  const sparkPath = useMemo(() => {
    if (!spark || spark.length < 2) return null;
    const min = Math.min(...spark), max = Math.max(...spark), range = max - min || 1;
    return spark.map((v, i) => `${(i / (spark.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  }, [spark]);

  return (
    <div style={{ padding: "14px 16px", background: "#0c0c0c", borderRight: "1px solid #111", borderBottom: "1px solid #111", position: "relative", overflow: "hidden", cursor: "default" }}>
      <div style={{ ...MONO, ...UPPER, fontSize: 9, color: "#383838", marginBottom: 6 }}>{label}</div>
      <div style={{ ...MONO, fontSize: 20, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#383838", marginTop: 5 }}>{sub}</div>}
      {sparkPath && (
        <svg width={w} height={h} style={{ position: "absolute", bottom: 10, right: 12, opacity: 0.3 }}>
          <polyline points={sparkPath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

// ── Signal Card ───────────────────────────────────────────────────────────────

function SignalCard({ icon, text, sub, type = "info" }: { icon: string; text: string; sub?: string; type?: "info" | "warn" | "success" | "pending" }) {
  const c = { info: "#3b82f6", warn: "#f59e0b", success: "#00d084", pending: "#444" }[type];
  return (
    <div style={{ background: `${c}08`, border: `1px solid ${c}20`, borderLeft: `3px solid ${c}`, padding: "10px 14px", flex: "1 1 200px", minWidth: 180 }}>
      <div style={{ ...MONO, ...UPPER, fontSize: 9, color: "#383838", marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 12, color: "#aaa", lineHeight: 1.4 }}>{text}</div>
      {sub && <div style={{ fontSize: 10, color: "#444", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ── Price Range Chart ─────────────────────────────────────────────────────────

function PriceChart({ listings }: { listings: GpuListing[] }) {
  const rows = useMemo(() => {
    const families = ["H100 SXM5", "H100 PCIe", "A100 SXM", "A100 PCIe", "L40S", "A10G"];
    return families.map(f => {
      const [gpu, variant] = f.split(" ");
      const ls = listings.filter(l => l.gpu_model.includes(gpu) && (!variant || l.gpu_model.includes(variant)));
      if (!ls.length) return null;
      const prices = ls.map(l => l.price_per_hour);
      return { label: f, min: Math.min(...prices), max: Math.max(...prices), count: ls.length };
    }).filter(Boolean) as { label: string; min: number; max: number; count: number }[];
  }, [listings]);

  if (!rows.length) return null;
  const absMax = Math.max(...rows.map(d => d.max));

  return (
    <div>
      <div style={{ ...MONO, ...UPPER, fontSize: 9, color: "#383838", marginBottom: 14 }}>Price spread · $/hr</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {rows.map(d => (
          <div key={d.label} style={{ display: "grid", gridTemplateColumns: "80px 1fr 80px", gap: 10, alignItems: "center" }}>
            <div style={{ ...MONO, fontSize: 10, color: "#555", textAlign: "right" }}>{d.label}</div>
            <div style={{ height: 6, background: "#111", borderRadius: 2, position: "relative" }}>
              <div style={{ position: "absolute", left: `${(d.min / absMax) * 100}%`, width: `${Math.max(((d.max - d.min) / absMax) * 100, 2)}%`, height: "100%", background: "linear-gradient(90deg,#00d084,#3b82f6)", borderRadius: 2 }} />
            </div>
            <div style={{ ...MONO, fontSize: 10, color: "#444" }}>${fmt(d.min)}–${fmt(d.max)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Provider Chart ────────────────────────────────────────────────────────────

function ProviderChart({ listings }: { listings: GpuListing[] }) {
  const rows = useMemo(() => {
    const counts: Record<string, number> = {};
    listings.forEach(l => { counts[l.provider] = (counts[l.provider] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [listings]);

  if (!rows.length) return null;
  const max = rows[0][1];

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ ...MONO, ...UPPER, fontSize: 9, color: "#383838", marginBottom: 14 }}>Listings by provider</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {rows.map(([p, n]) => (
          <div key={p} style={{ display: "grid", gridTemplateColumns: "90px 1fr 32px", gap: 8, alignItems: "center" }}>
            <div style={{ ...MONO, fontSize: 10, color: "#555", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p}</div>
            <div style={{ height: 5, background: "#111", borderRadius: 2 }}>
              <div style={{ height: "100%", width: `${(n / max) * 100}%`, background: getMeta(p).color, borderRadius: 2 }} />
            </div>
            <div style={{ ...MONO, fontSize: 10, color: "#444" }}>{n}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Coverage Matrix ───────────────────────────────────────────────────────────

function CoverageMatrix({ listings }: { listings: GpuListing[] }) {
  const [showPending, setShowPending] = useState(false);

  const gpuMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    listings.forEach(l => {
      const slug = getSlug(l.provider);
      if (!map[slug]) map[slug] = new Set();
      GPU_COLS.forEach(g => { if (l.gpu_model.toUpperCase().includes(g)) map[slug].add(g); });
    });
    return map;
  }, [listings]);

  const rows = showPending ? ALL_PROVIDERS : ALL_PROVIDERS.filter(p => p.status !== "pending");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ ...MONO, ...UPPER, fontSize: 9, color: "#383838" }}>Coverage matrix</div>
        <button onClick={() => setShowPending(p => !p)} style={{ ...MONO, fontSize: 9, color: "#444", background: "none", border: "1px solid #1a1a1a", padding: "2px 8px", cursor: "pointer" }}>
          {showPending ? "Hide pending" : "Show pending"}
        </button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #111" }}>
              <th style={{ ...TH_STYLE, width: 120 }}>Provider</th>
              <th style={{ ...TH_STYLE }}>Category</th>
              {GPU_COLS.map(g => <th key={g} style={{ ...TH_STYLE, textAlign: "center" as const }}>{g}</th>)}
              <th style={{ ...TH_STYLE, textAlign: "center" as const }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(p => {
              const gpus = gpuMap[p.slug] || new Set();
              return (
                <tr key={p.slug} style={{ borderBottom: "1px solid #0e0e0e" }}>
                  <td style={{ ...MONO, padding: "7px 12px 7px 0", fontSize: 11, color: gpus.size ? "#bbb" : "#444" }}>{p.name}</td>
                  <td style={{ padding: "7px 12px 7px 0" }}><Badge label={p.cat} color={catColor(p.cat)} /></td>
                  {GPU_COLS.map(g => (
                    <td key={g} style={{ textAlign: "center", padding: "7px 8px" }}>
                      {p.status === "pending" ? <span style={{ color: "#222" }}>—</span>
                        : gpus.has(g) ? <span style={{ color: "#00d084" }}>✓</span>
                        : <span style={{ color: "#1e1e1e" }}>·</span>}
                    </td>
                  ))}
                  <td style={{ textAlign: "center", padding: "7px 0" }}><Badge label={p.status} color={statusColor(p.status)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Workload Finder ───────────────────────────────────────────────────────────

function WorkloadFinder({ listings }: { listings: GpuListing[] }) {
  const [gpu, setGpu] = useState("H100");
  const [spot, setSpot] = useState(true);

  const recs = useMemo(() => {
    const ls = listings.filter(l => l.gpu_model.includes(gpu));
    if (!ls.length) return null;
    const spotLs = ls.filter(l => l.pricing_type === "spot").sort((a, b) => a.price_per_hour - b.price_per_hour);
    const onDemLs = ls.filter(l => l.pricing_type === "on-demand").sort((a, b) => a.price_per_hour - b.price_per_hour);
    const highLs = ls.filter(l => l.availability === "high").sort((a, b) => a.price_per_hour - b.price_per_hour);
    return [
      { label: "Cheapest", listing: spotLs[0] || onDemLs[0], color: "#00d084" },
      { label: "Reliable", listing: highLs[0], color: "#3b82f6" },
      ...(spot && spotLs[0] ? [{ label: "Best Spot", listing: spotLs[0], color: "#8b5cf6" }] : []),
    ].filter(r => r.listing);
  }, [listings, gpu, spot]);

  return (
    <div style={{ border: "1px solid #141414", marginTop: 40 }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid #141414", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#ccc", letterSpacing: "-0.01em" }}>Find the best compute for your workload.</div>
          <div style={{ fontSize: 11, color: "#383838", marginTop: 2 }}>Match GPU supply to your requirements.</div>
        </div>
        <Badge label="Preview" color="#3b82f6" />
      </div>
      <div style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginBottom: 12, alignItems: "center" }}>
          {["H100", "A100", "L40S", "A10G"].map(g => (
            <button key={g} onClick={() => setGpu(g)} style={{ ...MONO, fontSize: 11, padding: "4px 10px", border: `1px solid ${gpu === g ? "#00d084" : "#1a1a1a"}`, background: gpu === g ? "#00d08415" : "none", color: gpu === g ? "#00d084" : "#555", cursor: "pointer" }}>
              {g}
            </button>
          ))}
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#444", cursor: "pointer", ...MONO }}>
            <input type="checkbox" checked={spot} onChange={e => setSpot(e.target.checked)} style={{ accentColor: "#00d084" }} />
            Spot OK
          </label>
        </div>
        {recs ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8 }}>
            {recs.map(r => r.listing && (
              <div key={r.label} style={{ background: "#0c0c0c", border: `1px solid ${r.color}20`, padding: "12px 14px" }}>
                <div style={{ ...MONO, ...UPPER, fontSize: 9, color: r.color, marginBottom: 6 }}>{r.label}</div>
                <div style={{ ...MONO, fontSize: 18, fontWeight: 700, color: r.color }}>${fmt(r.listing.price_per_hour)}/hr</div>
                <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>{r.listing.provider}</div>
                <div style={{ fontSize: 10, color: "#383838" }}>{r.listing.gpu_model} · {r.listing.region}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ ...MONO, fontSize: 12, color: "#383838" }}>No {gpu} listings available.</div>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DashboardClient({ summary, listings }: Props) {
  const [gpuFamily, setGpuFamily] = useState("All");
  const [search, setSearch] = useState("");
  const [provFilter, setProvFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [availFilter, setAvailFilter] = useState("all");
  const [sortKey, setSortKey] = useState<"price"|"gpu"|"provider"|"avail">("price");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("asc");
  const [grouped, setGrouped] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const updatedAgo = minsAgo(summary?.last_updated);
  const providers = useMemo(() => [...new Set(listings.map(l => l.provider))].sort(), [listings]);

  const filtered = useMemo(() => {
    let r = listings;
    if (gpuFamily !== "All") r = r.filter(l => l.gpu_model.toUpperCase().includes(gpuFamily.toUpperCase()));
    if (search) { const q = search.toLowerCase(); r = r.filter(l => l.gpu_model.toLowerCase().includes(q) || l.provider.toLowerCase().includes(q) || l.region.toLowerCase().includes(q)); }
    if (provFilter !== "all") r = r.filter(l => l.provider === provFilter);
    if (catFilter !== "all") r = r.filter(l => getMeta(l.provider).cat === catFilter);
    if (typeFilter !== "all") r = r.filter(l => l.pricing_type === typeFilter);
    if (availFilter !== "all") r = r.filter(l => l.availability === availFilter);
    return [...r].sort((a, b) => {
      const [av, bv] = sortKey === "price" ? [a.price_per_hour, b.price_per_hour]
        : sortKey === "avail" ? [a.availability, b.availability]
        : sortKey === "provider" ? [a.provider, b.provider]
        : [a.gpu_model, b.gpu_model];
      return sortDir === "asc" ? (av < bv ? -1 : av > bv ? 1 : 0) : (av > bv ? -1 : av < bv ? 1 : 0);
    });
  }, [listings, gpuFamily, search, provFilter, catFilter, typeFilter, availFilter, sortKey, sortDir]);

  const groupMap = useMemo(() => {
    const m = new Map<string, GpuListing[]>();
    filtered.forEach(l => { if (!m.has(l.gpu_model)) m.set(l.gpu_model, []); m.get(l.gpu_model)!.push(l); });
    return [...m.entries()].sort((a, b) => Math.min(...a[1].map(l => l.price_per_hour)) - Math.min(...b[1].map(l => l.price_per_hour)));
  }, [filtered]);

  const signals = useMemo(() => {
    if (!listings.length) return [];
    const counts: Record<string, number> = {};
    listings.forEach(l => { counts[l.provider] = (counts[l.provider] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const h100s = listings.filter(l => l.gpu_model.includes("H100") && l.pricing_type === "spot");
    const pending = ALL_PROVIDERS.filter(p => p.status === "pending");
    const partial = ALL_PROVIDERS.filter(p => p.status === "partial");
    return [
      { icon: "Supply Leader", text: `${top[0]} leads: ${top[1]} listings`, type: "info" as const },
      ...(h100s.length >= 2 ? [{
        icon: "Price Spread", type: "warn" as const,
        text: `H100 spot: $${fmt(Math.min(...h100s.map(l => l.price_per_hour)))} – $${fmt(Math.max(...h100s.map(l => l.price_per_hour)))}/hr`,
        sub: `${h100s.length} listings`,
      }] : []),
      ...(h100s.length ? [{ icon: "Best Entry", text: `H100 from $${fmt(Math.min(...h100s.map(l => l.price_per_hour)))}/hr`, type: "success" as const }] : []),
      ...(pending.length ? [{ icon: "Coverage Gap", text: `${pending.length} providers pending`, sub: pending.map(p => p.name).join(", "), type: "pending" as const }] : []),
      ...(partial.length ? [{ icon: "Partial", text: `${partial.map(p => p.name).join(", ")} — normalization needed`, type: "warn" as const }] : []),
    ];
  }, [listings]);

  const h100Prices = listings.filter(l => l.gpu_model.includes("H100") && l.pricing_type === "spot").map(l => l.price_per_hour).sort((a, b) => a - b);
  const a100Prices = listings.filter(l => l.gpu_model.includes("A100") && l.pricing_type === "spot").map(l => l.price_per_hour).sort((a, b) => a - b);

  const toggleSort = (k: typeof sortKey) => { if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortKey(k); setSortDir("asc"); } };
  const toggleExpand = (gpu: string) => setExpanded(prev => { const n = new Set(prev); n.has(gpu) ? n.delete(gpu) : n.add(gpu); return n; });

  const liveCt = ALL_PROVIDERS.filter(p => p.status === "live").length;
  const partialCt = ALL_PROVIDERS.filter(p => p.status === "partial").length;
  const pendingCt = ALL_PROVIDERS.filter(p => p.status === "pending").length;

  return (
    <div style={{ minHeight: "100vh", background: "#080808", color: "#d0d0d0", fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif" }}>
      <style>{`
        @keyframes ping{0%{transform:scale(1);opacity:.5}75%,100%{transform:scale(2.2);opacity:0}}
        @keyframes tape{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        .row:hover{background:#0e0e0e!important}
        .th-btn:hover{color:#777!important;cursor:pointer}
        select option{background:#111;color:#888}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:#1e1e1e;border-radius:2px}
        input::placeholder{color:#2a2a2a}
      `}</style>

      <MarketTape listings={listings} />

      {/* Header */}
      <header style={{ borderBottom: "1px solid #111", background: "#080808" }}>
        <div style={{ maxWidth: 1440, margin: "0 auto", padding: "0 24px", height: 50, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 16, height: 16, background: "linear-gradient(135deg,#00d084,#3b82f6)", borderRadius: 3, flexShrink: 0 }} />
              <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.03em", color: "#fff" }}>AIInfraWatch</span>
            </div>
            <div style={{ width: 1, height: 14, background: "#1a1a1a" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <PulseDot />
              <span style={{ ...MONO, fontSize: 10, color: "#00d084", letterSpacing: "0.04em" }}>AI Compute Market · Live</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", gap: 6 }}>
              {liveCt > 0 && <Badge label={`${liveCt} live`} color="#00d084" />}
              {partialCt > 0 && <Badge label={`${partialCt} partial`} color="#f59e0b" />}
              {pendingCt > 0 && <Badge label={`${pendingCt} pending`} color="#444" />}
            </div>
            <div style={{ width: 1, height: 14, background: "#1a1a1a" }} />
            <div style={{ textAlign: "right" as const }}>
              <div style={{ ...MONO, fontSize: 13, fontWeight: 600, color: "#bbb" }}>{listings.length}</div>
              <div style={{ ...MONO, ...UPPER, fontSize: 9, color: "#383838" }}>listings</div>
            </div>
            <div style={{ textAlign: "right" as const }}>
              <div style={{ ...MONO, fontSize: 13, fontWeight: 600, color: "#bbb" }}>{summary?.active_providers || providers.length}</div>
              <div style={{ ...MONO, ...UPPER, fontSize: 9, color: "#383838" }}>providers</div>
            </div>
            {updatedAgo && <div style={{ ...MONO, fontSize: 10, color: "#333" }}>Updated {updatedAgo}</div>}
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "0 24px" }}>

        {/* Hero */}
        <div style={{ padding: "24px 0 18px", borderBottom: "1px solid #0e0e0e" }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.04em", color: "#e0e0e0", lineHeight: 1.2 }}>The AI Compute Market, Live.</div>
          <div style={{ fontSize: 12, color: "#383838", marginTop: 5 }}>Track GPU prices, freshness, and coverage across hyperscalers, neoclouds, and marketplaces. See the spread before you buy.</div>
        </div>

        {/* Metric cards */}
        {summary && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", borderTop: "1px solid #111", borderLeft: "1px solid #111", margin: "1px 0" }}>
            {[
              { label: "H100 Spot Avg",    value: summary.h100_spot_avg > 0 ? `$${fmt(summary.h100_spot_avg)}/hr` : "N/A", sub: `${h100Prices.length} spot listings`, color: "#00d084", spark: h100Prices.slice(0,8) },
              { label: "A100 Spot Avg",    value: summary.a100_spot_avg > 0 ? `$${fmt(summary.a100_spot_avg)}/hr` : "N/A", sub: `${a100Prices.length} spot listings`, color: "#3b82f6", spark: a100Prices.slice(0,8) },
              { label: "Cheapest H100",    value: h100Prices.length ? `$${fmt(Math.min(...h100Prices))}/hr` : "N/A",    sub: "Spot market", color: "#00d084" },
              { label: "Cheapest A100",    value: a100Prices.length ? `$${fmt(Math.min(...a100Prices))}/hr` : "N/A",    sub: "Spot market", color: "#3b82f6" },
              { label: "Active Providers", value: String(summary.active_providers), sub: `${pendingCt} pending`, color: "#f59e0b" },
              { label: "Total Listings",   value: String(listings.length || summary.total_listings), sub: "Last 25 hours", color: "#aaa" },
            ].map(c => <MetricCard key={c.label} {...c} />)}
          </div>
        )}

        {/* Signals */}
        {signals.length > 0 && (
          <div style={{ margin: "18px 0" }}>
            <div style={{ ...MONO, ...UPPER, fontSize: 9, color: "#2a2a2a", marginBottom: 10 }}>Market signals</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
              {signals.map((s, i) => <SignalCard key={i} {...s} />)}
            </div>
          </div>
        )}

        {/* GPU tabs + filters */}
        <div style={{ borderBottom: "1px solid #111", display: "flex", alignItems: "center", gap: 0, overflowX: "auto" }}>
          {GPU_FAMILIES.map(f => (
            <button key={f} onClick={() => setGpuFamily(f)} style={{ ...MONO, fontSize: 11, padding: "9px 14px", background: "none", border: "none", borderBottom: gpuFamily === f ? "2px solid #00d084" : "2px solid transparent", color: gpuFamily === f ? "#00d084" : "#444", cursor: "pointer", whiteSpace: "nowrap", marginBottom: -1 }}>
              {f}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <label style={{ display: "flex", alignItems: "center", gap: 5, ...MONO, fontSize: 10, color: "#383838", cursor: "pointer", padding: "0 12px", whiteSpace: "nowrap" }}>
            <input type="checkbox" checked={grouped} onChange={e => setGrouped(e.target.checked)} style={{ accentColor: "#00d084" }} />
            Group
          </label>
        </div>

        <div style={{ display: "flex", gap: 8, padding: "10px 0", flexWrap: "wrap" as const, alignItems: "center", borderBottom: "1px solid #0e0e0e" }}>
          <input placeholder="Search GPU, provider, region…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...MONO, background: "#0c0c0c", border: "1px solid #161616", color: "#777", padding: "5px 10px", fontSize: 11, outline: "none", width: 200 }} />
          {[
            { v: provFilter, set: setProvFilter, opts: [["all","All Providers"], ...providers.map(p => [p,p])] },
            { v: catFilter,  set: setCatFilter,  opts: [["all","All Categories"],["Hyperscaler","Hyperscaler"],["Neocloud","Neocloud"],["Marketplace","Marketplace"]] },
            { v: typeFilter, set: setTypeFilter, opts: [["all","All Types"],["spot","Spot"],["on-demand","On-demand"],["reserved-1yr","Reserved"]] },
            { v: availFilter,set: setAvailFilter,opts: [["all","All Avail"],["high","High"],["medium","Medium"],["low","Low"]] },
          ].map((s, i) => (
            <select key={i} value={s.v} onChange={e => s.set(e.target.value)}
              style={{ ...MONO, background: "#0c0c0c", border: "1px solid #161616", color: "#555", padding: "5px 8px", fontSize: 11, outline: "none", cursor: "pointer" }}>
              {s.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ))}
          <div style={{ flex: 1 }} />
          <span style={{ ...MONO, fontSize: 10, color: "#2a2a2a" }}>{filtered.length} listings</span>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #111" }}>
                {grouped && <th style={{ width: 16, padding: "8px 8px 8px 0" }} />}
                <th className="th-btn" onClick={() => toggleSort("gpu")} style={{ ...TH_STYLE }}>GPU <SortBtn active={sortKey==="gpu"} dir={sortDir} /></th>
                <th className="th-btn" onClick={() => toggleSort("provider")} style={{ ...TH_STYLE }}>Provider <SortBtn active={sortKey==="provider"} dir={sortDir} /></th>
                <th style={{ ...TH_STYLE }}>Category</th>
                <th style={{ ...TH_STYLE }}>Region</th>
                <th style={{ ...TH_STYLE }}>Type</th>
                <th className="th-btn" onClick={() => toggleSort("price")} style={{ ...TH_STYLE, textAlign: "right" as const }}>$/hr <SortBtn active={sortKey==="price"} dir={sortDir} /></th>
                <th className="th-btn" onClick={() => toggleSort("avail")} style={{ ...TH_STYLE }}>Avail <SortBtn active={sortKey==="avail"} dir={sortDir} /></th>
                <th style={{ ...TH_STYLE }}>Status</th>
                <th style={{ ...TH_STYLE, paddingRight: 0 }}>Freshness</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={grouped ? 10 : 9} style={{ ...MONO, padding: "3rem 0", color: "#2a2a2a", textAlign: "center", fontSize: 12 }}>No listings match filters</td></tr>
              ) : grouped ? (
                groupMap.flatMap(([gpu, rows]) => {
                  const isOpen = expanded.has(gpu);
                  const cheapest = Math.min(...rows.map(r => r.price_per_hour));
                  const provSet = new Set(rows.map(r => r.provider));
                  return [
                    <tr key={`g-${gpu}`} className="row" onClick={() => toggleExpand(gpu)}
                      style={{ borderBottom: "1px solid #0e0e0e", background: "#0a0a0a", cursor: "pointer" }}>
                      <td style={{ ...MONO, padding: "10px 8px 10px 0", fontSize: 9, color: "#2a2a2a" }}>{isOpen ? "▼" : "▶"}</td>
                      <td style={{ ...MONO, padding: "10px 12px 10px 0", fontWeight: 600, color: "#bbb", fontSize: 12 }}>{gpu}</td>
                      <td style={{ padding: "10px 12px 10px 0", fontSize: 11, color: "#444" }}>{[...provSet].slice(0,3).join(", ")}{provSet.size > 3 ? ` +${provSet.size-3}` : ""}</td>
                      <td style={{ padding: "10px 12px 10px 0" }} />
                      <td style={{ ...MONO, padding: "10px 12px 10px 0", fontSize: 10, color: "#333" }}>{rows.length} listings · {provSet.size} providers</td>
                      <td /><td style={{ ...MONO, padding: "10px 12px 10px 0", textAlign: "right", fontWeight: 700, color: "#00d084", fontSize: 13 }}>from ${fmt(cheapest)}</td>
                      <td colSpan={3} />
                    </tr>,
                    ...(isOpen ? rows.map((l, i) => {
                      const meta = getMeta(l.provider);
                      return (
                        <tr key={`${gpu}-${i}`} className="row" style={{ borderBottom: "1px solid #0c0c0c", background: "#090909" }}>
                          <td />
                          <td style={{ ...MONO, padding: "7px 12px 7px 16px", fontSize: 11, color: "#666" }}>└ {l.gpu_model}</td>
                          <td style={{ padding: "7px 12px 7px 0", fontSize: 11, color: "#555" }}>{l.provider}</td>
                          <td style={{ padding: "7px 12px 7px 0" }}><Badge label={meta.cat} color={catColor(meta.cat)} /></td>
                          <td style={{ ...MONO, padding: "7px 12px 7px 0", fontSize: 11, color: "#3a3a3a" }}>{l.region}</td>
                          <td style={{ ...MONO, padding: "7px 12px 7px 0", fontSize: 11, color: "#3a3a3a" }}>{l.pricing_type}</td>
                          <td style={{ ...MONO, padding: "7px 12px 7px 0", textAlign: "right", fontWeight: 600, color: "#00d084", fontSize: 12 }}>${fmt(l.price_per_hour)}</td>
                          <td style={{ padding: "7px 12px 7px 0" }}><Badge label={l.availability} color={availColor(l.availability)} /></td>
                          <td style={{ padding: "7px 12px 7px 0" }}><Badge label={meta.status} color={statusColor(meta.status)} /></td>
                          <td style={{ ...MONO, padding: "7px 0", fontSize: 10, color: "#2a2a2a" }}>{minsAgo(l.fetched_at) || "—"}</td>
                        </tr>
                      );
                    }) : []),
                  ];
                })
              ) : (
                filtered.map((l, i) => {
                  const meta = getMeta(l.provider);
                  return (
                    <tr key={i} className="row" style={{ borderBottom: "1px solid #0c0c0c" }}>
                      <td style={{ ...MONO, padding: "8px 12px 8px 0", fontSize: 12, color: "#aaa" }}>{l.gpu_model}</td>
                      <td style={{ padding: "8px 12px 8px 0", fontSize: 12, color: "#555" }}>{l.provider}</td>
                      <td style={{ padding: "8px 12px 8px 0" }}><Badge label={meta.cat} color={catColor(meta.cat)} /></td>
                      <td style={{ ...MONO, padding: "8px 12px 8px 0", fontSize: 11, color: "#3a3a3a" }}>{l.region}</td>
                      <td style={{ ...MONO, padding: "8px 12px 8px 0", fontSize: 11, color: "#3a3a3a" }}>{l.pricing_type}</td>
                      <td style={{ ...MONO, padding: "8px 12px 8px 0", textAlign: "right", fontWeight: 600, color: "#00d084", fontSize: 13 }}>${fmt(l.price_per_hour)}</td>
                      <td style={{ padding: "8px 12px 8px 0" }}><Badge label={l.availability} color={availColor(l.availability)} /></td>
                      <td style={{ padding: "8px 12px 8px 0" }}><Badge label={meta.status} color={statusColor(meta.status)} /></td>
                      <td style={{ ...MONO, padding: "8px 0", fontSize: 10, color: "#2a2a2a" }}>{minsAgo(l.fetched_at) || "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Charts + Matrix */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginTop: 40, paddingBottom: 40 }}>
          <div>
            <PriceChart listings={listings} />
            <ProviderChart listings={listings} />
          </div>
          <CoverageMatrix listings={listings} />
        </div>

        <WorkloadFinder listings={listings} />

        {/* Footer */}
        <div style={{ borderTop: "1px solid #0e0e0e", padding: "18px 0", marginTop: 32, display: "flex", justifyContent: "space-between" }}>
          <div style={{ ...MONO, fontSize: 10, color: "#2a2a2a" }}>AIInfraWatch · AI compute is a fragmented live market.</div>
          <div style={{ ...MONO, fontSize: 10, color: "#2a2a2a" }}>{listings.length} listings · {updatedAgo || "live"}</div>
        </div>
      </div>
    </div>
  );
}
