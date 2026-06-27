// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

// Haiku for CSV (cheap, fast) — Sonnet for PDF (required for document vision)
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
- gpuCount: total GPUs across all matching instances (instance GPU count × instance count). e.g. p4d.24xlarge has 8 A100s.
- hoursPerMonth: DO NOT extract from managed service lines (SageMaker, AML, Vertex AI Training, AML Compute). Use ONLY raw VM/instance hours for the primary GPU instance type (EC2, Azure VM, GCE). If only managed service hours are visible, return 720.
- monthlySpend: sum ONLY raw GPU instance charges (EC2 GPU line items + raw Azure VM GPU line items + GCE GPU line items). DO NOT include managed service wrappers (SageMaker, AML Compute, Vertex AI Training) — these bill the same underlying hardware at a markup. Exclude storage, networking, support, discounts/credits.
- situation: AWS/GCP/Azure/IBM/Oracle = hyperscaler. CoreWeave/Lambda/Nebius = neocloud. RunPod/Vast.ai = marketplace.
- workload: infer from service names. SageMaker Training/Vertex AI Training = training. Endpoint/Prediction/Online = inference. Default = unsure.
- monthlySpend: total GPU compute spend only (EC2 GPU + SageMaker GPU + AML GPU + Vertex GPU lines). Exclude storage, networking, support, monitoring.
- provider: short name e.g. "AWS", "GCP", "Azure"
- confidence: high if you found clear GPU line items, medium if inferred, low if uncertain

If multiple GPU types appear, use the dominant one by spend.
If no GPU spend found, return { "error": "no_gpu_found" }.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: false, error: "API key not configured" }, { status: 500 });
  }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 }); }

  const { text, base64, mediaType, fileName } = body;
  if (!text && !base64) {
    return NextResponse.json({ success: false, error: "No file content provided" }, { status: 400 });
  }

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

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 512,
        system: SYSTEM,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[extract-bill] Anthropic error:", err);
      return NextResponse.json({ success: false, error: "Extraction failed" }, { status: 502 });
    }

    const data = await response.json();
    const raw = data.content?.[0]?.text ?? "";

    let extracted: any;
    try {
      const clean = raw.replace(/```json|```/g, "").trim();
      extracted = JSON.parse(clean);
    } catch {
      console.error("[extract-bill] JSON parse failed:", raw);
      return NextResponse.json({ success: false, error: "Could not parse bill" }, { status: 422 });
    }

    if (extracted.error === "no_gpu_found") {
      return NextResponse.json({ success: false, error: "no_gpu_found" }, { status: 200 });
    }

    return NextResponse.json({ success: true, data: extracted });
  } catch (err: any) {
    console.error("[extract-bill] Fetch error:", err?.message);
    return NextResponse.json({ success: false, error: "Network error" }, { status: 502 });
  }
}
