"use client";

import React, { useMemo } from "react";
import { GpuListing, getMeta, fmtP } from "@/lib/market-helpers";

const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)" };

type MarketTickerProps = {
  listings?: GpuListing[];
  compact?: boolean;
};

const minPrice = (items: GpuListing[]) =>
  items.length ? Math.min(...items.map(item => item.price_per_hour)) : null;

export default function MarketTicker({ listings = [], compact = false }: MarketTickerProps) {
  const items = useMemo(() => {
    const live = listings.length > 0;
    const h100 = listings.filter(l => l.gpu_model.toUpperCase().includes("H100"));
    const h100High = h100.filter(l => l.availability === "high");
    const a100 = listings.filter(l => l.gpu_model.toUpperCase().includes("A100"));
    const a100High = a100.filter(l => l.availability === "high");
    const l40s = listings.filter(l => l.gpu_model.toUpperCase().includes("L40S"));
    const highAvail = listings.filter(l => l.availability === "high");
    const cheapestHigh = [...highAvail].sort((a, b) => a.price_per_hour - b.price_per_hour)[0];

    const providerCounts = listings.reduce<Record<string, number>>((acc, listing) => {
      acc[listing.provider] = (acc[listing.provider] ?? 0) + 1;
      return acc;
    }, {});
    const topProvider = Object.entries(providerCounts).sort((a, b) => b[1] - a[1])[0];
    const concentration = topProvider && listings.length
      ? `${Math.round((topProvider[1] / listings.length) * 100)}% ${getMeta(topProvider[0]).short} concentration`
      : null;

    const h100Reliable = minPrice(h100High);
    const h100Observed = minPrice(h100);
    const a100Reliable = minPrice(a100High);
    const l40sLow = minPrice(l40s);
    const capacityPct = listings.length ? Math.round((highAvail.length / listings.length) * 100) : null;

    const marketItems = [
      "AI compute tape · live market signals",
      h100Reliable !== null
        ? `H100 reliable floor ${fmtP(h100Reliable)}/hr`
        : h100Observed !== null
          ? `H100 observed floor ${fmtP(h100Observed)}/hr`
          : "H100 availability scarce in snapshot",
      a100Reliable !== null ? `A100 reliable floor ${fmtP(a100Reliable)}/hr` : "A100 reliable capacity fragmented",
      l40sLow !== null ? `L40S observed from ${fmtP(l40sLow)}/hr` : "L40S spread not in snapshot",
      cheapestHigh ? `Cheapest high-availability ${fmtP(cheapestHigh.price_per_hour)}/hr · ${getMeta(cheapestHigh.provider).short}` : null,
      concentration,
      capacityPct !== null ? `High-availability coverage ${capacityPct}%` : null,
      "Cost audit converts public prices into workload decisions",
    ].filter(Boolean) as string[];

    const fallback = [
      "AI compute tape · market signals",
      "H100 reliable floor changing by provider and region",
      "A100 spot vs reliable gap creates audit opportunity",
      "L40S capacity useful for evals and batch inference",
      "High-availability supply is the real constraint",
      "Cost audit converts public prices into workload decisions",
    ];

    const base = live ? marketItems : fallback;
    return [...base, ...base];
  }, [listings]);

  return (
    <div style={{
      height: compact ? 28 : 30,
      background: "#171717",
      borderBottom: "1px solid rgba(20,20,20,0.18)",
      overflow: "hidden",
      display: "flex",
      alignItems: "center",
    }}>
      <div style={{ display: "flex", whiteSpace: "nowrap", animation: "ribbon-scroll 68s linear infinite" }}>
        {items.map((item, i) => (
          <span key={`${item}-${i}`} style={{
            ...MONO,
            fontSize: compact ? 10 : 10.5,
            color: "rgba(247,243,234,0.62)",
            padding: "0 28px",
            borderRight: "1px solid rgba(247,243,234,0.1)",
            letterSpacing: "0.035em",
          }}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
