// REPO PATH: src/app/privacy/page.tsx
// @ts-nocheck
export const metadata = { title: "Privacy & Data — AIInfraWatch" };

export default function PrivacyPage() {
  const wrap: React.CSSProperties = { maxWidth: 680, margin: "0 auto", padding: "64px 24px", fontFamily: "system-ui", color: "var(--text-primary)", background: "var(--bg)", lineHeight: 1.6 };
  const h: React.CSSProperties = { fontFamily: "system-ui", fontSize: 13, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginTop: 32 };
  const p: React.CSSProperties = { fontSize: 15, color: "var(--text-secondary)", margin: "8px 0" };
  return (
    <main style={wrap}>
      <h1 style={{ fontFamily: "system-ui", fontSize: 24, fontWeight: 700 }}>Privacy & Data</h1>
      <h2 style={h}>Your bill file</h2>
      <p style={p}>When you upload or paste a cloud bill, we read it to extract GPU line items and then discard it. The raw file is never written to our database or stored on our servers.</p>
      <h2 style={h}>What we keep</h2>
      <p style={p}>We retain anonymized, aggregated economics from audits — GPU type, effective rate, provider, spend band, and the cheaper alternatives we found — to power our market data. This is not linked to your identity and cannot be traced back to a specific bill.</p>
      <h2 style={h}>Contact & referrals</h2>
      <p style={p}>If you give us an email for "Start my move" or "Notify me," we use it only to contact you about that request. Some outbound provider links are referral links; we may earn a commission at no additional cost to you, and our recommendations are ranked by price and reliability regardless of any referral relationship.</p>
    </main>
  );
}

