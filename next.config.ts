import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Kill caching at Vercel edge level for every API route
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control",     value: "no-store, no-cache, must-revalidate, max-age=0" },
          { key: "CDN-Cache-Control", value: "no-store" },
          { key: "Surrogate-Control", value: "no-store" },
          { key: "Pragma",            value: "no-cache" },
          { key: "Expires",           value: "0" },
        ],
      },
    ];
  },
};

export default nextConfig;
