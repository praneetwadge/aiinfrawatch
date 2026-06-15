import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AIInfraWatch — AI Infrastructure Markets", template: "%s · AIInfraWatch" },
  description: "Stop wasting money on AI compute. GPU pricing, availability signals, and workload routing intelligence for AI infrastructure teams.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "AIInfraWatch — AI Infrastructure Markets",
    description: "GPU pricing, availability signals, and cost audits for AI teams.",
    url: "https://aiinfrawatch.vercel.app",
    siteName: "AIInfraWatch",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,600;1,8..60,300;1,8..60,400&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
