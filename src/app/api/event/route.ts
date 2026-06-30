// REPO PATH: src/app/api/event/route.ts  (NEW FILE — create folder "event" under src/app/api/)
// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordEvent } from "@/lib/db/funnel";

const schema = z.object({
  session_id: z.string().optional(),
  event_name: z.enum([
    "audit_run",
    "overpay_shown",
    "move_with_us_click",
    "self_serve_click",
    "monitor_click",
    "share_click",
  ]),
  kind: z.string().optional(),
  meta: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Validation error" }, { status: 422 });
  }

  await recordEvent(parsed.data);

  // Always 200 — instrumentation must never block the UI.
  return NextResponse.json({ success: true });
}
