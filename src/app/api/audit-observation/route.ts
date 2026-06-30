// REPO PATH: src/app/api/audit-observation/route.ts  (NEW FILE — create folder "audit-observation" under src/app/api/)
// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordAuditObservation } from "@/lib/db/funnel";

const schema = z.object({
  session_id: z.string().optional(),
  input_mode: z.enum(["describe", "bill", "manual"]),
  gpu_type: z.string().min(1),
  current_provider: z.string().optional(),
  region: z.string().optional(),
  pricing_type: z.string().optional(),
  effective_rate_usd_hr: z.number().nullable().optional(),
  gpu_count: z.number().nullable().optional(),
  monthly_spend_usd: z.number().nullable().optional(),
  workload_class: z.string().optional(),
  reliable_floor_usd_hr: z.number(),
  overpay_pct: z.number().nullable().optional(),
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

  await recordAuditObservation(parsed.data);

  // Always 200 — best-effort analytics write, never block the UI on it.
  return NextResponse.json({ success: true });
}
