import { NextRequest, NextResponse } from "next/server";
import { runAllScrapers } from "@/lib/scrapers";

export async function POST(request: NextRequest) {
  try {
    const report = await runAllScrapers();
    return NextResponse.json({ success: true, report });
  } catch (err: any) {
    console.error("CRON_ERROR:", err?.message, err?.stack);
    return NextResponse.json({ 
      success: false, 
      error: err?.message ?? String(err),
      stack: err?.stack?.split('\n').slice(0,5)
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
