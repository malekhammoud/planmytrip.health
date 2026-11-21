import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // The pitch deck is a static artifact in public/pitch, not an app route.
    return [{ source: "/pitch", destination: "/pitch/index.html" }];
  },
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
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // SAMEORIGIN keeps the dev-only /mock-browser preview embeddable in its own
          // frame while still blocking every cross-origin embed of the app.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
