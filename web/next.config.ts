import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Proxy all /api/* requests from the browser through the Next.js server
  // to the gateway container via Docker's internal network.
  // This way port 8000 never needs to be exposed — only port 3000.
  async rewrites() {
    const gatewayUrl =
      process.env.GATEWAY_INTERNAL_URL || "http://gateway:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${gatewayUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
