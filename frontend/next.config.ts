import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  skipTrailingSlashRedirect: true,
  async rewrites() {
    const isProd = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
    const defaultBackend = isProd
      ? "https://flumenx-employee-portal-9qq5.vercel.app"
      : "http://127.0.0.1:8000";
    const backendHost = process.env.BACKEND_INTERNAL_URL || defaultBackend;
    return [
      {
        source: "/api/:path*",
        destination: `${backendHost}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
// KPI Performance System Deployment Trigger
