import { NextRequest, NextResponse } from "next/server";
import { runAllScrapers } from "@/lib/scrapers";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization")?.replace("Bearer ", "") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const report = await runAllScrapers();
    return NextResponse.json({ success: true, report });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
