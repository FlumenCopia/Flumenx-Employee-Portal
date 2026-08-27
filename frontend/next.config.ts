import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  skipTrailingSlashRedirect: true,
  async rewrites() {
    const defaultBackend = "http://127.0.0.1:8000";
    const backendHost = process.env.BACKEND_INTERNAL_URL || defaultBackend;
    return [
      {
        source: "/api/:path*",
        destination: `${backendHost}/api/:path*`,
      },
      {
        source: "/media/:path*",
        destination: `${backendHost}/media/:path*`,
      },
      {
        source: "/socket.io/:path*",
        destination: `${backendHost}/socket.io/:path*`,
      },
    ];
  },
};

export default nextConfig;
// KPI Performance System Deployment Trigger
