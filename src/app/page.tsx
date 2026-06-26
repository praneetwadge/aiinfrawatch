import { Suspense } from "react";
import { computeMarketSummary, getLatestGpuListings } from "@/lib/db/queries";
import DashboardClient from "@/components/DashboardClient";
import type { GpuListing, MarketSummary } from "@/types";

export const revalidate = 300;

export default async function Page() {
  const [summary, listings] = await Promise.allSettled([
    computeMarketSummary(),
    getLatestGpuListings({ limit: 4000 }),
  ]);

  const summaryData: MarketSummary | null = summary.status === "fulfilled" ? summary.value : null;
  const listingsData: GpuListing[] = listings.status === "fulfilled" ? listings.value : [];

  return (
    <Suspense fallback={<div style={{ padding: "2rem", color: "#888" }}>Loading...</div>}>
      <DashboardClient summary={summaryData} listings={listingsData} />
    </Suspense>
  );
}
