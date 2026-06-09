import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://aiinfrawatch.vercel.app";
  return [
    { url: base,                   lastModified: new Date(), changeFrequency: "daily",   priority: 1.0 },
    { url: `${base}/cost-audit`,   lastModified: new Date(), changeFrequency: "weekly",  priority: 0.9 },
    { url: `${base}/load-balancer`,lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
  ];
}
