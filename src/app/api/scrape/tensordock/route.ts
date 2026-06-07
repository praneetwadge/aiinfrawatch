// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { scrapeTensorDock } = await import("@/lib/scrapers/tensordock");
    const { upsertGpuListings } = await import("@/lib/db/queries");
    const result = await scrapeTensorDock();
    if (result.listings?.length > 0) {
      await upsertGpuListings(result.listings);
    }
    return NextResponse.json({ success: true, provider: "tensordock", count: result.listings?.length ?? 0 });
  } catch (err) {
    return NextResponse.json({ success: false, provider: "tensordock", error: err?.message }, { status: 500 });
  }
}
