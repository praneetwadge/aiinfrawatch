"use client";

import { useState, useMemo } from "react";
import type { GpuListing, EnergyPrice, LatencyBenchmark, MarketSummary } from "@/types";

interface Props {
  summary: MarketSummary | null;
  listings: GpuListing[];
  energy: EnergyPrice[];
  latency: LatencyBenchmark[];
}

const TABS = ["GPU Prices", "Energy & Grid", "Latency", "API Docs"] as const;
type Tab = (typeof TABS)[number];

function Delta({ value }: { value: number }) {
  if (!value) return <span style={{ color: "#555" }}>—</span>;
  const color = value > 0 ? "#ef4444" : "#00d084";
  const arrow = value > 0 ? "↑" : "↓";
  return <span style={{ color, fontSize: 12 }}>{arrow} {Math.abs(value).toFixed(1)}%</span>;
}

function AvailBadge({ avail }: { avail: string }) {
  const color = avail === "high" ? "#00d084" : avail === "medium" ? "#f59e0b" : "#ef4444";
  return (
    <span style={{
      display: "inline-block", padding: "1px 8px", borderRadius: 99,
      fontSize: 11, fontWeight: 500,
      background: `${color}18`, color,
    }}>
      {avail}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const isSpot = type === "spot";
  return (
    <span style={{
      display: "inline-block", padding: "1px 8px", borderRadius: 99,
      fontSize: 11, fontWeight: 500,
      background: isSpot ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.06)",
      color: isSpot ? "#3b82f6" : "#888",
    }}>
      {type}
    </span>
  );
}

