// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

// Same reasoning as /api/cron — AWS's payload is larger than other scrapers'.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const { scrapeAWS } = await import("@/lib/scrapers/aws");
    const { upsertGpuListings } = await import("@/lib/db/queries");
    const result = await scrapeAWS();
    if (result.listings?.length > 0) {
      await upsertGpuListings(result.listings);
    }
    return NextResponse.json({ success: true, provider: "aws", count: result.listings?.length ?? 0 });
  } catch (err) {
    return NextResponse.json({ success: false, provider: "aws", error: err?.message }, { status: 500 });
  }
}
