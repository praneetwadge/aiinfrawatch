// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { scrapeIBM } = await import("@/lib/scrapers/ibm");
    const { upsertGpuListings } = await import("@/lib/db/queries");
    const result = await scrapeIBM();
    if (result.listings?.length > 0) {
      await upsertGpuListings(result.listings);
    }
    return NextResponse.json({ success: true, provider: "ibm", count: result.listings?.length ?? 0 });
  } catch (err) {
    return NextResponse.json({ success: false, provider: "ibm", error: err?.message }, { status: 500 });
  }
}
