// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { scrapeCoreWeave } = await import("@/lib/scrapers/coreweave");
    const { upsertGpuListings } = await import("@/lib/db/queries");
    const result = await scrapeCoreWeave();
    if (result.listings?.length > 0) {
      await upsertGpuListings(result.listings);
    }
    return NextResponse.json({ success: true, provider: "coreweave", count: result.listings?.length ?? 0 });
  } catch (err) {
    return NextResponse.json({ success: false, provider: "coreweave", error: err?.message }, { status: 500 });
  }
}
