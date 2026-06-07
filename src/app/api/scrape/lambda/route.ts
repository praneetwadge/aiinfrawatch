// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { scrapeLambdaLabs } = await import("@/lib/scrapers/lambda");
    const { upsertGpuListings } = await import("@/lib/db/queries");
    const result = await scrapeLambdaLabs();
    if (result.listings?.length > 0) {
      await upsertGpuListings(result.listings);
    }
    return NextResponse.json({ success: true, provider: "lambda", count: result.listings?.length ?? 0 });
  } catch (err) {
    return NextResponse.json({ success: false, provider: "lambda", error: err?.message }, { status: 500 });
  }
}
