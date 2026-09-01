// REPO PATH: src/components/SiteNav.tsx  (REPLACE EXISTING)
"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const SANS: React.CSSProperties = { fontFamily: "var(--font-sans)" };
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

// Single-page site. "Audit" is a scroll anchor to #audit on / (works from
// any page via /#audit). "Methodology" is a separate route.
export default function SiteNav() {
  const path = usePathname();
  const onHome = path === "/";
  const linkStyle = (active: boolean): React.CSSProperties => ({
    ...SANS, fontSize: 13, fontWeight: active ? 600 : 400,
    color: active ? "var(--text-primary)" : "var(--text-muted)",
    padding: "5px 12px", borderRadius: 4,
    background: active ? "var(--elevated)" : "transparent",
    textDecoration: "none",
  });

  return (
    <header style={{ borderBottom: "1px solid var(--border)", background: "var(--panel)", boxShadow: "0 1px 0 rgba(20,20,20,0.06)", position: "sticky" as const, top: 0, zIndex: 40 }}>
      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "0 32px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Logo />
        <nav style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <a href={onHome ? "#audit" : "/#audit"} style={linkStyle(false)}>Audit</a>
          <Link href="/methodology" style={linkStyle(path.startsWith("/methodology"))}>Methodology</Link>
        </nav>
      </div>
    </header>
  );
}
