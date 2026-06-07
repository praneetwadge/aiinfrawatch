/**
 * Master scraper — runs all provider scrapers in parallel
 * Called by: cron job, manual trigger, seed script
 */

import { scrapeVastAi } from "./vastai";
import { scrapeRunPod } from "./runpod";
import { scrapeLambdaLabs } from "./lambda";
import { scrapeAWS } from "./aws";
import { scrapeGCP } from "./gcp";
import { scrapeCoreWeave } from "./coreweave";
import { scrapeAzure } from "./azure";
import { scrapeOCI } from "./oci";
import { scrapeNebius } from "./nebius";
import { scrapeIBM } from "./ibm";
import { scrapeGMI } from "./gmi";
import { scrapeTensorDock } from "./tensordock";
import { scrapeFluidStack, scrapeHyperstack } from "./fluidstack";
import { scrapeVoltagePark } from "./voltagepark";
import { scrapeCrusoe } from "./crusoe";
import { scrapeAllEnergy } from "./energy";
import { upsertGpuListings, upsertEnergyPrices } from "@/lib/db/queries";
import type { ScraperResult } from "@/types";

export interface ScrapeReport {
  started_at: string;
  completed_at: string;
  duration_ms: number;
  results: ScraperResult[];
  total_listings: number;
  successful_providers: number;
  failed_providers: string[];
  energy_regions_updated: number;
}

export async function runAllScrapers(): Promise<ScrapeReport> {
  const startedAt = new Date().toISOString();
  const startMs = Date.now();

  console.log(`\n${"─".repeat(60)}`);
  console.log(`[Scraper] Starting full market data fetch at ${startedAt}`);
  console.log(`${"─".repeat(60)}\n`);

  // ── Run all GPU scrapers in parallel ────────────────────────────────────────
  const settled = await Promise.allSettled([
    scrapeVastAi(),
    scrapeRunPod(),
    scrapeLambdaLabs(),
    scrapeAWS(),
    scrapeGCP(),
    scrapeCoreWeave(),
    scrapeAzure(),
    scrapeOCI(),
    scrapeNebius(),
    scrapeIBM(),
    scrapeGMI(),
    scrapeTensorDock(),
    scrapeFluidStack(),
    scrapeHyperstack(),
    scrapeVoltagePark(),
    scrapeCrusoe(),
  ]);

  const results: ScraperResult[] = settled.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : {
          provider: "unknown",
          listings: [],
          success: false,
          error: r.reason?.message ?? "Unknown error",
          duration_ms: 0,
        }
  );

  // ── Run energy scraper ───────────────────────────────────────────────────────
  let energyCount = 0;
  try {
    const energyPrices = await scrapeAllEnergy();
    await upsertEnergyPrices(energyPrices);
    energyCount = energyPrices.length;
    console.log(`[Energy] Saved ${energyCount} energy price records`);
  } catch (err) {
    console.error("[Energy] Failed:", err);
  }

  // ── Persist all GPU listings ─────────────────────────────────────────────────
  const allListings = results.flatMap((r) => r.listings);

  try {
    await upsertGpuListings(allListings);
    console.log(`\n[Scraper] Saved ${allListings.length} GPU listings to database`);
  } catch (err) {
    console.error("[Scraper] Failed to save listings:", err);
  }

  const completedAt = new Date().toISOString();
  const failedProviders = results.filter((r) => !r.success).map((r) => r.provider);

  const report: ScrapeReport = {
    started_at: startedAt,
    completed_at: completedAt,
    duration_ms: Date.now() - startMs,
    results,
    total_listings: allListings.length,
    successful_providers: results.filter((r) => r.success && r.provider !== "unknown").length,
    failed_providers: failedProviders,
    energy_regions_updated: energyCount,
  };

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(60)}`);
  console.log("[Scraper] Completed in", report.duration_ms, "ms");
  console.table(
    results.map((r) => ({
      provider: r.provider,
      status: r.success ? "✓" : "✗",
      listings: r.listings.length,
      duration_ms: r.duration_ms,
      error: r.error ?? "",
    }))
  );
  console.log(`${"─".repeat(60)}\n`);

  return report;
}

// ── Selective scraper (for individual provider refresh) ──────────────────────

export async function runScraper(provider: string): Promise<ScraperResult> {
  const scrapers: Record<string, () => Promise<ScraperResult>> = {
    vastai:       scrapeVastAi,
    runpod:       scrapeRunPod,
    lambda:       scrapeLambdaLabs,
    aws:          scrapeAWS,
    gcp:          scrapeGCP,
    coreweave:    scrapeCoreWeave,
    azure:        scrapeAzure,
    oci:          scrapeOCI,
    nebius:       scrapeNebius,
    ibm:          scrapeIBM,
    gmi:          scrapeGMI,
    tensordock:   scrapeTensorDock,
    fluidstack:   scrapeFluidStack,
    hyperstack:   scrapeHyperstack,
    voltagepark:  scrapeVoltagePark,
    crusoe:       scrapeCrusoe,
  };

  const fn = scrapers[provider.toLowerCase()];
  if (!fn) throw new Error(`No scraper for provider: ${provider}`);

  const result = await fn();
  if (result.success && result.listings.length > 0) {
    await upsertGpuListings(result.listings);
  }
  return result;
}
