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

interface MarketSummary {
  h100_spot_avg: number;
  a100_spot_avg: number;
  active_providers: number;
  total_listings: number;
  energy_cheapest_price: number;
  last_updated: string;
}

interface Props {
  summary: MarketSummary | null;
  listings: GpuListing[];
  energy: any[];
  latency: any[];
}

export default function DashboardClient({ summary, listings }: Props) {
  const [filter, setFilter] = useState("all");
  const filtered = useMemo(() =>
    filter === "all" ? listings : listings.filter((l) => l.gpu_model.includes(filter)),
    [listings, filter]
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f0f0f0", fontFamily: "system-ui" }}>
      <nav style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #222", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 600, fontSize: 16 }}>AIInfraWatch</span>
        <span style={{ fontSize: 12, color: "#555" }}>
          {summary ? `${summary.total_listings} listings` : "Loading..."}
        </span>
      </nav>
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "1.5rem" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: "1rem" }}>
          {["all", "H100", "A100", "L40S"].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ background: filter === f ? "#f0f0f0" : "transparent", color: filter === f ? "#000" : "#888", border: "1px solid #333", borderRadius: 99, padding: "3px 12px", fontSize: 12, cursor: "pointer" }}>
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
              <tr><td colSpan={6} style={{ padding: "2rem 0", color: "#555", textAlign: "center" }}>No data yet</td></tr>
            ) : filtered.map((l, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #161616" }}>
                <td style={{ padding: "8px 12px 8px 0", fontWeight: 500 }}>{l.gpu_model}</td>
                <td style={{ padding: "8px 12px 8px 0", color: "#888" }}>{l.provider}</td>
                <td style={{ padding: "8px 12px 8px 0", color: "#555" }}>{l.region}</td>
                <td style={{ padding: "8px 12px 8px 0", color: "#555" }}>{l.pricing_type}</td>
                <td style={{ padding: "8px 12px 8px 0", fontWeight: 600, color: "#00d084" }}>${l.price_per_hour.toFixed(2)}</td>
                <td style={{ padding: "8px 12px 8px 0", color: "#888" }}>{l.availability}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}
