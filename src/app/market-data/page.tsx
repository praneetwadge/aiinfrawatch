// REPO PATH: src/app/market-data/page.tsx  (NEW FILE — create folder "market-data" under src/app/)
import { Suspense } from "react";
import { computeMarketSummary, getLatestGpuListings } from "@/lib/db/queries";
import DashboardClient from "@/components/DashboardClient";
import type { GpuListing, MarketSummary } from "@/types";
import type { Metadata } from "next";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Market Data",
  description: "Live GPU compute pricing across cloud providers — the data behind your audit number.",
};

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
