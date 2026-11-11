import type { NextConfig } from "next";

/** Menu photos live in Supabase Storage; let next/image resize them for phones. */
function supabaseImagePattern(): { protocol: "https" | "http"; hostname: string; pathname: string }[] {
  const patterns: { protocol: "https" | "http"; hostname: string; pathname: string }[] = [
    { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
  ];
  const url = process.env.SUPABASE_URL;
  if (url) {
    try {
      const { protocol, hostname } = new URL(url);
      if (!hostname.endsWith(".supabase.co")) {
        patterns.push({
          protocol: protocol === "http:" ? "http" : "https",
          hostname,
          pathname: "/storage/v1/object/public/**",
        });
      }
    } catch {
      // Invalid SUPABASE_URL is reported where storage is used.
    }
  }
  return patterns;
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseImagePattern(),
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};

export default nextConfig;
