// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { scrapeVastAi } = await import("@/lib/scrapers/vastai");
    const { upsertGpuListings } = await import("@/lib/db/queries");
    const result = await scrapeVastAi();
    if (result.listings?.length > 0) {
      await upsertGpuListings(result.listings);
    }
    return NextResponse.json({ success: true, provider: "vastai", count: result.listings?.length ?? 0 });
  } catch (err) {
    return NextResponse.json({ success: false, provider: "vastai", error: err?.message }, { status: 500 });
  }
}
