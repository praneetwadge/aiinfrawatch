// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { scrapeGCP } = await import("@/lib/scrapers/gcp");
    const { upsertGpuListings } = await import("@/lib/db/queries");
    const result = await scrapeGCP();
    if (result.listings?.length > 0) {
      await upsertGpuListings(result.listings);
    }
    return NextResponse.json({ success: true, provider: "gcp", count: result.listings?.length ?? 0 });
  } catch (err) {
    return NextResponse.json({ success: false, provider: "gcp", error: err?.message }, { status: 500 });
  }
}
