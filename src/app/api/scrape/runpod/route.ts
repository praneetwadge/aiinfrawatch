// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { scrapeRunPod } = await import("@/lib/scrapers/runpod");
    const { upsertGpuListings } = await import("@/lib/db/queries");
    const result = await scrapeRunPod();
    if (result.listings?.length > 0) {
      await upsertGpuListings(result.listings);
    }
    return NextResponse.json({ success: true, provider: "runpod", count: result.listings?.length ?? 0 });
  } catch (err) {
    return NextResponse.json({ success: false, provider: "runpod", error: err?.message }, { status: 500 });
  }
}
