import { upsertGpuListings, upsertEnergyPrices } from "@/lib/db/queries";
import type { ScraperResult } from "@/types";

export interface ScrapeReport {
  duration_ms: number;
  total_listings: number;
  successful_providers: number;
  failed_providers: string[];
  energy_regions_updated: number;
}

async function tryScraperFile(name: string): Promise<ScraperResult> {
  try {
    const mod = await import(`./${name}`);
    const fn = Object.values(mod).find(v => typeof v === "function") as () => Promise<ScraperResult>;
    return await fn();
  } catch (e: any) {
    return { provider: name, listings: [], success: false, error: e.message, duration_ms: 0 };
  }
}

export async function runAllScrapers(): Promise<ScrapeReport> {
  const start = Date.now();
  const providers = ["vastai","runpod","lambda","aws","gcp","coreweave","azure","oci","nebius","ibm","gmi","tensordock","fluidstack","voltagepark","crusoe"];
  const results = await Promise.allSettled(providers.map(p => tryScraperFile(p)));
  const reports = results.map(r => r.status === "fulfilled" ? r.value : { provider: "unknown", listings: [], success: false, error: "failed", duration_ms: 0 });
  const allListings = reports.flatMap(r => r.listings);
  try { await upsertGpuListings(allListings); } catch (e) { console.error(e); }
  return {
    duration_ms: Date.now() - start,
    total_listings: allListings.length,
    successful_providers: reports.filter(r => r.success).length,
    failed_providers: reports.filter(r => !r.success).map(r => r.provider),
    energy_regions_updated: 0,
  };
}
