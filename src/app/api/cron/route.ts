/**
 * POST /api/cron/scrape
 *
 * Triggered by Vercel Cron (see vercel.json)
 * Also callable manually with the CRON_SECRET header
 *
 * Vercel Cron config (vercel.json):
 * { "crons": [{ "path": "/api/cron/scrape", "schedule": "*/5 * * * *" }] }
 */

import { NextRequest, NextResponse } from "next/server";
import { runAllScrapers } from "@/lib/scrapers";

export const maxDuration = 300; // 5 minutes — Vercel Pro allows up to 300s

export async function POST(request: NextRequest) {
  // Verify cron secret to prevent unauthorized triggers
  const authHeader = request.headers.get("authorization");
  const cronHeader = request.headers.get("x-cron-secret");

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const provided = authHeader?.replace("Bearer ", "") ?? cronHeader ?? "";
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const report = await runAllScrapers();

    return NextResponse.json({
      success: true,
      summary: {
        duration_ms: report.duration_ms,
        total_listings: report.total_listings,
        successful_providers: report.successful_providers,
        failed_providers: report.failed_providers,
        energy_regions_updated: report.energy_regions_updated,
      },
    });
  } catch (err) {
    console.error("/api/cron/scrape error:", err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}

// Allow GET for Vercel Cron (it sends GET by default)
export async function GET(request: NextRequest) {
  return POST(request);
}
