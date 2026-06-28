// @ts-nocheck
// Lambda Labs scraper.
// Live: cloud.lambdalabs.com/api/v1/instance-types (requires LAMBDA_API_KEY).
// The response shape is parsed defensively — if it doesn't match what we expect,
// we return null and fall back to the dated rate card rather than shipping
// unverified data as "live". Every listing is tagged with its true source.
import axios from "axios";
import type { GpuListing, ScraperResult } from "@/types";

const LAMBDA_API = "https://cloud.lambdalabs.com/api/v1/instance-types";

// Lambda Labs GPU instance pricing (rate card — published pricing page, Jun 2025)
const LAMBDA_INSTANCES = [
  { name: "gpu_1x_h100_sxm5",  gpu: "H100 SXM5 80GB", count: 1,  price: 2.49,  region: "us-east-1" },
  { name: "gpu_2x_h100_sxm5",  gpu: "H100 SXM5 80GB", count: 2,  price: 4.98,  region: "us-east-1" },
  { name: "gpu_4x_h100_sxm5",  gpu: "H100 SXM5 80GB", count: 4,  price: 9.96,  region: "us-east-1" },
  { name: "gpu_8x_h100_sxm5",  gpu: "H100 SXM5 80GB", count: 8,  price: 19.92, region: "us-east-1" },
  { name: "gpu_1x_a100_sxm4",  gpu: "A100 SXM 80GB",  count: 1,  price: 1.99,  region: "us-east-1" },
  { name: "gpu_8x_a100_sxm4",  gpu: "A100 SXM 80GB",  count: 8,  price: 15.92, region: "us-east-1" },
  { name: "gpu_1x_a10",        gpu: "A10G 24GB",       count: 1,  price: 0.60,  region: "us-east-1" },
  { name: "gpu_1x_rtx6000",    gpu: "RTX 6000 Ada",    count: 1,  price: 0.50,  region: "us-east-1" },
  { name: "gpu_1x_a6000",      gpu: "RTX A6000 48GB",  count: 1,  price: 0.80,  region: "us-east-1" },
  { name: "gpu_8x_a6000",      gpu: "RTX A6000 48GB",  count: 8,  price: 6.40,  region: "us-east-1" },
  { name: "gpu_1x_h100_pcie",  gpu: "H100 PCIe 80GB",  count: 1,  price: 2.49,  region: "us-west-2" },
  { name: "gpu_8x_h100_pcie",  gpu: "H100 PCIe 80GB",  count: 8,  price: 19.92, region: "us-west-2" },
];

function mapLambdaGpu(name: string): string | null {
  const n = String(name).toLowerCase();
  if (n.includes("h100") && n.includes("sxm")) return "H100 SXM5 80GB";
  if (n.includes("h100")) return "H100 PCIe 80GB";
  if (n.includes("a100")) return "A100 SXM 80GB";
  if (n.includes("a10")) return "A10G 24GB";
  if (n.includes("a6000")) return "RTX A6000 48GB";
  if (n.includes("rtx6000") || n.includes("6000 ada")) return "RTX 6000 Ada";
  return null;
}

async function fetchLambdaLive(fetchedAt: string): Promise<GpuListing[] | null> {
  if (!process.env.LAMBDA_API_KEY) return null;
  try {
    const { data } = await axios.get(LAMBDA_API, {
      headers: { Authorization: `Bearer ${process.env.LAMBDA_API_KEY}` },
      timeout: 12000,
    });
    const items = data?.data ?? data?.instance_types ?? data;
    if (!items || typeof items !== "object") return null;

    const out: GpuListing[] = [];
    // Lambda returns a map keyed by instance type name.
    for (const [key, val] of Object.entries(items)) {
      const it: any = (val as any)?.instance_type ?? val;
      const priceCents = it?.price_cents_per_hour ?? it?.price_cents ?? null;
      const gpu = mapLambdaGpu(it?.name ?? key);
      if (gpu == null || priceCents == null) continue;
      const price = Number(priceCents) / 100;
      if (!Number.isFinite(price) || price <= 0) continue;
      const regions = (val as any)?.regions_with_capacity_available ?? [];
      const region = Array.isArray(regions) && regions[0]?.name ? regions[0].name : "us-east-1";
      const available = Array.isArray(regions) && regions.length > 0;
      out.push({
        provider: "Lambda Labs",
        provider_slug: "lambda",
        gpu_model: gpu,
        gpu_count: it?.specs?.gpus ?? 1,
        pricing_type: "on-demand",
        price_per_hour: price,
        region,
        availability: available ? "high" : "low",
        raw_data: { instance_name: it?.name ?? key, source: "live" },
        fetched_at: fetchedAt,
      });
    }
    // Only accept the live result if it actually parsed into something usable.
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

export async function scrapeLambdaLabs(): Promise<ScraperResult> {
  const start = Date.now();
  try {
    const fetchedAt = new Date().toISOString();

    const live = await fetchLambdaLive(fetchedAt);
    if (live && live.length > 0) {
      return { provider: "lambda", listings: live, success: true, duration_ms: Date.now() - start };
    }

    // Rate-card fallback — tagged with source + as-of date.
    const listings: GpuListing[] = LAMBDA_INSTANCES.map(inst => ({
      provider: "Lambda Labs",
      provider_slug: "lambda",
      gpu_model: inst.gpu,
      gpu_count: inst.count,
      pricing_type: "on-demand",
      price_per_hour: inst.price,
      region: inst.region,
      availability: "high",
      raw_data: { instance_name: inst.name, source: "rate_card", rate_card_date: "2025-06" },
      fetched_at: fetchedAt,
    }));

    return { provider: "lambda", listings, success: true, duration_ms: Date.now() - start };
  } catch (err) {
    return { provider: "lambda", listings: [], success: false, error: err.message, duration_ms: Date.now() - start };
  }
}
