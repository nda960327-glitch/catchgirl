import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.catchgirl.kr";
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/demo`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/agent/join`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/platform/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
