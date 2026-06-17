// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// POST /api/audit-request
// Stores a qualified lead the moment they unlock the migration plan, with the
// savings figure already attached — so follow-up is anchored to their number.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email || "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
    }

    const row = {
      email,
      gpu: body?.gpu ?? null,
      count: body?.count ?? null,
      current_monthly: body?.currentMonthly ?? null,
      overpay_monthly: body?.overpayMonthly ?? null,
      overpay_yearly: body?.overpayYearly ?? null,
      confidence: body?.confidence ?? null,
      source: body?.source ?? "cost-audit",
      created_at: new Date().toISOString(),
    };

    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const supabase = createClient(url, key);
      // Table: audit_leads (create once — see INTEGRATION.md)
      await supabase.from("audit_leads").insert(row);
    } else {
      // No secret configured at build/runtime — don't 500 the user; log instead.
      console.log("[audit-request] (no supabase env) lead:", row);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[audit-request] error", e);
    // Never block the unlock on our storage failing.
    return NextResponse.json({ ok: true });
  }
}
