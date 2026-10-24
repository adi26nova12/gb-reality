import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : null;
  } catch {
    return null;
  }
})();

// Lets a phone on the same network (or Tailscale) use the dev server at this
// machine's own IP addresses. Development only; production is unaffected.
const ownAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((a): a is NonNullable<typeof a> => Boolean(a && a.family === "IPv4" && !a.internal))
  .map((a) => a.address);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ownAddresses,
  async headers() {
    const base = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    return [
      { source: "/:path*", headers: base },
      // Buyer pages carry the secret token in the URL: never leak it via
      // Referer, never cache it in shared caches, never index it.
      {
        source: "/p/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      { source: "/api/public/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
