// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { scrapeGMI } = await import("@/lib/scrapers/gmi");
    const { upsertGpuListings } = await import("@/lib/db/queries");
    const result = await scrapeGMI();
    if (result.listings?.length > 0) {
      await upsertGpuListings(result.listings);
    }
    return NextResponse.json({ success: true, provider: "gmi", count: result.listings?.length ?? 0 });
  } catch (err) {
    return NextResponse.json({ success: false, provider: "gmi", error: err?.message }, { status: 500 });
  }
}