export default function DashboardClient({ summary, listings, energy, latency }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("GPU Prices");
  const [gpuFilter, setGpuFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"price" | "provider" | "model">("price");

  const GPU_FILTERS = ["all", "H100", "A100", "L40S", "A10G"];
  const TYPE_FILTERS = ["all", "spot", "on-demand"];

  const filteredListings = useMemo(() => {
    return listings
      .filter((l) => gpuFilter === "all" || l.gpu_model.includes(gpuFilter))
      .filter((l) => typeFilter === "all" || l.pricing_type === typeFilter)
      .sort((a, b) => {
        if (sortBy === "price") return a.price_per_hour - b.price_per_hour;
        if (sortBy === "provider") return a.provider.localeCompare(b.provider);
        return a.gpu_model.localeCompare(b.gpu_model);
      });
  }, [listings, gpuFilter, typeFilter, sortBy]);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a" }}>

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "0 1.5rem",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 52,
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(10,10,10,0.92)", backdropFilter: "blur(12px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%", background: "#00d084",
            boxShadow: "0 0 8px #00d084",
            animation: "pulse 2s infinite",
            display: "inline-block",
          }} />
          <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: "-0.02em" }}>
            AIInfraWatch
          </span>
          <span style={{
            fontSize: 11, color: "#555", background: "#1a1a1a",
            padding: "2px 8px", borderRadius: 99, border: "1px solid rgba(255,255,255,0.06)",
          }}>
            market intelligence
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a
            href="/api/gpu-prices"
            style={{ fontSize: 12, color: "#555" }}
            title="Public API endpoint"
          >
            API
          </a>
          <a href="/api/gpu-prices?format=csv" style={{ fontSize: 12, color: "#555" }}>
            CSV Export
          </a>
          <span style={{ fontSize: 11, color: "#555" }}>
            {summary?.last_updated
              ? `Updated ${Math.floor((Date.now() - new Date(summary.last_updated).getTime()) / 1000)}s ago`
              : "Loading..."}
          </span>
        </div>
      </nav>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "1.5rem" }}>

        {/* ── Market Summary Cards ─────────────────────────────────────── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12, marginBottom: "1.5rem",
        }}>
          {[
            {
              label: "H100 Spot Avg",
              value: summary ? `$${summary.h100_spot_avg.toFixed(2)}` : "—",
              sub: <Delta value={summary?.h100_spot_change_24h ?? 0} />,
            },
            {
              label: "A100 Spot Avg",
              value: summary ? `$${summary.a100_spot_avg.toFixed(2)}` : "—",
              sub: <Delta value={summary?.a100_spot_change_24h ?? 0} />,
            },
            {
              label: "Cheapest H100",
              value: summary?.cheapest_h100 ? `$${summary.cheapest_h100.price_per_hour.toFixed(2)}` : "—",
              sub: <span style={{ color: "#555", fontSize: 11 }}>{summary?.cheapest_h100?.provider ?? ""}</span>,
            },
            {
              label: "Cheapest Energy",
              value: summary ? `$${summary.energy_cheapest_price.toFixed(3)}/kWh` : "—",
              sub: <span style={{ color: "#555", fontSize: 11 }}>{summary?.energy_cheapest_region ?? ""}</span>,
            },
            {
              label: "Best Latency",
              value: summary ? `${summary.latency_best_ms}ms` : "—",
              sub: <span style={{ color: "#555", fontSize: 11 }}>{summary?.latency_best_provider ?? ""}</span>,
            },
            {
              label: "Active Providers",
              value: summary?.active_providers ?? "—",
              sub: <span style={{ color: "#555", fontSize: 11 }}>{summary?.total_listings ?? 0} listings</span>,
            },
          ].map((card) => (
            <div key={card.label} style={{
              background: "#111", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 10, padding: "12px 14px",
            }}>
              <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                {card.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 600, color: "#f0f0f0", marginBottom: 4 }}>
                {card.value}
              </div>
              <div>{card.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────────── */}
        <div style={{
          display: "flex", gap: 2, marginBottom: "1.25rem",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: "none", border: "none", padding: "8px 16px",
                fontSize: 13, color: activeTab === tab ? "#f0f0f0" : "#555",
                fontWeight: activeTab === tab ? 500 : 400,
                borderBottom: `2px solid ${activeTab === tab ? "#00d084" : "transparent"}`,
                marginBottom: -1, cursor: "pointer", transition: "color 0.15s",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── GPU Prices Tab ───────────────────────────────────────────── */}
        {activeTab === "GPU Prices" && (
          <div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "1rem", alignItems: "center" }}>
              {GPU_FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setGpuFilter(f)}
                  style={{
                    background: gpuFilter === f ? "#f0f0f0" : "transparent",
                    color: gpuFilter === f ? "#000" : "#555",
                    border: "1px solid",
                    borderColor: gpuFilter === f ? "#f0f0f0" : "rgba(255,255,255,0.1)",
                    borderRadius: 99, padding: "3px 12px", fontSize: 12,
                  }}
                >
                  {f}
                </button>
              ))}
              <span style={{ color: "rgba(255,255,255,0.08)", margin: "0 4px" }}>|</span>
              {TYPE_FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setTypeFilter(f)}
                  style={{
                    background: typeFilter === f ? "#f0f0f0" : "transparent",
                    color: typeFilter === f ? "#000" : "#555",
                    border: "1px solid",
                    borderColor: typeFilter === f ? "#f0f0f0" : "rgba(255,255,255,0.1)",
                    borderRadius: 99, padding: "3px 12px", fontSize: 12,
                  }}
                >
                  {f}
                </button>
              ))}
              <span style={{ marginLeft: "auto", fontSize: 12, color: "#555" }}>
                {filteredListings.length} listings
              </span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {[
                      { key: "model",    label: "GPU Model" },
                      { key: "provider", label: "Provider" },
                      { key: null,       label: "Region" },
                      { key: null,       label: "Type" },
                      { key: "price",    label: "$/hr" },
                      { key: null,       label: "GPUs" },
                      { key: null,       label: "Avail" },
                    ].map(({ key, label }) => (
                      <th
                        key={label}
                        onClick={() => key && setSortBy(key as "price" | "provider" | "model")}
                        style={{
                          textAlign: "left", padding: "8px 12px 8px 0",
                          color: sortBy === key ? "#f0f0f0" : "#555",
                          fontSize: 11, fontWeight: 500,
                          textTransform: "uppercase", letterSpacing: "0.06em",
                          cursor: key ? "pointer" : "default",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {label} {key && sortBy === key ? "↑" : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredListings.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: "2rem 0", color: "#555", textAlign: "center" }}>
                        No listings yet — run the scraper or check your API keys
                      </td>
                    </tr>
                  ) : (
                    filteredListings.map((l, i) => (
                      <tr
                        key={`${l.provider}-${l.gpu_model}-${i}`}
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                          transition: "background 0.1s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#111")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "9px 12px 9px 0", fontWeight: 500 }}>{l.gpu_model}</td>
                        <td style={{ padding: "9px 12px 9px 0", color: "#888" }}>{l.provider}</td>
                        <td style={{ padding: "9px 12px 9px 0", color: "#555" }}>{l.region}</td>
                        <td style={{ padding: "9px 12px 9px 0" }}><TypeBadge type={l.pricing_type} /></td>
                        <td style={{ padding: "9px 12px 9px 0", fontWeight: 600, color: "#00d084", fontVariantNumeric: "tabular-nums" }}>
                          ${l.price_per_hour.toFixed(2)}
                        </td>
                        <td style={{ padding: "9px 12px 9px 0", color: "#555" }}>×{l.gpu_count}</td>
                        <td style={{ padding: "9px 12px 9px 0" }}><AvailBadge avail={l.availability} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Energy Tab ───────────────────────────────────────────────── */}
        {activeTab === "Energy & Grid" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "1rem 1.25rem" }}>
              <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "1rem" }}>
                Grid electricity cost
              </div>
              {energy.length === 0 ? (
                <p style={{ color: "#555" }}>No energy data — check EIA_API_KEY</p>
              ) : (
                energy.sort((a, b) => a.price_per_kwh - b.price_per_kwh).map((e) => (
                  <div key={e.region} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
                    fontSize: 13,
                  }}>
                    <span style={{ color: "#888" }}>{e.region}</span>
                    <span style={{ fontWeight: 600, color: "#00d084", fontVariantNumeric: "tabular-nums" }}>
                      ${e.price_per_kwh.toFixed(4)}/kWh
                    </span>
                  </div>
                ))
              )}
            </div>
            <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "1rem 1.25rem" }}>
              <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "1rem" }}>
                Carbon intensity (gCO₂/kWh)
              </div>
              {energy.sort((a, b) => a.carbon_intensity_gco2_kwh - b.carbon_intensity_gco2_kwh).map((e) => (
                <div key={e.region} style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
                    <span style={{ color: "#888" }}>{e.region}</span>
                    <span style={{ color: e.carbon_intensity_gco2_kwh < 100 ? "#00d084" : e.carbon_intensity_gco2_kwh < 200 ? "#f59e0b" : "#ef4444" }}>
                      {e.carbon_intensity_gco2_kwh}g
                    </span>
                  </div>
                  <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                    <div style={{
                      height: "100%", borderRadius: 2,
                      width: `${Math.min((e.carbon_intensity_gco2_kwh / 500) * 100, 100)}%`,
                      background: e.carbon_intensity_gco2_kwh < 100 ? "#00d084" : e.carbon_intensity_gco2_kwh < 200 ? "#f59e0b" : "#ef4444",
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Latency Tab ──────────────────────────────────────────────── */}
        {activeTab === "Latency" && (
          <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "1rem 1.25rem" }}>
            {latency.length === 0 ? (
              <p style={{ color: "#555" }}>Latency benchmarks run hourly. Check back soon.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {["Provider", "Region", "p50 ms", "p99 ms", "Bandwidth", "Score"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 12px 8px 0", color: "#555", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {latency.map((l) => (
                    <tr key={`${l.provider}-${l.region}`} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "9px 12px 9px 0", fontWeight: 500 }}>{l.provider}</td>
                      <td style={{ padding: "9px 12px 9px 0", color: "#555" }}>{l.region}</td>
                      <td style={{ padding: "9px 12px 9px 0", color: l.latency_p50_ms < 20 ? "#00d084" : l.latency_p50_ms < 40 ? "#f59e0b" : "#ef4444", fontWeight: 600 }}>
                        {l.latency_p50_ms}ms
                      </td>
                      <td style={{ padding: "9px 12px 9px 0", color: "#555" }}>{l.latency_p99_ms}ms</td>
                      <td style={{ padding: "9px 12px 9px 0", color: "#555" }}>{l.bandwidth_gbps}Gbps</td>
                      <td style={{ padding: "9px 12px 9px 0" }}>
                        <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, width: 80 }}>
                          <div style={{
                            height: "100%", borderRadius: 2,
                            width: `${Math.max(0, 100 - l.latency_p50_ms * 2)}%`,
                            background: "#00d084",
                          }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── API Docs Tab ─────────────────────────────────────────────── */}
        {activeTab === "API Docs" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {[
              {
                method: "GET", path: "/api/gpu-prices",
                desc: "All current GPU listings across providers",
                params: "gpu, provider, type, limit, format",
                example: "/api/gpu-prices?gpu=H100&type=spot&limit=20",
              },
              {
                method: "GET", path: "/api/energy",
                desc: "Current electricity prices by grid region with carbon intensity",
                params: "none",
                example: "/api/energy",
              },
              {
                method: "GET", path: "/api/providers",
                desc: "Market summary — averages, cheapest options, active provider count",
                params: "none",
                example: "/api/providers",
              },
            ].map((endpoint) => (
              <div key={endpoint.path} style={{
                background: "#111", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 10, padding: "1rem 1.25rem",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{
                    background: "rgba(0,208,132,0.12)", color: "#00d084",
                    fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                  }}>
                    {endpoint.method}
                  </span>
                  <code style={{ fontSize: 14, fontFamily: "monospace", color: "#f0f0f0" }}>
                    {endpoint.path}
                  </code>
                </div>
                <p style={{ color: "#888", fontSize: 13, marginBottom: 8 }}>{endpoint.desc}</p>
                <div style={{ background: "#0a0a0a", borderRadius: 6, padding: "8px 12px" }}>
                  <code style={{ fontSize: 12, color: "#555", fontFamily: "monospace" }}>
                    {process.env.NEXT_PUBLIC_APP_URL ?? "https://your-domain.com"}{endpoint.example}
                  </code>
                </div>
              </div>
            ))}
            <div style={{ background: "#111", border: "1px solid rgba(0,208,132,0.2)", borderRadius: 10, padding: "1rem 1.25rem" }}>
              <div style={{ fontSize: 13, color: "#00d084", fontWeight: 500, marginBottom: 6 }}>
                Built for AI agents
              </div>
              <p style={{ fontSize: 13, color: "#888" }}>
                All endpoints return structured JSON with metadata. No authentication required for read access.
                Rate limit: 1000 req/hr per IP. Add{" "}
                <code style={{ background: "#0a0a0a", padding: "1px 6px", borderRadius: 4, color: "#f0f0f0" }}>
                  Accept: application/json
                </code>{" "}
                header for explicit content negotiation.
              </p>
            </div>
          </div>
        )}

      </main>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
