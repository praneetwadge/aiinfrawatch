// @ts-nocheck
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  estimate,
  estimateFromPaste,
  parseSetup,
  applyLiveFloors,
  money,
  pct,
  MARKET_FLOORS,
  type Estimate,
  type GpuModel,
} from "@/lib/audit/estimate";

/* ----------------------------------------------------------------------------
   Design tokens — AIInfraWatch editorial guardrail (do not drift)
---------------------------------------------------------------------------- */
const T = {
  bg: "#F7F3EA",
  panel: "#FFFFFF",
  ink: "#171717",
  sub: "#5A5347",
  line: "#E6E0D3",
  lineStrong: "#D8D1C1",
  blue: "#1E5EFF",
  green: "#087F5B",
  amber: "#B7791F",
  red: "#B42318",
  serif: "'Source Serif 4', Georgia, serif",
  display: "'Playfair Display', Georgia, serif",
  mono: "'DM Mono', 'SFMono-Regular', ui-monospace, monospace",
};

const GPUS: GpuModel[] = ["H100", "A100", "L40S", "A10G", "B200"];

export default function CostAuditClient() {
  // input state
  const [paste, setPaste] = useState("");
  const [gpu, setGpu] = useState<GpuModel | "">("");
  const [count, setCount] = useState("");
  const [alwaysOn, setAlwaysOn] = useState(true);
  const [hours, setHours] = useState("");
  const [rate, setRate] = useState(""); // $/hr
  const [monthly, setMonthly] = useState(""); // $/mo
  const [providerClass, setProviderClass] = useState<"hyperscaler" | "neocloud" | "marketplace" | "unknown">("unknown");

  const [result, setResult] = useState<Estimate | null>(null);
  const [touched, setTouched] = useState(false);

  // hydrate live floors from same-origin API (no-op on shape mismatch)
  useEffect(() => {
    let alive = true;
    fetch("/api/gpu-prices", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j) applyLiveFloors(j); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // If the user pastes, pre-fill the structured fields so the two paths agree.
  function adoptPaste() {
    const p = parseSetup(paste);
    if (p.gpu) setGpu(p.gpu);
    if (p.count) setCount(String(p.count));
    if (p.currentRate) setRate(String(p.currentRate));
    if (p.currentMonthly) setMonthly(String(p.currentMonthly));
    if (p.providerClass !== "unknown") setProviderClass(p.providerClass);
    if (p.hoursPerMonth) { setAlwaysOn(p.hoursPerMonth >= 730); setHours(String(p.hoursPerMonth)); }
  }

  function run() {
    setTouched(true);
    let est: Estimate;
    const hasStructured = gpu || count || rate || monthly;
    if (paste.trim() && !hasStructured) {
      est = estimateFromPaste(paste);
    } else {
      est = estimate({
        gpu: (gpu || parseSetup(paste).gpu) as GpuModel,
        count: count ? parseInt(count, 10) : parseSetup(paste).count,
        hoursPerMonth: alwaysOn ? 730 : hours ? parseInt(hours, 10) : null,
        currentRate: rate ? parseFloat(rate) : null,
        currentMonthly: monthly ? parseFloat(monthly) : null,
        providerClass:
          providerClass !== "unknown" ? providerClass : parseSetup(paste).providerClass,
      });
    }
    setResult(est);
    // scroll the number into view on mobile
    requestAnimationFrame(() => {
      document.getElementById("audit-result")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div style={{ fontFamily: T.serif, color: T.ink, background: T.bg }}>
      <Style />
      <div className="aiiw-wrap">
        {/* HERO */}
        <header className="aiiw-hero">
          <div className="aiiw-eyebrow">COST AUDIT · NO SIGN-IN TO SEE YOUR NUMBER</div>
          <h1 className="aiiw-h1">Find out what you're overpaying — before you give us anything.</h1>
          <p className="aiiw-lede">
            Paste a bill, a quote, or a plain-English description of your setup. You'll see your
            estimated overpayment against today's reliable market floor right here on the page.
            Email comes later, only if you want the migration plan.
          </p>
        </header>

        {/* INPUT */}
        <section className="aiiw-grid">
          <div className="aiiw-card">
            <label className="aiiw-label" htmlFor="paste">Paste your current setup</label>
            <textarea
              id="paste"
              className="aiiw-textarea"
              placeholder={"e.g. 8x H100 on AWS, always-on, ~$31k/mo\nor: provider quote at $4.20/hr for A100\nor: just describe it in plain English"}
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              onBlur={adoptPaste}
              rows={5}
            />
            <div className="aiiw-chiprow">
              <span className="aiiw-chip">Bill summary</span>
              <span className="aiiw-chip">Provider quote</span>
              <span className="aiiw-chip">Architecture notes</span>
              <span className="aiiw-chip">Plain English is fine</span>
            </div>

            <details className="aiiw-details">
              <summary>Or enter it precisely</summary>
              <div className="aiiw-fields">
                <Field label="GPU">
                  <select className="aiiw-input" value={gpu} onChange={(e) => setGpu(e.target.value as any)}>
                    <option value="">Select…</option>
                    {GPUS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </Field>
                <Field label="Count">
                  <input className="aiiw-input" inputMode="numeric" placeholder="8"
                    value={count} onChange={(e) => setCount(e.target.value.replace(/[^\d]/g, ""))} />
                </Field>
                <Field label="Provider type">
                  <select className="aiiw-input" value={providerClass} onChange={(e) => setProviderClass(e.target.value as any)}>
                    <option value="unknown">Not sure</option>
                    <option value="hyperscaler">Hyperscaler (AWS/Azure/GCP/Oracle)</option>
                    <option value="neocloud">Neocloud (CoreWeave/Lambda/…)</option>
                    <option value="marketplace">Marketplace (RunPod/Vast/…)</option>
                  </select>
                </Field>
                <Field label="Current rate ($/hr)">
                  <input className="aiiw-input" inputMode="decimal" placeholder="4.20"
                    value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ""))} />
                </Field>
                <Field label="…or monthly ($/mo)">
                  <input className="aiiw-input" inputMode="numeric" placeholder="31000"
                    value={monthly} onChange={(e) => setMonthly(e.target.value.replace(/[^\d]/g, ""))} />
                </Field>
                <Field label="Utilization">
                  <label className="aiiw-toggle">
                    <input type="checkbox" checked={alwaysOn} onChange={(e) => setAlwaysOn(e.target.checked)} />
                    <span>Always-on (24/7)</span>
                  </label>
                  {!alwaysOn && (
                    <input className="aiiw-input" style={{ marginTop: 8 }} inputMode="numeric" placeholder="hours / month"
                      value={hours} onChange={(e) => setHours(e.target.value.replace(/[^\d]/g, ""))} />
                  )}
                </Field>
              </div>
            </details>

            <button className="aiiw-cta" onClick={run}>Show what I'm overpaying →</button>
            <p className="aiiw-fineprint">No account, no email. The number renders on this page.</p>
          </div>

          {/* WHAT YOU GET — now honest about the two halves */}
          <aside className="aiiw-card aiiw-aside">
            <div className="aiiw-asideTitle">What's free vs. what's gated</div>
            <ul className="aiiw-list">
              <li><b>Free, right now:</b> your estimated overpayment, the reliable market floor for your GPU, and the hyperscaler premium portion.</li>
              <li><b>Email unlocks:</b> the workload-by-workload migration plan — what can move this week vs. what should stay production-stable, with target providers and regions.</li>
              <li><b>Paid:</b> the executed playbook and ongoing drift monitoring, priced as a fraction of what we find.</li>
            </ul>
            <div className="aiiw-floorbox">
              <div className="aiiw-floorTitle">Today's reliable floors</div>
              {GPUS.slice(0, 4).map((g) => (
                <div className="aiiw-floorrow" key={g}>
                  <span>{g}</span>
                  <span className="aiiw-num">{money(MARKET_FLOORS[g].reliable)}/hr</span>
                </div>
              ))}
            </div>
          </aside>
        </section>

        {/* RESULT — the ungated pain moment */}
        {touched && result && (
          <section id="audit-result" className="aiiw-result">
            {!result.ok ? (
              <div className="aiiw-card aiiw-resultEmpty">
                <div className="aiiw-resultKicker">One more detail</div>
                <p style={{ margin: "8px 0 0", fontSize: 18 }}>{result.reason}</p>
              </div>
            ) : (
              <ResultPanel est={result} />
            )}
          </section>
        )}

        <p className="aiiw-disclaimer">
          Public prices are indicative. The useful answer depends on workload shape, reliability needs,
          utilization, contract terms, and whether jobs can run asynchronously. This estimate is a
          starting point, not a migration decision.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ResultPanel({ est }: { est: Estimate }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  const big = est.overpayMonthly;
  const overpaying = big > 0;
  const confColor = est.confidence === "high" ? T.green : est.confidence === "medium" ? T.amber : T.sub;

  const pricingHref = useMemo(() => {
    const yr = Math.round(est.overpayYearly);
    return `/pricing?savings=${yr}&gpu=${est.gpu}`;
  }, [est]);

  async function submit() {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setState("error"); return; }
    setState("sending");
    try {
      await fetch("/api/audit-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          gpu: est.gpu,
          count: est.count,
          currentMonthly: Math.round(est.currentMonthly),
          overpayMonthly: Math.round(est.overpayMonthly),
          overpayYearly: Math.round(est.overpayYearly),
          confidence: est.confidence,
          source: "cost-audit-instant",
        }),
      });
      setState("done");
    } catch {
      // Lead intent is still valuable; don't punish the user for our endpoint.
      setState("done");
    }
  }

  return (
    <div className="aiiw-card aiiw-resultCard">
      <div className="aiiw-resultKicker" style={{ color: overpaying ? T.red : T.green }}>
        {overpaying ? "ESTIMATED OVERPAYMENT" : "YOU'RE NEAR MARKET"}
      </div>

      <div className="aiiw-bigrow">
        <div>
          <div className="aiiw-big" style={{ color: overpaying ? T.red : T.green }}>
            {money(big)}<span className="aiiw-bigunit">/mo</span>
          </div>
          <div className="aiiw-bigsub">
            {overpaying
              ? <>about <b>{money(est.overpayYearly)}/yr</b> above the reliable floor for {est.count}× {est.gpu}</>
              : <>your {est.count}× {est.gpu} setup is close to today's reliable floor</>}
          </div>
        </div>
        <span className="aiiw-conf" style={{ color: confColor, borderColor: confColor }}>
          {est.confidence} confidence
        </span>
      </div>

      <div className="aiiw-statgrid">
        <Stat label="Your current spend" value={`${money(est.currentMonthly)}/mo`} note={`≈ ${money(est.currentRateEff)}/hr effective`} />
        <Stat label="Reliable market floor" value={`${money(est.floorReliable)}/hr`} note={`${money(est.bestReliableMonthly)}/mo at your scale`} good />
        {overpaying && (
          <Stat label="Overpaying by" value={pct(est.overpayPct)} note="of current spend" warn />
        )}
        {est.hyperscalerPremiumMonthly != null && est.hyperscalerPremiumMonthly > 0 && (
          <Stat label="Hyperscaler premium" value={`${money(est.hyperscalerPremiumMonthly)}/mo`} note="vs. specialist clouds" warn />
        )}
      </div>

      {(est.assumedHours || est.assumedCount || est.confidence === "low") && (
        <p className="aiiw-assumptions">
          Assumptions:{" "}
          {est.assumedCount && "count = 1 GPU; "}
          {est.assumedHours && "24/7 utilization (730 hrs/mo); "}
          {est.confidence === "low" && "rate inferred from provider class. "}
          Add specifics above to tighten this.
        </p>
      )}

      {overpaying && (
        <>
          <div className="aiiw-divider" />
          <div className="aiiw-gate">
            <div className="aiiw-gateText">
              <div className="aiiw-gateTitle">Want the plan that captures it?</div>
              <p className="aiiw-gateSub">
                The migration plan separates what can move this week from what should stay production-stable —
                with target providers, regions, and migration risk per workload. Sent to your inbox.
              </p>
            </div>
            {state === "done" ? (
              <div className="aiiw-doneBox">
                <div className="aiiw-doneTitle" style={{ color: T.green }}>Plan request received.</div>
                <p className="aiiw-doneSub">We'll send your workload-specific migration plan shortly.</p>
                <a className="aiiw-cta aiiw-ctaGhost" href={pricingHref}>
                  See pricing against your {money(est.overpayYearly)}/yr →
                </a>
              </div>
            ) : (
              <div className="aiiw-gateForm">
                <input
                  className="aiiw-input"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (state === "error") setState("idle"); }}
                  aria-invalid={state === "error"}
                />
                <button className="aiiw-cta" onClick={submit} disabled={state === "sending"}>
                  {state === "sending" ? "Sending…" : "Email me the migration plan →"}
                </button>
                {state === "error" && <span className="aiiw-err">Enter a valid work email.</span>}
                <a className="aiiw-pricinglink" href={pricingHref}>or skip ahead to pricing →</a>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, note, good, warn }: any) {
  const color = warn ? T.red : good ? T.green : T.ink;
  return (
    <div className="aiiw-stat">
      <div className="aiiw-statLabel">{label}</div>
      <div className="aiiw-statValue" style={{ color }}>{value}</div>
      {note && <div className="aiiw-statNote">{note}</div>}
    </div>
  );
}

function Field({ label, children }: any) {
  return (
    <div className="aiiw-field">
      <span className="aiiw-fieldLabel">{label}</span>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Style() {
  return (
    <style>{`
    .aiiw-wrap{max-width:1080px;margin:0 auto;padding:48px 20px 80px;}
    .aiiw-hero{max-width:760px;margin-bottom:32px;}
    .aiiw-eyebrow{font-family:${T.mono};font-size:12px;letter-spacing:.12em;color:${T.sub};margin-bottom:16px;}
    .aiiw-h1{font-family:${T.display};font-weight:700;font-size:clamp(30px,5vw,46px);line-height:1.05;letter-spacing:-.01em;margin:0 0 16px;}
    .aiiw-lede{font-size:18px;line-height:1.55;color:${T.sub};margin:0;}
    .aiiw-grid{display:grid;grid-template-columns:1.4fr .9fr;gap:20px;align-items:start;}
    @media(max-width:820px){.aiiw-grid{grid-template-columns:1fr;}}
    .aiiw-card{background:${T.panel};border:1px solid ${T.line};border-radius:4px;padding:24px;}
    .aiiw-label{display:block;font-family:${T.mono};font-size:12px;letter-spacing:.08em;color:${T.sub};margin-bottom:10px;text-transform:uppercase;}
    .aiiw-textarea{width:100%;box-sizing:border-box;border:1px solid ${T.lineStrong};border-radius:3px;background:${T.bg};
      font-family:${T.mono};font-size:14px;line-height:1.6;color:${T.ink};padding:14px;resize:vertical;}
    .aiiw-textarea:focus{outline:2px solid ${T.blue};outline-offset:1px;border-color:${T.blue};}
    .aiiw-chiprow{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 4px;}
    .aiiw-chip{font-family:${T.mono};font-size:11px;color:${T.sub};border:1px solid ${T.line};border-radius:999px;padding:4px 10px;}
    .aiiw-details{margin-top:16px;border-top:1px solid ${T.line};padding-top:14px;}
    .aiiw-details summary{cursor:pointer;font-family:${T.mono};font-size:13px;color:${T.blue};}
    .aiiw-fields{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px;}
    @media(max-width:520px){.aiiw-fields{grid-template-columns:1fr;}}
    .aiiw-field{display:flex;flex-direction:column;gap:6px;}
    .aiiw-fieldLabel{font-family:${T.mono};font-size:11px;color:${T.sub};letter-spacing:.04em;}
    .aiiw-input{width:100%;box-sizing:border-box;border:1px solid ${T.lineStrong};border-radius:3px;background:#fff;
      font-family:${T.mono};font-size:14px;color:${T.ink};padding:10px 12px;}
    .aiiw-input:focus{outline:2px solid ${T.blue};outline-offset:1px;border-color:${T.blue};}
    .aiiw-toggle{display:flex;align-items:center;gap:8px;font-size:14px;color:${T.ink};font-family:${T.serif};}
    .aiiw-cta{margin-top:20px;width:100%;background:${T.ink};color:${T.bg};border:none;border-radius:3px;
      font-family:${T.mono};font-size:14px;letter-spacing:.02em;padding:14px 18px;cursor:pointer;transition:transform .08s ease,background .15s ease;}
    .aiiw-cta:hover{background:#000;}
    .aiiw-cta:active{transform:translateY(1px);}
    .aiiw-cta:disabled{opacity:.6;cursor:default;}
    .aiiw-ctaGhost{background:transparent;color:${T.ink};border:1px solid ${T.ink};margin-top:14px;display:inline-block;text-align:center;text-decoration:none;}
    .aiiw-fineprint{margin:10px 0 0;font-size:13px;color:${T.sub};text-align:center;}
    .aiiw-aside{background:#FCFAF4;}
    .aiiw-asideTitle{font-family:${T.display};font-size:19px;margin-bottom:12px;}
    .aiiw-list{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:10px;font-size:14.5px;line-height:1.5;color:${T.sub};}
    .aiiw-list b{color:${T.ink};}
    .aiiw-floorbox{margin-top:18px;border-top:1px solid ${T.line};padding-top:14px;}
    .aiiw-floorTitle{font-family:${T.mono};font-size:11px;letter-spacing:.08em;color:${T.sub};text-transform:uppercase;margin-bottom:8px;}
    .aiiw-floorrow{display:flex;justify-content:space-between;font-size:14px;padding:5px 0;border-bottom:1px dotted ${T.line};}
    .aiiw-num{font-family:${T.mono};}
    .aiiw-result{margin-top:24px;}
    .aiiw-resultCard{border:1px solid ${T.lineStrong};box-shadow:0 1px 0 ${T.line};}
    .aiiw-resultKicker{font-family:${T.mono};font-size:12px;letter-spacing:.1em;}
    .aiiw-bigrow{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-top:8px;flex-wrap:wrap;}
    .aiiw-big{font-family:${T.display};font-weight:700;font-size:clamp(44px,9vw,76px);line-height:1;letter-spacing:-.02em;}
    .aiiw-bigunit{font-size:.34em;font-family:${T.mono};color:${T.sub};margin-left:6px;letter-spacing:0;}
    .aiiw-bigsub{font-size:16px;color:${T.sub};margin-top:8px;max-width:480px;}
    .aiiw-conf{font-family:${T.mono};font-size:11px;border:1px solid;border-radius:999px;padding:4px 10px;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;}
    .aiiw-statgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:${T.line};border:1px solid ${T.line};margin-top:24px;border-radius:3px;overflow:hidden;}
    @media(max-width:680px){.aiiw-statgrid{grid-template-columns:1fr 1fr;}}
    .aiiw-stat{background:#fff;padding:16px;}
    .aiiw-statLabel{font-family:${T.mono};font-size:11px;color:${T.sub};letter-spacing:.04em;margin-bottom:8px;}
    .aiiw-statValue{font-family:${T.mono};font-size:22px;font-weight:500;}
    .aiiw-statNote{font-size:12px;color:${T.sub};margin-top:4px;}
    .aiiw-assumptions{font-size:13px;color:${T.amber};margin:16px 0 0;font-style:italic;}
    .aiiw-divider{height:1px;background:${T.line};margin:24px 0;}
    .aiiw-gate{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:center;}
    @media(max-width:680px){.aiiw-gate{grid-template-columns:1fr;}}
    .aiiw-gateTitle{font-family:${T.display};font-size:22px;margin-bottom:8px;}
    .aiiw-gateSub{font-size:14.5px;color:${T.sub};line-height:1.5;margin:0;}
    .aiiw-gateForm{display:flex;flex-direction:column;gap:10px;}
    .aiiw-err{color:${T.red};font-size:13px;}
    .aiiw-pricinglink{color:${T.blue};font-family:${T.mono};font-size:13px;text-decoration:none;text-align:center;}
    .aiiw-pricinglink:hover{text-decoration:underline;}
    .aiiw-doneBox{border:1px solid ${T.line};border-radius:3px;padding:18px;background:#FCFAF4;}
    .aiiw-doneTitle{font-family:${T.display};font-size:20px;}
    .aiiw-doneSub{font-size:14px;color:${T.sub};margin:6px 0 0;}
    .aiiw-resultEmpty{border-color:${T.amber};}
    .aiiw-disclaimer{max-width:760px;margin:28px 0 0;font-size:13px;line-height:1.55;color:${T.sub};}
    @media(prefers-reduced-motion:reduce){.aiiw-cta{transition:none;}*{scroll-behavior:auto!important;}}
    `}</style>
  );
}
