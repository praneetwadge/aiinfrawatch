// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { scrapePaperspace } = await import("@/lib/scrapers/paperspace");
    const { upsertGpuListings } = await import("@/lib/db/queries");
    const result = await scrapePaperspace();
    if (result.listings?.length > 0) {
      await upsertGpuListings(result.listings);
    }
    return NextResponse.json({ success: true, provider: "paperspace", count: result.listings?.length ?? 0 });
  } catch (err) {
    return NextResponse.json({ success: false, provider: "paperspace", error: err?.message }, { status: 500 });
  }
}
