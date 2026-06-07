// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { scrapeNebius } = await import("@/lib/scrapers/nebius");
    const { upsertGpuListings } = await import("@/lib/db/queries");
    const result = await scrapeNebius();
    if (result.listings?.length > 0) {
      await upsertGpuListings(result.listings);
    }
    return NextResponse.json({ success: true, provider: "nebius", count: result.listings?.length ?? 0 });
  } catch (err) {
    return NextResponse.json({ success: false, provider: "nebius", error: err?.message }, { status: 500 });
  }
}
