// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  try {
    const { scrapeVastAi } = await import("@/lib/scrapers/vastai");
    const { scrapeRunPod } = await import("@/lib/scrapers/runpod");
    const { scrapeAWS } = await import("@/lib/scrapers/aws");
    const { scrapeGCP } = await import("@/lib/scrapers/gcp");
    const { scrapeAzure } = await import("@/lib/scrapers/azure");
    const { scrapeCoreWeave } = await import("@/lib/scrapers/coreweave");
    const { upsertGpuListings } = await import("@/lib/db/queries");

    const results = [];
    const scrapers = [
      { name: "vastai", fn: scrapeVastAi },
      { name: "runpod", fn: scrapeRunPod },
      { name: "aws", fn: scrapeAWS },
      { name: "gcp", fn: scrapeGCP },
      { name: "azure", fn: scrapeAzure },
      { name: "coreweave", fn: scrapeCoreWeave },
    ];

    for (const { name, fn } of scrapers) {
      try {
        const result = await fn();
        if (result.listings.length > 0) {
          await upsertGpuListings(result.listings);
        }
        results.push({ provider: name, count: result.listings.length, success: true });
      } catch (e) {
        results.push({ provider: name, error: e.message, success: false });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err) {
    return NextResponse.json({ success: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
