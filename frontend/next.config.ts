import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "https://flumenx-employee-portal-9qq5.vercel.app/api/:path*",
      },
    ];
  },
};

export default nextConfig;
