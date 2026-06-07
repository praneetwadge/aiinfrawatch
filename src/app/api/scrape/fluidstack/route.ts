// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { scrapeFluidStack } = await import("@/lib/scrapers/fluidstack");
    const { upsertGpuListings } = await import("@/lib/db/queries");
    const result = await scrapeFluidStack();
    if (result.listings?.length > 0) {
      await upsertGpuListings(result.listings);
    }
    return NextResponse.json({ success: true, provider: "fluidstack", count: result.listings?.length ?? 0 });
  } catch (err) {
    return NextResponse.json({ success: false, provider: "fluidstack", error: err?.message }, { status: 500 });
  }
}
