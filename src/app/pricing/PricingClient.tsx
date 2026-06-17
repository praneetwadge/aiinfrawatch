// @ts-nocheck
"use client";

import React, { useEffect, useState } from "react";

const T = {
  bg: "#F7F3EA", panel: "#FFFFFF", ink: "#171717", sub: "#5A5347",
  line: "#E6E0D3", lineStrong: "#D8D1C1",
  blue: "#1E5EFF", green: "#087F5B", amber: "#B7791F", red: "#B42318",
  serif: "'Source Serif 4', Georgia, serif",
  display: "'Playfair Display', Georgia, serif",
  mono: "'DM Mono', ui-monospace, monospace",
};

const PLAYBOOK_PRICE = 490;   // one-time
const WATCH_PRICE = 149;      // per month

function money(n: number) {
  if (!isFinite(n) || n <= 0) return "$0";
  return "$" + Math.round(n).toLocaleString("en-US");
}

export default function PricingClient() {
  const [savings, setSavings] = useState<number | null>(null);
  const [gpu, setGpu] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const s = parseInt(q.get("savings") || "", 10);
    if (isFinite(s) && s > 0) setSavings(s);
    setGpu(q.get("gpu"));
  }, []);

  const playbookPctOfSavings = savings ? (PLAYBOOK_PRICE / savings) * 100 : null;
  const watchPctOfSavings = savings ? ((WATCH_PRICE * 12) / savings) * 100 : null;

  return (
    <div style={{ background: T.bg, color: T.ink, fontFamily: T.serif }}>
      <Style />
      <div className="p-wrap">
        <header className="p-hero">
          <div className="p-eyebrow">PRICING · PAY A FRACTION OF WHAT WE FIND</div>
          <h1 className="p-h1">The audit is free. You only pay to capture the savings.</h1>
          <p className="p-lede">
            Every paid tier is priced against money we've already shown you. If we don't find
            meaningful overpayment, you don't need us — and you've lost nothing but a paste.
          </p>
        </header>

        {savings != null && (
          <div className="p-anchor">
            <div>
              <div className="p-anchorLabel">We estimated your overpayment at</div>
              <div className="p-anchorBig">{money(savings)}<span>/yr{gpu ? ` · ${gpu}` : ""}</span></div>
            </div>
            <div className="p-anchorNote">
              The Migration Playbook below is <b>{playbookPctOfSavings!.toFixed(1)}%</b> of that.
              Monitoring for a year is <b>{watchPctOfSavings!.toFixed(1)}%</b>.
            </div>
          </div>
        )}

        <section className="p-grid">
          {/* FREE */}
          <Tier
            name="Instant Audit"
            price="Free"
            sub="No account. Number renders in-browser."
            audience="Anyone sizing the problem"
            features={[
              "Estimated overpayment vs. reliable market floor",
              "Hyperscaler premium portion isolated",
              "Confidence + assumptions shown honestly",
            ]}
            ctaLabel="Run an audit →"
            ctaHref="/cost-audit"
          />

          {/* PLAYBOOK */}
          <Tier
            name="Migration Playbook"
            price={`${money(PLAYBOOK_PRICE)}`}
            priceUnit="one-time"
            anchor={savings ? `≈ ${playbookPctOfSavings!.toFixed(1)}% of your ${money(savings)}/yr` : "priced under what we find"}
            sub="Move now, safely — without a sales call."
            audience="Startups & teams cutting burn this quarter"
            highlight
            features={[
              "Workload-by-workload plan: move now vs. stay production-stable",
              "Target providers, regions, and GPU families per job",
              "Migration risk + rollback notes for each move",
              "Side-by-side before/after monthly cost",
              "One revision after you act",
            ]}
            ctaLabel="Get the playbook →"
            ctaHref="/cost-audit"
          />

          {/* WATCH */}
          <Tier
            name="AIInfraWatch"
            price={`${money(WATCH_PRICE)}`}
            priceUnit="/mo"
            anchor={savings ? `≈ ${watchPctOfSavings!.toFixed(1)}% of yearly savings` : "the recurring watch"}
            sub="Stay below market as prices move."
            audience="FinOps & platform leads who must show ROI"
            features={[
              "Drift alerts when your stack rises above market",
              "Monthly board-ready ROI report (savings realized)",
              "On-demand re-audit whenever you scale",
              "Provider concentration & availability warnings",
            ]}
            ctaLabel="Start monitoring →"
            ctaHref="/cost-audit?intent=watch"
          />

          {/* ENTERPRISE */}
          <Tier
            name="Enterprise"
            price="Talk to us"
            sub="Leverage, defensibility, procurement."
            audience="CIOs & infra orgs with committed spend"
            features={[
              "Your committed-use rate vs. live market — export for negotiation",
              "Procurement-ready methodology + data lineage",
              "Security pack (SOC 2 path, data handling, SSO)",
              "Multi-seat, multiple stacks, quarterly review",
            ]}
            ctaLabel="Book a working session →"
            ctaHref="/cost-audit?intent=enterprise"
          />
        </section>

        <div className="p-why">
          <h2 className="p-h2">Why pricing works this way</h2>
          <p>
            A GPU price dashboard isn't worth paying for — the numbers are half-public. What's worth
            paying for is the gap between your bill and the market, made specific to your workloads and
            de-risked enough to act on. So we show you that gap for free, and charge a sliver of it to
            close it. If the gap is small, keep your money.
          </p>
        </div>

        <p className="p-disclaimer">
          Estimates are indicative and depend on workload shape, reliability needs, utilization, and
          contract terms. The Playbook quantifies realistic, reliability-preserving savings — not the
          theoretical floor.
        </p>
      </div>
    </div>
  );
}

