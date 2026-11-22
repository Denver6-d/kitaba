import type { NextConfig } from "next";
import { contentSecurityPolicy } from "./src/config/csp";

const securityHeaders = [
  // Narrowed per page to hashed inline scripts by scripts/csp-hashes.mjs (DECISIONS SEC1).
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy({ supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL, dev: process.env.NODE_ENV === "development" }),
  },
  // Browsers ignore it over plain http (localhost). No includeSubDomains: other subdomains are not ours to decide.
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

/** One stamp per build: names the service-worker cache so old caches are dropped on deploy. */
const BUILD_STAMP = process.env.KITABA_BUILD_STAMP ?? new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_STAMP: BUILD_STAMP },
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
