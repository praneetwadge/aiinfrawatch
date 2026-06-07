import { Suspense } from "react";
import { computeMarketSummary, getLatestGpuListings, getLatestEnergyPrices, getLatencyBenchmarks } from "@/lib/db/queries";
import DashboardClient from "@/components/DashboardClient";
import type { GpuListing, EnergyPrice, LatencyBenchmark, MarketSummary } from "@/types";

// Revalidate every 5 minutes — serves fresh data to bots and browsers
export const revalidate = 300;

// Structured data for SEO and agent crawlers
function StructuredData({ summary }: { summary: MarketSummary }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "name": "AI GPU Cloud Pricing Data",
    "description": "Real-time GPU instance pricing across major AI cloud providers",
    "url": `${process.env.NEXT_PUBLIC_APP_URL}/api/gpu-prices`,
    "provider": { "@type": "Organization", "name": "AIInfraWatch" },
    "temporalCoverage": summary.last_updated,
    "variableMeasured": [
      { "@type": "PropertyValue", "name": "H100 Spot Average", "value": `$${summary.h100_spot_avg}/hr` },
      { "@type": "PropertyValue", "name": "A100 Spot Average", "value": `$${summary.a100_spot_avg}/hr` },
      { "@type": "PropertyValue", "name": "Active Providers",  "value": summary.active_providers },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default async function Page() {
  // Parallel data fetching — all server-side for SEO
  const [summary, listings, energy, latency] = await Promise.allSettled([
    computeMarketSummary(),
    getLatestGpuListings({ limit: 200 }),
    getLatestEnergyPrices(),
    getLatencyBenchmarks(),
  ]);

  const summaryData = summary.status === "fulfilled" ? summary.value : null;
  const listingsData: GpuListing[] = listings.status === "fulfilled" ? listings.value : [];
  const energyData: EnergyPrice[] = energy.status === "fulfilled" ? energy.value : [];
  const latencyData: LatencyBenchmark[] = latency.status === "fulfilled" ? latency.value : [];

  return (
    <>
      {summaryData && <StructuredData summary={summaryData} />}

      {/* Agent-readable data summary in hidden element */}
      <div
        aria-hidden="true"
        style={{ display: "none" }}
        data-api-endpoint="/api/gpu-prices"
        data-last-updated={summaryData?.last_updated}
        data-h100-avg={summaryData?.h100_spot_avg}
        data-a100-avg={summaryData?.a100_spot_avg}
        data-providers={summaryData?.active_providers}
      />

      <Suspense fallback={<div style={{ padding: "2rem", color: "#888" }}>Loading market data...</div>}>
        <DashboardClient
          summary={summaryData}
          listings={listingsData}
          energy={energyData}
          latency={latencyData}
        />
      </Suspense>
    </>
  );
}
