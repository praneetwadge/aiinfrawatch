import { NextRequest, NextResponse } from "next/server";
import { getLatestEnergyPrices } from "@/lib/db/queries";
import type { ApiResponse, EnergyPrice } from "@/types";

export const revalidate = 86400; // experimental — not on a fixed scrape schedule

export async function GET(_request: NextRequest) {
  try {
    const prices = await getLatestEnergyPrices();

    const response: ApiResponse<EnergyPrice[]> = {
      data: prices,
      meta: {
        fetched_at: new Date().toISOString(),
        count: prices.length,
        cache_ttl_seconds: 86400,
        source: "seed", // energy data is seed/indicative — not live-scraped on a fixed schedule
      },
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600" },
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch energy prices" }, { status: 500 });
  }
}
