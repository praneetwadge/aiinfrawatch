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

  const navLinks = [
    { href: "/",              label: "Market Data" },
    { href: "/cost-audit",   label: "Cost Audit" },
    { href: "/load-balancer", label: "Load Balancer" },
  ];

  const isActive = (href: string) => href === "/" ? path === "/" : path.startsWith(href);

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
                transition: "background 0.1s",
              }}>{label}</Link>
            ))}
          </nav>
        </div>

        {/* Right: live indicator + primary CTA */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", display: "inline-block", animation: "pulse-live 2.5s ease-in-out infinite" }} />
            <span style={{ ...MONO, fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.04em" }}>LIVE INDEX</span>
          </div>
          <div style={{ width: 1, height: 16, background: "var(--border)" }} />
          <Link href="/cost-audit" style={{
            ...SANS, fontSize: 12.5, fontWeight: 600,
            color: "#F7F3EA", background: "#171717",
            padding: "7px 16px", borderRadius: 3,
            textDecoration: "none", letterSpacing: "0.01em",
            whiteSpace: "nowrap" as const,
          }}>
            Request cost audit
          </Link>
        </div>
      </div>
    </header>
  );
}
