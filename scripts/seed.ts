#!/usr/bin/env tsx
/**
 * Seed script — populates database with realistic data
 * Run: npm run seed
 * Use this to test the dashboard before all scrapers are live
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { upsertGpuListings, upsertEnergyPrices } from "../src/lib/db/queries";
import type { GpuListing, EnergyPrice } from "../src/types";

const NOW = new Date().toISOString();

const SEED_LISTINGS: GpuListing[] = [
  // ── H100 ──
  { provider: "CoreWeave", provider_slug: "coreweave", gpu_model: "H100 SXM5 80GB", gpu_count: 8,  pricing_type: "on-demand", price_per_hour: 28.00, region: "US-East (LGA1)", availability: "high",   vcpus: 96, ram_gb: 940,  network_gbps: 400, interconnect: "NVLink+IB", fetched_at: NOW },
  { provider: "CoreWeave", provider_slug: "coreweave", gpu_model: "H100 NVL 80GB",  gpu_count: 8,  pricing_type: "on-demand", price_per_hour: 23.44, region: "US-West (SJC1)", availability: "high",   vcpus: 96, ram_gb: 640,  network_gbps: 200, interconnect: "NVLink",    fetched_at: NOW },
  { provider: "Lambda Labs", provider_slug: "lambda",  gpu_model: "H100 SXM 80GB",  gpu_count: 8,  pricing_type: "on-demand", price_per_hour: 19.84, region: "us-west-1",     availability: "high",   vcpus: 96, ram_gb: 768,  network_gbps: 25,  fetched_at: NOW },
  { provider: "AWS",        provider_slug: "aws",      gpu_model: "H100 SXM5 80GB", gpu_count: 8,  pricing_type: "on-demand", price_per_hour: 32.77, region: "us-east-1",     availability: "high",   vcpus: 192,ram_gb: 2048, network_gbps: 3200,fetched_at: NOW },
  { provider: "vast.ai",    provider_slug: "vastai",   gpu_model: "H100 SXM 80GB",  gpu_count: 8,  pricing_type: "spot",      price_per_hour: 15.20, region: "US",            availability: "medium", fetched_at: NOW },
  { provider: "vast.ai",    provider_slug: "vastai",   gpu_model: "H100 PCIe 80GB", gpu_count: 1,  pricing_type: "spot",      price_per_hour: 2.09,  region: "EU",            availability: "high",   fetched_at: NOW },
  { provider: "RunPod",     provider_slug: "runpod",   gpu_model: "H100 PCIe 80GB", gpu_count: 1,  pricing_type: "on-demand", price_per_hour: 2.49,  region: "US/EU (Secure)",availability: "high",   fetched_at: NOW },
  { provider: "RunPod",     provider_slug: "runpod",   gpu_model: "H100 SXM 80GB",  gpu_count: 1,  pricing_type: "spot",      price_per_hour: 1.99,  region: "US/EU (Comm.)", availability: "medium", fetched_at: NOW },
  { provider: "GCP",        provider_slug: "gcp",      gpu_model: "H100 SXM5 80GB", gpu_count: 8,  pricing_type: "on-demand", price_per_hour: 39.52, region: "us-central1",   availability: "high",   fetched_at: NOW },
  { provider: "GCP",        provider_slug: "gcp",      gpu_model: "H100 SXM5 80GB", gpu_count: 8,  pricing_type: "spot",      price_per_hour: 13.20, region: "us-central1",   availability: "low",    fetched_at: NOW },
  { provider: "Nebius",     provider_slug: "nebius",   gpu_model: "H100 SXM 80GB",  gpu_count: 8,  pricing_type: "on-demand", price_per_hour: 17.44, region: "EU-North",      availability: "medium", fetched_at: NOW },
  // ── A100 ──
  { provider: "CoreWeave", provider_slug: "coreweave", gpu_model: "A100 SXM 80GB",  gpu_count: 8,  pricing_type: "on-demand", price_per_hour: 18.40, region: "US-East (LGA1)", availability: "high",   vcpus: 96, ram_gb: 768, network_gbps: 200, interconnect: "NVLink+IB", fetched_at: NOW },
  { provider: "vast.ai",   provider_slug: "vastai",    gpu_model: "A100 SXM 80GB",  gpu_count: 1,  pricing_type: "spot",      price_per_hour: 0.98,  region: "US",            availability: "high",   fetched_at: NOW },
  { provider: "RunPod",    provider_slug: "runpod",    gpu_model: "A100 SXM 80GB",  gpu_count: 1,  pricing_type: "on-demand", price_per_hour: 1.44,  region: "US/EU (Secure)",availability: "high",   fetched_at: NOW },
  { provider: "Lambda Labs", provider_slug: "lambda",  gpu_model: "A100 SXM 80GB",  gpu_count: 8,  pricing_type: "on-demand", price_per_hour: 10.48, region: "us-west-1",     availability: "medium", fetched_at: NOW },
  { provider: "GCP",       provider_slug: "gcp",       gpu_model: "A100 SXM 80GB",  gpu_count: 8,  pricing_type: "spot",      price_per_hour: 6.54,  region: "us-central1",   availability: "medium", fetched_at: NOW },
  { provider: "AWS",       provider_slug: "aws",       gpu_model: "A100 SXM 80GB",  gpu_count: 8,  pricing_type: "on-demand", price_per_hour: 32.77, region: "us-east-1",     availability: "high",   fetched_at: NOW },
  // ── L40S ──
  { provider: "CoreWeave", provider_slug: "coreweave", gpu_model: "L40S 48GB", gpu_count: 8, pricing_type: "on-demand", price_per_hour: 14.40, region: "US-West (SJC1)", availability: "high",   fetched_at: NOW },
  { provider: "vast.ai",   provider_slug: "vastai",    gpu_model: "L40S 48GB", gpu_count: 1, pricing_type: "spot",      price_per_hour: 0.72,  region: "EU",            availability: "high",   fetched_at: NOW },
  { provider: "AWS",       provider_slug: "aws",       gpu_model: "L40S 48GB", gpu_count: 8, pricing_type: "on-demand", price_per_hour: 21.40, region: "us-east-1",     availability: "high",   fetched_at: NOW },
  // ── A10G ──
  { provider: "CoreWeave", provider_slug: "coreweave", gpu_model: "A10G 24GB", gpu_count: 8, pricing_type: "on-demand", price_per_hour: 6.32,  region: "US-East (LGA1)", availability: "high",  fetched_at: NOW },
  { provider: "vast.ai",   provider_slug: "vastai",    gpu_model: "A10G 24GB", gpu_count: 1, pricing_type: "spot",      price_per_hour: 0.22,  region: "US",            availability: "high",  fetched_at: NOW },
  { provider: "RunPod",    provider_slug: "runpod",    gpu_model: "A10G 24GB", gpu_count: 1, pricing_type: "on-demand", price_per_hour: 0.34,  region: "US/EU (Secure)",availability: "high",  fetched_at: NOW },
  { provider: "AWS",       provider_slug: "aws",       gpu_model: "A10G 24GB", gpu_count: 1, pricing_type: "on-demand", price_per_hour: 1.006, region: "us-east-1",     availability: "high",  fetched_at: NOW },
  // ── Azure ──
  { provider: "Azure", provider_slug: "azure", gpu_model: "H100 SXM 80GB", gpu_count: 8, pricing_type: "on-demand", price_per_hour: 98.32, region: "eastus",      availability: "high",   vcpus: 96,  ram_gb: 1900, network_gbps: 400, fetched_at: NOW },
  { provider: "Azure", provider_slug: "azure", gpu_model: "H100 SXM 80GB", gpu_count: 8, pricing_type: "spot",      price_per_hour: 18.17, region: "eastus",      availability: "low",    vcpus: 96,  ram_gb: 1900, network_gbps: 400, fetched_at: NOW },
  { provider: "Azure", provider_slug: "azure", gpu_model: "H100 NVL 80GB", gpu_count: 1, pricing_type: "on-demand", price_per_hour: 6.98,  region: "eastus",      availability: "high",   vcpus: 40,  ram_gb: 320,  network_gbps: 80,  fetched_at: NOW },
  { provider: "Azure", provider_slug: "azure", gpu_model: "A100 SXM 80GB", gpu_count: 8, pricing_type: "on-demand", price_per_hour: 88.49, region: "eastus",      availability: "high",   vcpus: 96,  ram_gb: 900,  network_gbps: 400, fetched_at: NOW },
  { provider: "Azure", provider_slug: "azure", gpu_model: "A100 PCIe 80GB",gpu_count: 1, pricing_type: "on-demand", price_per_hour: 3.67,  region: "eastus",      availability: "high",   vcpus: 24,  ram_gb: 220,  network_gbps: 40,  fetched_at: NOW },
  { provider: "Azure", provider_slug: "azure", gpu_model: "L40S 48GB",     gpu_count: 1, pricing_type: "on-demand", price_per_hour: 3.20,  region: "westus2",     availability: "medium", vcpus: 6,   ram_gb: 55,   network_gbps: 10,  fetched_at: NOW },
  // ── Oracle Cloud (OCI) ──
  { provider: "Oracle Cloud (OCI)", provider_slug: "oci", gpu_model: "H100 SXM 80GB",  gpu_count: 8, pricing_type: "on-demand", price_per_hour: 80.00, region: "us-ashburn-1",    availability: "high",   vcpus: 160, ram_gb: 2048, network_gbps: 1600, fetched_at: NOW },
  { provider: "Oracle Cloud (OCI)", provider_slug: "oci", gpu_model: "H100 SXM 80GB",  gpu_count: 8, pricing_type: "spot",      price_per_hour: 40.00, region: "us-ashburn-1",    availability: "low",    fetched_at: NOW },
  { provider: "Oracle Cloud (OCI)", provider_slug: "oci", gpu_model: "H200 SXM 141GB", gpu_count: 8, pricing_type: "on-demand", price_per_hour: 80.00, region: "us-ashburn-1",    availability: "medium", vcpus: 192, ram_gb: 2048, network_gbps: 1600, fetched_at: NOW },
  { provider: "Oracle Cloud (OCI)", provider_slug: "oci", gpu_model: "A100 SXM 80GB",  gpu_count: 8, pricing_type: "on-demand", price_per_hour: 56.00, region: "us-ashburn-1",    availability: "high",   vcpus: 128, ram_gb: 2048, network_gbps: 800,  fetched_at: NOW },
  { provider: "Oracle Cloud (OCI)", provider_slug: "oci", gpu_model: "AMD MI300X 192GB",gpu_count: 8, pricing_type: "on-demand", price_per_hour: 48.00, region: "us-ashburn-1",    availability: "medium", vcpus: 192, ram_gb: 2048, network_gbps: 1600, fetched_at: NOW },
  { provider: "Oracle Cloud (OCI)", provider_slug: "oci", gpu_model: "A10G 24GB",       gpu_count: 1, pricing_type: "on-demand", price_per_hour: 1.50,  region: "us-ashburn-1",    availability: "high",   vcpus: 15,  ram_gb: 240,  network_gbps: 24,   fetched_at: NOW },
  // ── IBM Cloud ──
  { provider: "IBM Cloud", provider_slug: "ibm", gpu_model: "H100 SXM 80GB",  gpu_count: 8, pricing_type: "on-demand", price_per_hour: 36.00, region: "us-south",  availability: "medium", vcpus: 160, ram_gb: 1792, fetched_at: NOW },
  { provider: "IBM Cloud", provider_slug: "ibm", gpu_model: "L40S 48GB",      gpu_count: 2, pricing_type: "on-demand", price_per_hour: 5.60,  region: "us-south",  availability: "medium", vcpus: 48,  ram_gb: 240,  fetched_at: NOW },
  { provider: "IBM Cloud", provider_slug: "ibm", gpu_model: "A100 PCIe 80GB", gpu_count: 4, pricing_type: "on-demand", price_per_hour: 17.20, region: "us-south",  availability: "medium", vcpus: 80,  ram_gb: 720,  fetched_at: NOW },
  // ── GMI Cloud ──
  { provider: "GMI Cloud", provider_slug: "gmi", gpu_model: "H100 SXM 80GB",  gpu_count: 8, pricing_type: "on-demand",   price_per_hour: 16.80, region: "us-west",   availability: "high",   vcpus: 128, ram_gb: 768, fetched_at: NOW },
  { provider: "GMI Cloud", provider_slug: "gmi", gpu_model: "H100 SXM 80GB",  gpu_count: 1, pricing_type: "on-demand",   price_per_hour: 2.10,  region: "us-west",   availability: "high",   vcpus: 16,  ram_gb: 96,  fetched_at: NOW },
  { provider: "GMI Cloud", provider_slug: "gmi", gpu_model: "H100 SXM 80GB",  gpu_count: 1, pricing_type: "spot",        price_per_hour: 1.49,  region: "us-west",   availability: "medium", fetched_at: NOW },
  { provider: "GMI Cloud", provider_slug: "gmi", gpu_model: "H200 SXM 141GB", gpu_count: 1, pricing_type: "on-demand",   price_per_hour: 3.35,  region: "us-west",   availability: "medium", vcpus: 16, ram_gb: 128,  fetched_at: NOW },
  { provider: "GMI Cloud", provider_slug: "gmi", gpu_model: "B200 SXM 192GB", gpu_count: 1, pricing_type: "on-demand",   price_per_hour: 6.00,  region: "us-west",   availability: "low",    fetched_at: NOW },
  { provider: "GMI Cloud", provider_slug: "gmi", gpu_model: "A100 SXM 80GB",  gpu_count: 1, pricing_type: "on-demand",   price_per_hour: 1.50,  region: "us-west",   availability: "high",   fetched_at: NOW },
  // ── Hyperstack ──
  { provider: "Hyperstack", provider_slug: "hyperstack", gpu_model: "H100 SXM 80GB",  gpu_count: 8, pricing_type: "on-demand", price_per_hour: 17.60, region: "NORWAY-1",  availability: "high",   vcpus: 128, ram_gb: 960, fetched_at: NOW },
  { provider: "Hyperstack", provider_slug: "hyperstack", gpu_model: "H100 SXM 80GB",  gpu_count: 1, pricing_type: "on-demand", price_per_hour: 2.20,  region: "NORWAY-1",  availability: "high",   vcpus: 16,  ram_gb: 120, fetched_at: NOW },
  { provider: "Hyperstack", provider_slug: "hyperstack", gpu_model: "A100 SXM 80GB",  gpu_count: 8, pricing_type: "on-demand", price_per_hour: 14.40, region: "NORWAY-1",  availability: "high",   vcpus: 96,  ram_gb: 640, fetched_at: NOW },
  { provider: "Hyperstack", provider_slug: "hyperstack", gpu_model: "RTX 4090 24GB",  gpu_count: 1, pricing_type: "on-demand", price_per_hour: 0.70,  region: "NORWAY-1",  availability: "high",   vcpus: 8,   ram_gb: 32,  fetched_at: NOW },
  // ── FluidStack ──
  { provider: "FluidStack", provider_slug: "fluidstack", gpu_model: "H100 SXM 80GB",  gpu_count: 8, pricing_type: "on-demand", price_per_hour: 18.40, region: "EU (Norway)",  availability: "medium", vcpus: 128, ram_gb: 768, fetched_at: NOW },
  { provider: "FluidStack", provider_slug: "fluidstack", gpu_model: "A100 SXM 80GB",  gpu_count: 1, pricing_type: "on-demand", price_per_hour: 1.60,  region: "EU (Norway)",  availability: "high",   vcpus: 12,  ram_gb: 80,  fetched_at: NOW },
  // ── Nebius ──
  { provider: "Nebius", provider_slug: "nebius", gpu_model: "H100 SXM 80GB",  gpu_count: 8, pricing_type: "on-demand", price_per_hour: 21.60, region: "eu-north1",  availability: "medium", vcpus: 160, ram_gb: 1280, fetched_at: NOW },
  { provider: "Nebius", provider_slug: "nebius", gpu_model: "H200 SXM 141GB", gpu_count: 8, pricing_type: "on-demand", price_per_hour: 24.00, region: "eu-north1",  availability: "medium", vcpus: 160, ram_gb: 1600, fetched_at: NOW },
  { provider: "Nebius", provider_slug: "nebius", gpu_model: "A100 SXM 80GB",  gpu_count: 8, pricing_type: "on-demand", price_per_hour: 16.00, region: "eu-north1",  availability: "medium", vcpus: 128, ram_gb: 768,  fetched_at: NOW },
  // ── Voltage Park ──
  { provider: "Voltage Park", provider_slug: "voltagepark", gpu_model: "H100 SXM 80GB",  gpu_count: 1,  pricing_type: "on-demand",    price_per_hour: 1.99,  region: "US-TX (Dallas)",   availability: "high",   vcpus: 26,  ram_gb: 230,  network_gbps: 200, fetched_at: NOW },
  { provider: "Voltage Park", provider_slug: "voltagepark", gpu_model: "H100 SXM 80GB",  gpu_count: 8,  pricing_type: "on-demand",    price_per_hour: 15.92, region: "US-TX (Dallas)",   availability: "high",   vcpus: 208, ram_gb: 1840, network_gbps: 400, fetched_at: NOW },
  { provider: "Voltage Park", provider_slug: "voltagepark", gpu_model: "H100 SXM 80GB",  gpu_count: 8,  pricing_type: "spot",         price_per_hour: 10.00, region: "US-TX (Dallas)",   availability: "medium", fetched_at: NOW },
  { provider: "Voltage Park", provider_slug: "voltagepark", gpu_model: "H100 SXM 80GB",  gpu_count: 8,  pricing_type: "reserved-1yr", price_per_hour: 11.20, region: "US-TX (Dallas)",   availability: "high",   fetched_at: NOW },
  { provider: "Voltage Park", provider_slug: "voltagepark", gpu_model: "B200 SXM 192GB", gpu_count: 8,  pricing_type: "on-demand",    price_per_hour: 40.00, region: "US-TX (Dallas)",   availability: "low",    fetched_at: NOW },
  { provider: "Voltage Park", provider_slug: "voltagepark", gpu_model: "A100 SXM 80GB",  gpu_count: 8,  pricing_type: "on-demand",    price_per_hour: 11.20, region: "US-TX (Dallas)",   availability: "medium", fetched_at: NOW },
  // ── Crusoe ──
  { provider: "Crusoe", provider_slug: "crusoe", gpu_model: "H100 SXM 80GB",   gpu_count: 1,  pricing_type: "on-demand", price_per_hour: 3.90,  region: "us-west-1 (Denver)", availability: "high",   vcpus: 24,  ram_gb: 200,  network_gbps: 100, fetched_at: NOW },
  { provider: "Crusoe", provider_slug: "crusoe", gpu_model: "H100 SXM 80GB",   gpu_count: 8,  pricing_type: "on-demand", price_per_hour: 31.20, region: "us-west-1 (Denver)", availability: "high",   vcpus: 192, ram_gb: 1600, network_gbps: 400, fetched_at: NOW },
  { provider: "Crusoe", provider_slug: "crusoe", gpu_model: "H100 SXM 80GB",   gpu_count: 8,  pricing_type: "spot",      price_per_hour: 20.80, region: "us-west-1 (Denver)", availability: "medium", fetched_at: NOW },
  { provider: "Crusoe", provider_slug: "crusoe", gpu_model: "H200 SXM 141GB",  gpu_count: 1,  pricing_type: "on-demand", price_per_hour: 4.29,  region: "us-west-1 (Denver)", availability: "medium", vcpus: 24, ram_gb: 200,  network_gbps: 200, fetched_at: NOW },
  { provider: "Crusoe", provider_slug: "crusoe", gpu_model: "A100 SXM 80GB",   gpu_count: 1,  pricing_type: "on-demand", price_per_hour: 1.65,  region: "us-west-1 (Denver)", availability: "high",   vcpus: 12, ram_gb: 100,  network_gbps: 25,  fetched_at: NOW },
  { provider: "Crusoe", provider_slug: "crusoe", gpu_model: "A100 SXM 80GB",   gpu_count: 1,  pricing_type: "spot",      price_per_hour: 1.20,  region: "us-west-1 (Denver)", availability: "medium", fetched_at: NOW },
  { provider: "Crusoe", provider_slug: "crusoe", gpu_model: "AMD MI300X 192GB", gpu_count: 8, pricing_type: "on-demand", price_per_hour: 36.00, region: "us-west-1 (Denver)", availability: "low",    fetched_at: NOW },
  { provider: "Crusoe", provider_slug: "crusoe", gpu_model: "L40S 48GB",        gpu_count: 1, pricing_type: "on-demand", price_per_hour: 1.80,  region: "us-west-1 (Denver)", availability: "medium", fetched_at: NOW },
];

const SEED_ENERGY: EnergyPrice[] = [
  { region: "US-West (CAISO)",   grid_operator: "CAISO",     price_per_kwh: 0.042, carbon_intensity_gco2_kwh: 84,  renewable_pct: 52, timestamp: NOW, source: "seed", fetched_at: NOW },
  { region: "US-East (PJM)",     grid_operator: "PJM",       price_per_kwh: 0.061, carbon_intensity_gco2_kwh: 165, renewable_pct: 22, timestamp: NOW, source: "seed", fetched_at: NOW },
  { region: "US-South (ERCOT)",  grid_operator: "ERCOT",     price_per_kwh: 0.104, carbon_intensity_gco2_kwh: 195, renewable_pct: 31, timestamp: NOW, source: "seed", fetched_at: NOW },
  { region: "US-NW (NWPP)",      grid_operator: "NWPP",      price_per_kwh: 0.038, carbon_intensity_gco2_kwh: 72,  renewable_pct: 68, timestamp: NOW, source: "seed", fetched_at: NOW },
  { region: "EU-North (Nordic)", grid_operator: "Nord Pool",  price_per_kwh: 0.031, carbon_intensity_gco2_kwh: 21,  renewable_pct: 88, timestamp: NOW, source: "seed", fetched_at: NOW },
  { region: "EU-West (Germany)", grid_operator: "ENTSO-E",   price_per_kwh: 0.089, carbon_intensity_gco2_kwh: 120, renewable_pct: 57, timestamp: NOW, source: "seed", fetched_at: NOW },
  { region: "EU-West (France)",  grid_operator: "ENTSO-E",   price_per_kwh: 0.071, carbon_intensity_gco2_kwh: 58,  renewable_pct: 73, timestamp: NOW, source: "seed", fetched_at: NOW },
  { region: "APAC (Singapore)",  grid_operator: "EMA",       price_per_kwh: 0.102, carbon_intensity_gco2_kwh: 408, renewable_pct: 4,  timestamp: NOW, source: "seed", fetched_at: NOW },
  { region: "APAC (Tokyo)",      grid_operator: "TEPCO",     price_per_kwh: 0.115, carbon_intensity_gco2_kwh: 462, renewable_pct: 22, timestamp: NOW, source: "seed", fetched_at: NOW },
];

async function seed() {
  console.log("🌱 Seeding database...\n");

  try {
    await upsertGpuListings(SEED_LISTINGS);
    console.log(`✓ Inserted ${SEED_LISTINGS.length} GPU listings`);

    await upsertEnergyPrices(SEED_ENERGY);
    console.log(`✓ Inserted ${SEED_ENERGY.length} energy price records`);

    console.log("\n✅ Seed complete. Run `npm run dev` to see the dashboard.");
  } catch (err) {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  }
}

seed();
