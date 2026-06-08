// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/db/supabase";

const schema = z.object({
  email:        z.string().email("Valid work email required"),
  monthlySpend: z.string().min(1, "Monthly spend is required"),
  stack:        z.string().optional(),
  workload:     z.string().min(1, "Workload type is required"),
  notes:        z.string().optional(),
  source:       z.enum(["cost-audit", "load-balancer"]),
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

  const { email, monthlySpend, stack, workload, notes, source } = parsed.data;

  const { error } = await supabaseAdmin
    .from("audit_requests")
    .insert({
      email,
      monthly_spend: monthlySpend,
      stack:   stack   || null,
      workload,
      notes:   notes   || null,
      source,
    });

  if (error) {
    console.error("[audit-request] Supabase insert error:", error.message);
    return NextResponse.json({ success: false, error: "Failed to save request. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ success: true, email });
}
