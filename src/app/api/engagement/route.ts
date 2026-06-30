// REPO PATH: src/app/api/engagement/route.ts  (NEW FILE — create folder "engagement" under src/app/api/)
// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordEngagement, recordEvent } from "@/lib/db/funnel";

const schema = z.object({
  session_id: z.string().optional(),
  kind: z.enum(["savings_share", "monitor"]),
  email: z.string().email("Valid work email required"),
  current_provider: z.string().optional(),
  gpu_type: z.string().optional(),
  est_monthly_spend_usd: z.number().nullable().optional(),
  est_annual_savings_usd: z.number().nullable().optional(),
  target_provider: z.string().optional(),
  consent: z.boolean(),
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
    const msg = parsed.error.errors[0]?.message ?? "Validation error";
    return NextResponse.json({ success: false, error: msg }, { status: 422 });
  }

  if (!parsed.data.consent) {
    return NextResponse.json({ success: false, error: "Consent is required." }, { status: 422 });
  }

  const result = await recordEngagement(parsed.data);
  if (!result.success) {
    return NextResponse.json({ success: false, error: "Failed to save request. Please try again." }, { status: 500 });
  }

  // Fire the funnel event alongside the lead write. Must be awaited — on a
  // serverless runtime the function can be torn down as soon as the response
  // is sent, so an un-awaited call here could silently never complete.
  await recordEvent({
    session_id: parsed.data.session_id,
    event_name: "engagement_captured",
    kind: parsed.data.kind,
  });

  return NextResponse.json({ success: true });
}
