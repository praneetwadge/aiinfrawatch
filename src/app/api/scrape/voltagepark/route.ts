// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { scrapeVoltagePark } = await import("@/lib/scrapers/voltagepark");
    const { upsertGpuListings } = await import("@/lib/db/queries");
    const result = await scrapeVoltagePark();
    if (result.listings?.length > 0) {
      await upsertGpuListings(result.listings);
    }
    return NextResponse.json({ success: true, provider: "voltagepark", count: result.listings?.length ?? 0 });
  } catch (err) {
    return NextResponse.json({ success: false, provider: "voltagepark", error: err?.message }, { status: 500 });
  }
}
