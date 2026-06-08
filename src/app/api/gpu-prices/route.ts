/**
 * GET /api/gpu-prices
 *
 * Public API endpoint — returns current GPU listings from all providers
 * Optimized for both human browsers and AI agent queries
 *
 * Query params:
 *   gpu      — filter by model (e.g. "H100", "A100")
 *   provider — filter by provider slug (e.g. "vastai", "aws")
 *   type     — pricing type: spot | on-demand | reserved-1yr | reserved-3yr
 *   limit    — max results (default 100, max 500)
 *   format   — "json" (default) | "csv"
 */

import { NextRequest, NextResponse } from "next/server";
import { getLatestGpuListings } from "@/lib/db/queries";
import type { ApiResponse, GpuListing } from "@/types";

export const revalidate = 86400; // cache aligned to daily scrape cadence

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const gpu = searchParams.get("gpu") ?? undefined;
  const provider = searchParams.get("provider") ?? undefined;
  const pricingType = searchParams.get("type") ?? undefined;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100"), 500);
  const format = searchParams.get("format") ?? "json";

  try {
    const listings = await getLatestGpuListings({
      gpu_model: gpu,
      provider,
      pricing_type: pricingType,
      limit,
    });

    if (format === "csv") {
      const csv = [
        "provider,gpu_model,gpu_count,pricing_type,price_per_hour,region,availability,fetched_at",
        ...listings.map((l) =>
          [
            l.provider,
            `"${l.gpu_model}"`,
            l.gpu_count,
            l.pricing_type,
            l.price_per_hour,
            l.region,
            l.availability,
            l.fetched_at,
          ].join(",")
        ),
      ].join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="gpu-prices.csv"',
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
        },
      });
    }

    const response: ApiResponse<GpuListing[]> = {
      data: listings,
      meta: {
        fetched_at: new Date().toISOString(),
        count: listings.length,
        cache_ttl_seconds: 86400,
        source: listings.length > 0 ? "cached" : "seed",
      },
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
        "X-Data-Freshness": listings[0]?.fetched_at ?? "unknown",
      },
    });
  } catch (err) {
    console.error("/api/gpu-prices error:", err);
    return NextResponse.json(
      { error: "Failed to fetch GPU prices", message: String(err) },
      { status: 500 }
    );
  }
}
