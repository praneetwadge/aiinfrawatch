// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

// Haiku for CSV (cheap, fast) — Sonnet for PDF (required for document vision).
// PDF base64 document blocks are GA on /v1/messages — no beta header needed.
const MODEL_CSV = "claude-haiku-4-5-20251001";
const MODEL_PDF = "claude-sonnet-4-6";

const SYSTEM = `You are a cloud billing analyst. Extract GPU compute line items from cloud bills (AWS, GCP, Azure) and return ONLY a JSON object — no prose, no markdown, no explanation.

Return this exact shape:
{
  "family": "H100" | "A100" | "L40S" | "A10G" | "other",
  "gpuCount": number,
  "hoursPerMonth": number,
  "situation": "hyperscaler" | "neocloud" | "marketplace" | "unsure",
  "workload": "inference" | "batch" | "evals" | "finetuning" | "training" | "dev" | "unsure",
  "monthlySpend": number,
  "provider": string,
  "confidence": "high" | "medium" | "low"
}

Rules:
- family: map instance types to GPU family. p4d/p4de/a2-highgpu/ND96asr/a2-ultragpu = A100. p5/ND H100/NCads_H100 = H100. g5/NC A10/a10 = A10G. L40S = L40S. Unknown = other.
- gpuCount: total GPUs across all matching instances (instance GPU count × instance count). e.g. p4d.24xlarge has 8 A100s. This MUST be > 0 if any GPU line item exists — never return 0 when monthlySpend > 0. If you cannot determine the count, estimate from spend and a typical $2-4/GPU-hr rate, and mark confidence "low".
- hoursPerMonth: DO NOT extract from managed service lines (SageMaker, AML, Vertex AI Training, AML Compute). Use ONLY raw VM/instance hours for the primary GPU instance type (EC2, Azure VM, GCE). If only managed service hours are visible, return 720.
- monthlySpend: sum ONLY raw GPU instance charges (EC2 GPU line items + raw Azure VM GPU line items + GCE GPU line items). DO NOT include managed service wrappers (SageMaker, AML Compute, Vertex AI Training) — these bill the same underlying hardware at a markup. Exclude storage, networking, support, discounts/credits.
- situation: AWS/GCP/Azure/IBM/Oracle = hyperscaler. CoreWeave/Lambda/Nebius = neocloud. RunPod/Vast.ai = marketplace.
- workload: infer from service names. SageMaker Training/Vertex AI Training = training. Endpoint/Prediction/Online = inference. Default = unsure.
- provider: short name e.g. "AWS", "GCP", "Azure"
- confidence: high if you found clear GPU line items, medium if inferred, low if uncertain

If multiple GPU types appear, use the dominant one by spend.
If no GPU spend found, return { "error": "no_gpu_found" }.`;

// Robust JSON extraction: tolerate code fences and surrounding prose by grabbing
// the outermost { ... } block before parsing.
function parseModelJson(raw: string) {
  let s = (raw || "").replace(/```json|```/g, "").trim();
  const open = s.indexOf("{");
  const close = s.lastIndexOf("}");
  if (open !== -1 && close !== -1 && close > open) s = s.slice(open, close + 1);
  return JSON.parse(s);
}

// Always 200 so the client's res.json() can read the diagnostic `detail`.
const fail = (error: string, detail?: string) =>
  NextResponse.json({ success: false, error, detail }, { status: 200 });

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fail("config", "ANTHROPIC_API_KEY is not set in this environment");

  let body: any;
  try { body = await req.json(); }
  catch { return fail("bad_request", "request body was not valid JSON"); }

  const { text, base64, mediaType, fileName } = body;
  if (!text && !base64) return fail("bad_request", "no file content provided");

  const isPdf = !!base64 && mediaType === "application/pdf";
  const model = isPdf ? MODEL_PDF : MODEL_CSV;

  const userContent: any[] = isPdf
    ? [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
        { type: "text", text: `Extract GPU billing data from this cloud bill PDF: ${fileName ?? "bill.pdf"}` },
      ]
    : [
        { type: "text", text: `Extract GPU billing data from this cloud bill:\n\nFilename: ${fileName ?? "bill.csv"}\n\n${text}` },
      ];

  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: SYSTEM,
        messages: [{ role: "user", content: userContent }],
      }),
    });
  } catch (err: any) {
    console.error("[extract-bill] fetch threw:", err?.message);
    return fail("network", `could not reach Anthropic API: ${err?.message ?? "unknown"}`);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    console.error("[extract-bill] Anthropic non-OK:", response.status, errText);
    // Surface the upstream reason (status + short message) so it's debuggable in the UI.
    return fail("upstream", `${model} → ${response.status}: ${errText.slice(0, 220)}`);
  }

  const data = await response.json();
  // Concatenate ALL text blocks, not just content[0], in case the model emits more than one.
  const raw = Array.isArray(data?.content)
    ? data.content.filter((c: any) => c?.type === "text").map((c: any) => c.text).join("\n")
    : (data?.content?.[0]?.text ?? "");

  let extracted: any;
  try { extracted = parseModelJson(raw); }
  catch {
    console.error("[extract-bill] JSON parse failed. Raw:", raw.slice(0, 400));
    return fail("parse", `model did not return JSON: "${raw.slice(0, 160)}"`);
  }

  if (extracted?.error === "no_gpu_found") return fail("no_gpu_found");

  // Normalize/guard numerics server-side so the client never divides by zero.
  const num = (v: any, d: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : d;
  };
  extracted.gpuCount      = Math.max(1, Math.round(num(extracted.gpuCount, 1)));
  extracted.hoursPerMonth = Math.max(1, num(extracted.hoursPerMonth, 720));
  extracted.monthlySpend  = num(extracted.monthlySpend, 0);

  return NextResponse.json({ success: true, data: extracted });
}
