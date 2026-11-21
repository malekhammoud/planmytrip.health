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
};

export default nextConfig;
