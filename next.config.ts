import type { NextConfig } from "next";

const backendUrl =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
      {
        source: "/manifest.json",
        headers: [
          { key: "Content-Type", value: "application/manifest+json; charset=utf-8" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
    ];
  },
  async rewrites() {
    // Only apply rewrites if backendUrl is not pointing to self
    if (backendUrl && !backendUrl.includes("mriiq.fit")) {
      return [
        {
          source: "/api/:path*",
          destination: `${backendUrl}/api/:path*`,
        },
        {
          source: "/mock-pdfs/:path*",
          destination: `${backendUrl}/mock-pdfs/:path*`,
        },
        {
          source: "/health",
          destination: `${backendUrl}/health`,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
