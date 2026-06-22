import type { NextConfig } from "next";

// Version-pinned, content-stable ML binaries (served from /public) — safe to cache forever.
const IMMUTABLE = "public, max-age=31536000, immutable";

const nextConfig: NextConfig = {
  experimental: {
    // Avoid shipping the whole Phosphor barrel — tree-shake to used icons only.
    optimizePackageImports: ["@phosphor-icons/react"],
  },
  compiler: {
    // Strip console.* in prod, but keep error/warn (liveness setup + audit paths use them deliberately).
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  async headers() {
    return [
      { source: "/mediapipe/:path*", headers: [{ key: "Cache-Control", value: IMMUTABLE }] },
      { source: "/models/:path*", headers: [{ key: "Cache-Control", value: IMMUTABLE }] },
    ];
  },
};

export default nextConfig;
