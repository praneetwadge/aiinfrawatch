import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIInfraWatch — Live GPU Prices & AI Infrastructure Market Data",
  description: "Real-time GPU spot prices, AI cloud costs, energy grid data, and latency benchmarks across CoreWeave, AWS, GCP, vast.ai, RunPod, and 30+ providers.",
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
