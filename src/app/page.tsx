import { Suspense } from "react";
import { computeMarketSummary, getLatestGpuListings, getLatestEnergyPrices, getLatencyBenchmarks } from "@/lib/db/queries";
import DashboardClient from "@/components/DashboardClient";
import type { GpuListing, EnergyPrice, LatencyBenchmark, MarketSummary } from "@/types";

export const revalidate = 300;

export default async function Page() {
  const [summary, listings, energy, latency] = await Promise.allSettled([
    computeMarketSummary(),
    getLatestGpuListings({ limit: 200 }),
    getLatestEnergyPrices(),
    getLatencyBenchmarks(),
  ]);

  const summaryData: MarketSummary | null = summary.status === "fulfilled" ? summary.value : null;
  const listingsData: GpuListing[] = listings.status === "fulfilled" ? listings.value : [];
  const energyData: EnergyPrice[] = energy.status === "fulfilled" ? energy.value : [];
  const latencyData: LatencyBenchmark[] = latency.status === "fulfilled" ? latency.value : [];

  return (
    <Suspense fallback={<div style={{ padding: "2rem", color: "#888" }}>Loading...</div>}>
      <DashboardClient
        summary={summaryData}
        listings={listingsData}
        energy={energyData}
        latency={latencyData}
      />
    </Suspense>
  );
}
