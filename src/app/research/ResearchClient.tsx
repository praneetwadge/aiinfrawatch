// REPO PATH: src/components/ResearchClient.tsx  (NEW FILE)
"use client";

import React, { useState } from "react";
import Link from "next/link";

const MONO:  React.CSSProperties = { fontFamily: "var(--font-mono)" };
const SERIF: React.CSSProperties = { fontFamily: "var(--font-serif)" };
const SANS:  React.CSSProperties = { fontFamily: "var(--font-sans)" };
const BODY:  React.CSSProperties = { fontFamily: "var(--font-body)" };

// Distinctive tag so these signups can be filtered out of audit-request
// results and exported/moved to a proper newsletter provider (Beehiiv,
// ConvertKit, etc.) once one is set up. Until then, /api/audit-request
// captures them via the same funnel table.
const RESEARCH_TAG = "RESEARCH_SUBSCRIBER";

export default function ResearchClient() {
  const [email,     setEmail]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error,     setError]     = useState("");

  const handleSubmit = async () => {
    if (!email.includes("@")) { setError("Enter a valid email."); return; }
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/audit-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          monthlySpend: "",
          workload: "research-subscriber",
          notes: RESEARCH_TAG,
          source: "research",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Something went wrong.");
      setSubmitted(true);
    } catch (e: any) {
      setError(e?.message ?? "Network error — try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 1360, margin: "0 auto", padding: "72px 32px 96px" }}>
      <div style={{ maxWidth: 720 }}>
        {/* Category tag */}
        <div style={{ ...MONO, fontSize: 10, color: "var(--blue)", letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 18 }}>
          Research
        </div>

        {/* H1 */}
        <h1 style={{ ...SERIF, fontSize: 52, fontWeight: 400, lineHeight: 1.08, color: "var(--text-primary)", marginBottom: 22 }}>
          AI infrastructure economics, from the compute-and-energy edge.
        </h1>

        {/* Lede */}
        <p style={{ ...BODY, fontSize: 18, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 18 }}>
          Weekly analysis of what's actually moving in GPU pricing — spreads, capacity, contract structure — and the regional power dynamics that quietly set the floor on compute costs. Written for infrastructure leaders who buy compute, not sell it.
        </p>

        <p style={{ ...BODY, fontSize: 16, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 44 }}>
          First deep-dive report drops soon. Subscribe to get it in your inbox — and every weekly analysis after.
        </p>

        {/* Signup card */}
        <div style={{
          background: "var(--panel)",
          border: "1px solid var(--border-mid)",
          padding: "28px 30px",
          marginBottom: 48,
          maxWidth: 560,
        }}>
          {submitted ? (
            <div>
              <div style={{ fontSize: 24, color: "var(--green)", marginBottom: 10 }}>✓</div>
              <div style={{ ...SERIF, fontSize: 22, fontWeight: 400, color: "var(--text-primary)", marginBottom: 6 }}>
                You're on the list.
              </div>
              <div style={{ ...SANS, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
                First report lands at <strong style={{ color: "var(--text-primary)" }}>{email}</strong> when it ships.
              </div>
            </div>
          ) : (
            <>
              <div style={{ ...SANS, fontSize: 10.5, fontWeight: 650, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 12 }}>
                Get the research
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
                  style={{
                    ...SANS,
                    flex: "1 1 260px",
                    background: "var(--bg)",
                    border: "1px solid var(--border-mid)",
                    color: "var(--text-primary)",
                    padding: "11px 14px",
                    fontSize: 14,
                    outline: "none",
                    borderRadius: 3,
                  }}
                />
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  style={{
                    ...SANS,
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: "#F7F3EA",
                    background: loading ? "var(--text-muted)" : "#171717",
                    border: "none",
                    borderRadius: 3,
                    padding: "11px 22px",
                    cursor: loading ? "not-allowed" : "pointer",
                    letterSpacing: "0.01em",
                    whiteSpace: "nowrap" as const,
                  }}
                >
                  {loading ? "Subscribing…" : "Subscribe"}
                </button>
              </div>
              {error && (
                <p style={{ ...SANS, fontSize: 12, color: "var(--red)", marginTop: 10 }}>{error}</p>
              )}
              <p style={{ ...SANS, fontSize: 11.5, color: "var(--text-muted)", marginTop: 12, lineHeight: 1.5 }}>
                No spam. Unsubscribe with one click. Free.
              </p>
            </>
          )}
        </div>

        {/* Empty state — reports index (populated as pieces ship) */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 32 }}>
          <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.09em", marginBottom: 14 }}>
            Reports
          </div>
          <p style={{ ...SANS, fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.7, fontStyle: "italic" }}>
            The first report — <em>The True Cost of AI Compute: Why Your GPU Bill Is Half the Story</em> — is in progress. It'll land here and in subscriber inboxes when it ships.
          </p>
        </div>

        {/* Secondary nav — back to product surface */}
        <div style={{ marginTop: 56, display: "flex", gap: 24, alignItems: "center" }}>
          <Link href="/" style={{ ...SANS, fontSize: 13, color: "var(--blue)", textDecoration: "none", fontWeight: 600 }}>
            ← Run a cost audit
          </Link>
          <Link href="/market-data" style={{ ...SANS, fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
            See live market data
          </Link>
        </div>
      </div>
    </div>
  );
}
