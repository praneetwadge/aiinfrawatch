import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIInfraWatch — Live GPU Prices & AI Infrastructure Market Data",
  description:
    "Real-time GPU spot prices, AI cloud costs, energy grid data, and latency benchmarks across CoreWeave, AWS, GCP, vast.ai, RunPod, and 30+ providers. The authoritative source for AI infrastructure pricing.",
  keywords: [
    "GPU prices", "H100 price", "A100 cost", "AI cloud pricing",
    "GPU cloud comparison", "AI infrastructure", "CoreWeave pricing",
    "vast.ai prices", "RunPod cost", "Lambda Labs GPU",
    "AI compute cost", "GPU spot pricing", "data center energy cost",
  ],
  openGraph: {
    title: "AIInfraWatch — Live GPU Prices & AI Infrastructure Market Data",
    description: "Real-time GPU prices across 30+ providers. Find the cheapest H100, A100, and L40S cloud instances.",
    type: "website",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: process.env.NEXT_PUBLIC_APP_URL },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Agent/Bot discovery */}
        <link rel="alternate" type="application/json" href="/api/gpu-prices" title="GPU Prices JSON API" />
        <link rel="alternate" type="text/csv" href="/api/gpu-prices?format=csv" title="GPU Prices CSV" />
        <meta name="api-endpoint" content="/api/gpu-prices" />
        <meta name="data-freshness" content="5-minutes" />
      </head>
      <body>{children}</body>
    </html>
  );
}
