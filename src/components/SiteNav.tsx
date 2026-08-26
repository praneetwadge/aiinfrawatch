// REPO PATH: src/components/SiteNav.tsx  (REPLACE EXISTING)
"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const SANS: React.CSSProperties = { fontFamily: "var(--font-sans)" };
const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)" };
const BODY: React.CSSProperties = { fontFamily: "var(--font-body)" };

const Logo = () => (
  <Link href="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
    <svg width={20} height={20} viewBox="0 0 22 22" fill="none">
      <rect width={22} height={22} rx={3} fill="#171717" />
      <path d="M5 16l4-9 3.5 6 2-3.5L17 16" stroke="#F7F3EA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
    <span style={{ ...BODY, fontSize: 14.5, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
      AIInfraWatch
    </span>
  </Link>
);

export default function SiteNav() {
  const path = usePathname();

  // Nav: Audit, Market Data, Research. Routing Beta removed (superseded by
  // the content/research funnel). Research is the top-of-funnel wedge —
  // deep-dives on GPU pricing + regional energy dynamics.
  const navLinks = [
    { href: "/",            label: "Audit" },
    { href: "/market-data", label: "Market Data" },
    { href: "/research",    label: "Research" },
  ];

  const isActive = (href: string) => href === "/" ? path === "/" : path.startsWith(href);
  const onAuditPage = path === "/" || path.startsWith("/cost-audit");

  return (
    <header style={{ borderBottom: "1px solid var(--border)", background: "var(--panel)", boxShadow: "0 1px 0 rgba(20,20,20,0.06)", position: "sticky" as const, top: 0, zIndex: 40 }}>
      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "0 32px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* Left: logo + nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <Logo />
          <div style={{ width: 1, height: 16, background: "var(--border)" }} />
          <nav style={{ display: "flex", gap: 4 }}>
            {navLinks.map(({ href, label }) => (
              <Link key={href} href={href} style={{
                ...SANS, fontSize: 13, fontWeight: isActive(href) ? 600 : 400,
                color: isActive(href) ? "var(--text-primary)" : "var(--text-muted)",
                padding: "5px 12px", borderRadius: 4,
                background: isActive(href) ? "var(--elevated)" : "transparent",
                textDecoration: "none",
              }}>{label}</Link>
            ))}
          </nav>
        </div>

        {/* Right: primary CTA — hidden on the audit page itself since the page CTA does the job */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: onAuditPage ? 0 : undefined }}>
          {!onAuditPage && (
            <Link href="/" style={{
              ...SANS, fontSize: 12.5, fontWeight: 600,
              color: "#F7F3EA", background: "#171717",
              padding: "7px 16px", borderRadius: 3,
              textDecoration: "none", letterSpacing: "0.01em",
              whiteSpace: "nowrap" as const,
            }}>
              Audit My Stack
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
