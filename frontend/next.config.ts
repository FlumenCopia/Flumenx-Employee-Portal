import type { NextConfig } from "next";

function getBackendUrl() {
  const envUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "https://flumenx-employee-portal-9qq5.vercel.app";
  return envUrl.replace(/\/api\/?$/, "").replace(/\/$/, "");
}

const backendUrl = getBackendUrl();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
