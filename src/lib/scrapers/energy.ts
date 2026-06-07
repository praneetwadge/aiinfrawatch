/**
 * Energy price scrapers
 * US: EIA API — https://www.eia.gov/opendata/
 * EU: ENTSO-E — https://transparency.entsoe.eu/
 *
 * Also includes hardcoded baseline values for regions without free APIs
 */

import axios from "axios";
import type { EnergyPrice, ScraperResult } from "@/types";

// ─── EIA (US Energy Information Administration) ───────────────────────────────

const EIA_REGIONS: Array<{
  region: string;
  grid_operator: string;
  eia_region_id: string;
  carbon_gco2: number;
  renewable_pct: number;
}> = [
  { region: "US-West (CAISO)", grid_operator: "CAISO", eia_region_id: "CAL",  carbon_gco2: 84,  renewable_pct: 52 },
  { region: "US-East (PJM)",   grid_operator: "PJM",   eia_region_id: "MIDA", carbon_gco2: 165, renewable_pct: 22 },
  { region: "US-South (ERCOT)", grid_operator: "ERCOT", eia_region_id: "TEX", carbon_gco2: 195, renewable_pct: 31 },
  { region: "US-NE (ISONE)",   grid_operator: "ISONE", eia_region_id: "NE",   carbon_gco2: 128, renewable_pct: 38 },
  { region: "US-MW (MISO)",    grid_operator: "MISO",  eia_region_id: "MIDW", carbon_gco2: 182, renewable_pct: 29 },
  { region: "US-NW (NWPP)",    grid_operator: "NWPP",  eia_region_id: "NW",   carbon_gco2: 72,  renewable_pct: 68 },
];

export async function scrapeEIAEnergy(): Promise<Omit<ScraperResult, "provider"> & { prices: EnergyPrice[] }> {
  const start = Date.now();
  const prices: EnergyPrice[] = [];

  if (!process.env.EIA_API_KEY) {
    // Use static baseline pricing if no key — still useful
    console.warn("[EIA] No API key — using baseline pricing data");
    const fetchedAt = new Date().toISOString();
    const BASELINE_PRICES: Record<string, number> = {
      "CAL": 0.042, "MIDA": 0.061, "TEX": 0.104, "NE": 0.072, "MIDW": 0.055, "NW": 0.038,
    };
    for (const region of EIA_REGIONS) {
      prices.push({
        region: region.region,
        grid_operator: region.grid_operator,
        price_per_kwh: BASELINE_PRICES[region.eia_region_id] ?? 0.07,
        carbon_intensity_gco2_kwh: region.carbon_gco2,
        renewable_pct: region.renewable_pct,
        timestamp: fetchedAt,
        source: "eia_baseline",
        fetched_at: fetchedAt,
      } as EnergyPrice);
    }
    return { prices, listings: [], success: true, duration_ms: Date.now() - start };
  }

  try {
    const fetchedAt = new Date().toISOString();

    await Promise.all(
      EIA_REGIONS.map(async (region) => {
        try {
          // EIA API v2 — electricity wholesale prices by region
          const { data } = await axios.get("https://api.eia.gov/v2/electricity/wholesale-markets/prices/facets", {
            params: {
              api_key: process.env.EIA_API_KEY,
              "facets[respondent][]": region.eia_region_id,
              frequency: "hourly",
              "data[]": "value",
              sort: JSON.stringify([{ column: "period", direction: "desc" }]),
              length: 1,
              offset: 0,
            },
            timeout: 10000,
          });

          const records = data?.response?.data ?? [];
          const latestPrice = records[0]?.value;

          if (latestPrice && latestPrice > 0) {
            // EIA returns $/MWh — convert to $/kWh
            prices.push({
              region: region.region,
              grid_operator: region.grid_operator,
              price_per_kwh: parseFloat((latestPrice / 1000).toFixed(5)),
              carbon_intensity_gco2_kwh: region.carbon_gco2,
              renewable_pct: region.renewable_pct,
              timestamp: records[0]?.period ?? fetchedAt,
              source: "eia_api_v2",
              fetched_at: fetchedAt,
            } as EnergyPrice);
          }
        } catch (e) {
          console.warn(`[EIA] Failed for ${region.region}:`, e);
        }
      })
    );

    console.log(`[EIA] Fetched ${prices.length} US energy prices`);
    return { prices, listings: [], success: true, duration_ms: Date.now() - start };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { prices, listings: [], success: false, error, duration_ms: Date.now() - start };
  }
}

// ─── European + Other Region Baselines ───────────────────────────────────────
// ENTSO-E requires registration; using published averages with source attribution

const STATIC_ENERGY_REGIONS: EnergyPrice[] = [
  {
    region: "EU-North (Nordic)",
    grid_operator: "Nord Pool",
    price_per_kwh: 0.031,
    carbon_intensity_gco2_kwh: 21,
    renewable_pct: 88,
    timestamp: new Date().toISOString(),
    source: "nordpool_published",
    fetched_at: new Date().toISOString(),
  },
  {
    region: "EU-West (Germany)",
    grid_operator: "ENTSO-E",
    price_per_kwh: 0.089,
    carbon_intensity_gco2_kwh: 120,
    renewable_pct: 57,
    timestamp: new Date().toISOString(),
    source: "entso_published",
    fetched_at: new Date().toISOString(),
  },
  {
    region: "EU-West (France)",
    grid_operator: "ENTSO-E",
    price_per_kwh: 0.071,
    carbon_intensity_gco2_kwh: 58,
    renewable_pct: 73,
    timestamp: new Date().toISOString(),
    source: "entso_published",
    fetched_at: new Date().toISOString(),
  },
  {
    region: "APAC (Singapore)",
    grid_operator: "EMA",
    price_per_kwh: 0.102,
    carbon_intensity_gco2_kwh: 408,
    renewable_pct: 4,
    timestamp: new Date().toISOString(),
    source: "ema_published",
    fetched_at: new Date().toISOString(),
  },
  {
    region: "US-West (Crusoe/Denver)",
    grid_operator: "Crusoe Stranded Gas",
    price_per_kwh: 0.028,          // stranded gas is extremely cheap
    carbon_intensity_gco2_kwh: 38, // much lower than grid — methane capture vs flaring
    renewable_pct: 65,             // gas + renewables mix
    timestamp: new Date().toISOString(),
    source: "crusoe_published",
    fetched_at: new Date().toISOString(),
  },
  {
    region: "APAC (Tokyo)",
    grid_operator: "TEPCO",
    price_per_kwh: 0.115,
    carbon_intensity_gco2_kwh: 462,
    renewable_pct: 22,
    timestamp: new Date().toISOString(),
    source: "tepco_published",
    fetched_at: new Date().toISOString(),
  },
];

export async function scrapeAllEnergy(): Promise<EnergyPrice[]> {
  const { prices: usaPrices } = await scrapeEIAEnergy();
  const allPrices = [...usaPrices, ...STATIC_ENERGY_REGIONS];
  // Update timestamps to now
  return allPrices.map((p) => ({ ...p, fetched_at: new Date().toISOString() }));
}
