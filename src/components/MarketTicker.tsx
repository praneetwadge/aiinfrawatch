"use client";

import React, { useMemo, useRef, useEffect } from "react";
import { GpuListing, HYPERSCALERS, fmtP, getMeta } from "@/lib/market-helpers";

const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)" };
const DURATION = 60; // seconds — wall-clock anchor for reset-free scroll

interface MarketSummaryLike {
  last_updated?: string;
  total_listings?: number;
  active_providers?: number;
}

interface MarketTickerProps {
  listings: GpuListing[];
  summary?: MarketSummaryLike | null;
}

const floorReliable = (items: GpuListing[]): number | null => {
  const r = items.filter(i => i.availability === "high" && i.pricing_type !== "spot");
  return r.length ? Math.min(...r.map(i => i.price_per_hour)) : null;
};

const floorAny = (items: GpuListing[]): number | null =>
  items.length ? Math.min(...items.map(i => i.price_per_hour)) : null;

export default function MarketTicker({ listings, summary }: MarketTickerProps) {
  const innerRef = useRef<HTMLDivElement>(null);

  // Sync animation to wall clock so remounts on navigation never restart from 0
  useEffect(() => {
    if (!innerRef.current) return;
    const elapsed = (Date.now() / 1000) % DURATION;
    innerRef.current.style.animationDelay = `-${elapsed}s`;
    innerRef.current.style.animationPlayState = "running";
  }, []);

  const items = useMemo(() => {
    const h100 = listings.filter(i => i.gpu_model.toUpperCase().includes("H100"));
    const a100 = listings.filter(i => i.gpu_model.toUpperCase().includes("A100"));
    const l40s = listings.filter(i => i.gpu_model.toUpperCase().includes("L40S"));
    const a10g = listings.filter(i => i.gpu_model.toUpperCase().includes("A10G"));

    // Best available floor per model
    const h100Price = floorReliable(h100) ?? floorAny(h100);
    const a100Price = floorReliable(a100) ?? floorAny(a100);
    const l40sPrice = floorReliable(l40s) ?? floorAny(l40s);
    const a10gPrice = floorReliable(a10g) ?? floorAny(a10g);

    // H100 hyperscaler premium
    const h100Hyper = h100.filter(i => HYPERSCALERS.includes(i.provider.toLowerCase()));
    const h100Spec  = h100.filter(i => !HYPERSCALERS.includes(i.provider.toLowerCase()));
    const hyperAvg  = h100Hyper.length ? h100Hyper.reduce((s, i) => s + i.price_per_hour, 0) / h100Hyper.length : 0;
    const specAvg   = h100Spec.length  ? h100Spec.reduce((s, i)  => s + i.price_per_hour, 0) / h100Spec.length  : 0;
    const premium   = specAvg > 0 && hyperAvg > 0 ? Math.round((hyperAvg / specAvg - 1) * 100) : null;

    // Top supply concentration
    const counts = listings.reduce<Record<string, number>>((acc, i) => {
      acc[i.provider] = (acc[i.provider] ?? 0) + 1;
      return acc;
    }, {});
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const topShare = top && listings.length ? Math.round((top[1] / listings.length) * 100) : null;

    const providerCount = new Set(listings.map(i => i.provider)).size;

    const base = [
      h100Price !== null ? `H100 ${fmtP(h100Price)}/hr` : null,
      a100Price !== null ? `A100 ${fmtP(a100Price)}/hr` : null,
      l40sPrice !== null ? `L40S ${fmtP(l40sPrice)}/hr` : null,
      a10gPrice !== null ? `A10G ${fmtP(a10gPrice)}/hr` : null,
      top && topShare !== null ? `${getMeta(top[0]).short} ${topShare}% SUPPLY` : null,
      premium !== null && premium > 0 ? `H100 HYPERSCALER +${premium}%` : null,
      providerCount > 0 ? `${providerCount} PROVIDERS` : null,
    ].filter(Boolean) as string[];

    return [...base, ...base]; // double for seamless loop
  }, [listings]);

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
      <div
        ref={innerRef}
        style={{
          display: "flex",
          whiteSpace: "nowrap",
          animation: `ribbon-scroll ${DURATION}s linear infinite`,
          animationPlayState: "paused", // useEffect syncs and starts
        }}
      >
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
