#!/usr/bin/env tsx
/**
 * Manual scrape runner — tests all scrapers from CLI
 * Run: npm run scrape
 * Or: npm run scrape -- --provider vastai
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { runAllScrapers, runScraper } from "../src/lib/scrapers";

async function main() {
  const args = process.argv.slice(2);
  const providerFlag = args.indexOf("--provider");

  if (providerFlag !== -1 && args[providerFlag + 1]) {
    const provider = args[providerFlag + 1];
    console.log(`Running scraper for: ${provider}\n`);
    const result = await runScraper(provider);
    console.log("\nResult:", JSON.stringify(result, null, 2));
  } else {
    const report = await runAllScrapers();
    console.log("\n📊 Final Report:");
    console.log(`  Total listings: ${report.total_listings}`);
    console.log(`  Successful: ${report.successful_providers}/6 providers`);
    console.log(`  Energy regions: ${report.energy_regions_updated}`);
    console.log(`  Duration: ${report.duration_ms}ms`);
    if (report.failed_providers.length > 0) {
      console.log(`  Failed: ${report.failed_providers.join(", ")}`);
    }
  }
}

main().catch(console.error);
