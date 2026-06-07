// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { scrapeCrusoe } = await import("@/lib/scrapers/crusoe");
    const { upsertGpuListings } = await import("@/lib/db/queries");
    const result = await scrapeCrusoe();
    if (result.listings?.length > 0) {
      await upsertGpuListings(result.listings);
    }
    return NextResponse.json({ success: true, provider: "crusoe", count: result.listings?.length ?? 0 });
  } catch (err) {
    return NextResponse.json({ success: false, provider: "crusoe", error: err?.message }, { status: 500 });
  }
}
