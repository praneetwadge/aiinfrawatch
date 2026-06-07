// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { scrapeAzure } = await import("@/lib/scrapers/azure");
    const { upsertGpuListings } = await import("@/lib/db/queries");
    const result = await scrapeAzure();
    if (result.listings?.length > 0) {
      await upsertGpuListings(result.listings);
    }
    return NextResponse.json({ success: true, provider: "azure", count: result.listings?.length ?? 0 });
  } catch (err) {
    return NextResponse.json({ success: false, provider: "azure", error: err?.message }, { status: 500 });
  }
}
