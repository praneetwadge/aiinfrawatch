// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { scrapeOCI } = await import("@/lib/scrapers/oci");
    const { upsertGpuListings } = await import("@/lib/db/queries");
    const result = await scrapeOCI();
    if (result.listings?.length > 0) {
      await upsertGpuListings(result.listings);
    }
    return NextResponse.json({ success: true, provider: "oci", count: result.listings?.length ?? 0 });
  } catch (err) {
    return NextResponse.json({ success: false, provider: "oci", error: err?.message }, { status: 500 });
  }
}
