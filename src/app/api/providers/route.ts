import { NextRequest, NextResponse } from "next/server";
import { computeMarketSummary } from "@/lib/db/queries";

export const revalidate = 86400;

export async function GET(_request: NextRequest) {
  try {
    const summary = await computeMarketSummary();
    return NextResponse.json(
      { data: summary, meta: { fetched_at: new Date().toISOString(), cache_ttl_seconds: 300 } },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } }
    );
  } catch (err) {
    return NextResponse.json({ error: "Failed to compute market summary" }, { status: 500 });
  }
}
