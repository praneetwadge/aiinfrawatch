// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

// Raises this route's platform-level execution ceiling from Vercel's default
// up to Hobby's max. This is a per-invocation duration limit — unrelated to
// the cron *schedule* ("0 0 * * *" in vercel.json), which stays untouched.
// Needed so AWS's larger payload (see scrapers/aws.ts) has room to finish
// instead of being killed by the platform before its own internal timeout
// below even fires.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  const results = [];

  async function tryScraper(name: string, importFn: () => Promise<any>, fnName: string, timeoutMs = 8000) {
    try {
      const mod = await importFn();
      const fn = mod[fnName];
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs))
      ]);
      if (result.listings?.length > 0) {
        const { upsertGpuListings } = await import("@/lib/db/queries");
        await upsertGpuListings(result.listings);
      }
      results.push({ provider: name, count: result.listings?.length ?? 0, success: true });
    } catch (e) {
      results.push({ provider: name, error: e.message, success: false });
    }
  }

  // Hyperscalers
  // AWS gets a longer budget — its regional pricing catalog is far larger
  // than any other scraper's payload (see scrapers/aws.ts for why).
  await tryScraper("aws",         () => import("@/lib/scrapers/aws"),         "scrapeAWS", 25000);
  await tryScraper("azure",       () => import("@/lib/scrapers/azure"),       "scrapeAzure");
  await tryScraper("gcp",         () => import("@/lib/scrapers/gcp"),         "scrapeGCP");
  await tryScraper("oci",         () => import("@/lib/scrapers/oci"),         "scrapeOCI");
  await tryScraper("ibm",         () => import("@/lib/scrapers/ibm"),         "scrapeIBM");

  // Neoclouds
  await tryScraper("coreweave",   () => import("@/lib/scrapers/coreweave"),   "scrapeCoreWeave");
  await tryScraper("lambda",      () => import("@/lib/scrapers/lambda"),      "scrapeLambdaLabs");
  await tryScraper("nebius",      () => import("@/lib/scrapers/nebius"),      "scrapeNebius");
  await tryScraper("paperspace",  () => import("@/lib/scrapers/paperspace"),  "scrapePaperspace");
  await tryScraper("crusoe",      () => import("@/lib/scrapers/crusoe"),      "scrapeCrusoe");
  await tryScraper("gmi",         () => import("@/lib/scrapers/gmi"),         "scrapeGMI");
  await tryScraper("voltagepark", () => import("@/lib/scrapers/voltagepark"), "scrapeVoltagePark");

  // Marketplaces
  await tryScraper("runpod",      () => import("@/lib/scrapers/runpod"),      "scrapeRunPod");
  await tryScraper("vastai",      () => import("@/lib/scrapers/vastai"),      "scrapeVastAi");
  await tryScraper("tensordock",  () => import("@/lib/scrapers/tensordock"),  "scrapeTensorDock");
  await tryScraper("fluidstack",  () => import("@/lib/scrapers/fluidstack"),  "scrapeFluidStack");

  const succeeded = results.filter(r => r.success).length;
  return NextResponse.json({
    success: succeeded > 0,
    results,
    total_listings: results.reduce((s, r) => s + (r.count ?? 0), 0)
  });
}
