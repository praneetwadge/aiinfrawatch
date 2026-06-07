import { NextRequest, NextResponse } from "next/server";
import { getLatestEnergyPrices } from "@/lib/db/queries";
import type { ApiResponse, EnergyPrice } from "@/types";

export const revalidate = 3600; // 1-hour cache for energy prices

export async function GET(_request: NextRequest) {
  try {
    const prices = await getLatestEnergyPrices();

    const response: ApiResponse<EnergyPrice[]> = {
      data: prices,
      meta: {
        fetched_at: new Date().toISOString(),
        count: prices.length,
        cache_ttl_seconds: 3600,
        source: prices.length > 0 ? "cached" : "seed",
      },
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300" },
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch energy prices" }, { status: 500 });
  }
}
