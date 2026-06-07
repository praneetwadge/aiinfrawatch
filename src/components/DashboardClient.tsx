"use client";

import { useState, useMemo } from "react";

interface GpuListing {
  provider: string;
  gpu_model: string;
  gpu_count: number;
  pricing_type: string;
  price_per_hour: number;
  region: string;
  availability: string;
}

interface EnergyPrice {
  region: string;
  price_per_kwh: number;
  carbon_intensity_gco2_kwh: number;
}

interface LatencyBenchmark {
  provider: string;
  region: string;
  latency_p50_ms: number;
  bandwidth_gbps: number;
}

interface MarketSummary {
  h100_spot_avg: number;
  a100_spot_avg: number;
  active_providers: number;
  total_listings: number;
  energy_cheapest_region: string;
  energy_cheapest_price: number;
  last_updated: string;
}

interface Props {
  summary: MarketSummary | null;
  listings: GpuListing[];
  energy: EnergyPrice[];
  latency: LatencyBenchmark[];
}

export default function DashboardClient({ summary, listings }: Props) {
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(() => {
    return filter === "all"
      ? listings
      : listings.filter((l) => l.gpu_model.includes(filter));
  }, [listings, filter]);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f0f0f0", fontFamily: "system-ui" }}>
      <nav style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #222", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 600, fontSize: 16 }}>AIInfraWatch</span>
        <span style={{ fontSize: 12, color: "#555" }}>
          {summary ? `${summary.total_listings} listings · ${summary.active_providers} providers` : "Loading..."}
        </span>
      </nav>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "1.5rem" }}>
        {summary && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: "1.5rem" }}>
            {[
              { label: "H100 Spot Avg", val: `$${summary.h100_spot_avg.toFixed(2)}/hr` },
              { label: "A100 Spot Avg", val: `$${summary.a100_spot_avg.toFixed(2)}/hr` },
              { label: "Active Providers", val: summary.active_providers },
              { label: "Total Listings", val: summary.total_listings },
              { label: "Cheapest Energy", val: `$${summary.energy_cheapest_price.toFixed(3)}/kWh` },
            ].map((c) => (
              <div key={c.label} style={{ background: "#111", border: "1px solid #222", borderRadius: 8, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: "#00d084" }}>{c.val}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: "1rem", flexWrap: "wrap" }}>
          {["all", "H100", "A100", "L40S", "A10G"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                background: filter === f ? "#f0f0f0" : "transparent",
                color: filter === f ? "#000" : "#888",
                border: "1px solid #333",
                borderRadius: 99,
                padding: "3px 12px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {f}
            </button>
          ))}
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #222" }}>
              {["GPU", "Provider", "Region", "Type", "$/hr", "Avail"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "6px 12px 6px 0", color: "#555", fontSize: 11, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "2rem 0", color: "#555", textAlign: "center" }}>
                  No data yet — add env vars and trigger a scrape
                </td>
              </tr>
            ) : (
              filtered.map((l, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #161616" }}>
                  <td style={{ padding: "8px 12px 8px 0", fontWeight: 500 }}>{l.gpu_model}</td>
                  <td style={{ padding: "8px 12px 8px 0", color: "#888" }}>{l.provider}</td>
                  <td style={{ padding: "8px 12px 8px 0", color: "#555" }}>{l.region}</td>
                  <td style={{ padding: "8px 12px 8px 0", color: "#555" }}>{l.pricing_type}</td>
                  <td style={{ padding: "8px 12px 8px 0", fontWeight: 600, color: "#00d084" }}>${l.price_per_hour.toFixed(2)}</td>
                  <td style={{ padding: "8px 12px 8px 0", color: l.availability === "high" ? "#00d084" : l.availability === "medium" ? "#f59e0b" : "#ef4444" }}>{l.availability}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </main>
    </div>
  );
}