function Tier({ name, price, priceUnit, anchor, sub, audience, features, ctaLabel, ctaHref, highlight }: any) {
  return (
    <div className={"p-tier" + (highlight ? " p-tierHi" : "")}>
      {highlight && <div className="p-flag">MOST CHOSEN</div>}
      <div className="p-tierName">{name}</div>
      <div className="p-audience">{audience}</div>
      <div className="p-priceRow">
        <span className="p-price">{price}</span>
        {priceUnit && <span className="p-priceUnit">{priceUnit}</span>}
      </div>
      {anchor && <div className="p-tierAnchor">{anchor}</div>}
      <div className="p-tierSub">{sub}</div>
      <ul className="p-feats">
        {features.map((f: string, i: number) => <li key={i}>{f}</li>)}
      </ul>
      <a className={"p-cta" + (highlight ? " p-ctaHi" : "")} href={ctaHref}>{ctaLabel}</a>
    </div>
  );
}

function Style() {
  return (
    <style>{`
    .p-wrap{max-width:1140px;margin:0 auto;padding:48px 20px 80px;}
    .p-hero{max-width:740px;margin-bottom:28px;}
    .p-eyebrow{font-family:${T.mono};font-size:12px;letter-spacing:.12em;color:${T.sub};margin-bottom:14px;}
    .p-h1{font-family:${T.display};font-weight:700;font-size:clamp(30px,5vw,46px);line-height:1.05;letter-spacing:-.01em;margin:0 0 14px;}
    .p-lede{font-size:18px;line-height:1.55;color:${T.sub};margin:0;}
    .p-anchor{display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap;
      background:#FCFAF4;border:1px solid ${T.lineStrong};border-radius:4px;padding:18px 22px;margin-bottom:28px;}
    .p-anchorLabel{font-family:${T.mono};font-size:12px;color:${T.sub};letter-spacing:.06em;}
    .p-anchorBig{font-family:${T.display};font-weight:700;font-size:34px;color:${T.red};line-height:1;margin-top:4px;}
    .p-anchorBig span{font-family:${T.mono};font-size:14px;color:${T.sub};margin-left:8px;}
    .p-anchorNote{font-size:14.5px;color:${T.sub};max-width:300px;}
    .p-anchorNote b{color:${T.green};}
    .p-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;align-items:stretch;}
    @media(max-width:980px){.p-grid{grid-template-columns:1fr 1fr;}}
    @media(max-width:560px){.p-grid{grid-template-columns:1fr;}}
    .p-tier{position:relative;background:${T.panel};border:1px solid ${T.line};border-radius:4px;padding:22px;display:flex;flex-direction:column;}
    .p-tierHi{border:1.5px solid ${T.ink};box-shadow:0 2px 0 ${T.lineStrong};}
    .p-flag{position:absolute;top:-10px;left:22px;background:${T.ink};color:${T.bg};font-family:${T.mono};
      font-size:10px;letter-spacing:.1em;padding:3px 8px;border-radius:2px;}
    .p-tierName{font-family:${T.display};font-size:21px;font-weight:700;margin-top:4px;}
    .p-audience{font-size:13px;color:${T.sub};margin:4px 0 14px;min-height:34px;}
    .p-priceRow{display:flex;align-items:baseline;gap:6px;}
    .p-price{font-family:${T.mono};font-size:30px;color:${T.ink};}
    .p-priceUnit{font-family:${T.mono};font-size:13px;color:${T.sub};}
    .p-tierAnchor{font-family:${T.mono};font-size:12px;color:${T.green};margin-top:6px;}
    .p-tierSub{font-size:14px;color:${T.ink};margin:10px 0 14px;border-top:1px solid ${T.line};padding-top:12px;}
    .p-feats{list-style:none;margin:0 0 18px;padding:0;display:flex;flex-direction:column;gap:9px;flex:1;}
    .p-feats li{font-size:13.5px;line-height:1.45;color:${T.sub};padding-left:16px;position:relative;}
    .p-feats li:before{content:"";position:absolute;left:0;top:7px;width:6px;height:6px;background:${T.blue};border-radius:50%;}
    .p-cta{display:block;text-align:center;text-decoration:none;border:1px solid ${T.ink};color:${T.ink};
      font-family:${T.mono};font-size:13px;padding:11px;border-radius:3px;transition:background .15s,color .15s;}
    .p-cta:hover{background:${T.ink};color:${T.bg};}
    .p-ctaHi{background:${T.ink};color:${T.bg};}
    .p-ctaHi:hover{background:#000;}
    .p-why{max-width:720px;margin:48px 0 0;}
    .p-h2{font-family:${T.display};font-size:24px;margin:0 0 10px;}
    .p-why p{font-size:16px;line-height:1.6;color:${T.sub};margin:0;}
    .p-disclaimer{max-width:720px;margin:24px 0 0;font-size:13px;line-height:1.55;color:${T.sub};}
    .p-cta:focus-visible,.p-ctaHi:focus-visible{outline:2px solid ${T.blue};outline-offset:2px;}
    `}</style>
  );
}
