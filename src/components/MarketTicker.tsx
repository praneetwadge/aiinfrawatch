"use client";

import React, { useMemo } from "react";
import { GpuListing, fmtP, getMeta, minsAgo } from "@/lib/market-helpers";

const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)" };

interface MarketSummaryLike {
  last_updated?: string;
  total_listings?: number;
  active_providers?: number;
}

interface MarketTickerProps {
  listings: GpuListing[];
  summary?: MarketSummaryLike | null;
}

const minPrice = (items: GpuListing[]) =>
  items.length ? Math.min(...items.map(item => item.price_per_hour)) : null;

export default function MarketTicker({ listings, summary }: MarketTickerProps) {
  const items = useMemo(() => {
    const h100 = listings.filter(item => item.gpu_model.toUpperCase().includes("H100"));
    const a100 = listings.filter(item => item.gpu_model.toUpperCase().includes("A100"));
    const l40s = listings.filter(item => item.gpu_model.toUpperCase().includes("L40S"));
    const reliable = listings.filter(item => item.availability === "high");
    const cheapestReliable = [...reliable].sort((a, b) => a.price_per_hour - b.price_per_hour)[0];
    const cheapestObserved = [...listings].sort((a, b) => a.price_per_hour - b.price_per_hour)[0];

    const h100Reliable = minPrice(h100.filter(item => item.availability === "high"));
    const h100Observed = minPrice(h100);
    const a100Reliable = minPrice(a100.filter(item => item.availability === "high"));
    const a100Observed = minPrice(a100);
    const l40sLow = minPrice(l40s);

    const providerCounts = listings.reduce<Record<string, number>>((acc, item) => {
      acc[item.provider] = (acc[item.provider] ?? 0) + 1;
      return acc;
    }, {});
    const topProvider = Object.entries(providerCounts).sort((a, b) => b[1] - a[1])[0];
    const topProviderShare = topProvider && listings.length
      ? Math.round((topProvider[1] / listings.length) * 100)
      : null;

    const highAvailabilityShare = listings.length
      ? Math.round((reliable.length / listings.length) * 100)
      : null;

    const base = [
      "AI Compute Market · Live",
      cheapestReliable
        ? `Reliable floor ${fmtP(cheapestReliable.price_per_hour)}/hr · ${getMeta(cheapestReliable.provider).short}`
        : cheapestObserved
          ? `Observed floor ${fmtP(cheapestObserved.price_per_hour)}/hr · ${getMeta(cheapestObserved.provider).short}`
          : "Market snapshot loading",
      h100Reliable !== null
        ? `H100 reliable from ${fmtP(h100Reliable)}/hr`
        : h100Observed !== null
          ? `H100 observed from ${fmtP(h100Observed)}/hr · reliability scarce`
          : "H100 scarce in current snapshot",
      a100Reliable !== null
        ? `A100 reliable from ${fmtP(a100Reliable)}/hr`
        : a100Observed !== null
          ? `A100 observed from ${fmtP(a100Observed)}/hr`
          : null,
      l40sLow !== null ? `L40S floor ${fmtP(l40sLow)}/hr` : null,
      topProvider && topProviderShare !== null
        ? `Supply concentration: ${getMeta(topProvider[0]).short} ${topProviderShare}%`
        : null,
      highAvailabilityShare !== null
        ? `High-availability capacity: ${highAvailabilityShare}%`
        : null,
      summary?.last_updated ? `Updated ${minsAgo(summary.last_updated)}` : null,
    ].filter(Boolean) as string[];

    return [...base, ...base];
  }, [listings, summary]);

  return (
    <div style={{
      height: 30,
      background: "#171717",
      borderBottom: "1px solid rgba(20,20,20,0.15)",
      overflow: "hidden",
      display: "flex",
      alignItems: "center",
      width: "100%",
    }}>
      <div style={{ display: "flex", whiteSpace: "nowrap", animation: "ribbon-scroll 70s linear infinite" }}>
        {items.map((item, index) => (
          <span
            key={`${item}-${index}`}
            style={{
              ...MONO,
              fontSize: 10.5,
              color: "rgba(247,243,234,0.58)",
              padding: "0 28px",
              borderRight: "1px solid rgba(247,243,234,0.1)",
              letterSpacing: "0.03em",
            }}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
