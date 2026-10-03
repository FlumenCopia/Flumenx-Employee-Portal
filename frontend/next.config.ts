import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/admin/dashboard", destination: "/", permanent: false },
      { source: "/admin/attendance", destination: "/attendance", permanent: false },
      { source: "/admin/roles", destination: "/roles", permanent: false },
      { source: "/admin/users", destination: "/users", permanent: false },
      { source: "/admin/work", destination: "/work", permanent: false },
      { source: "/admin/clients", destination: "/clients", permanent: false },
      { source: "/admin/projects", destination: "/projects", permanent: false },
      { source: "/admin/leaves", destination: "/leaves", permanent: false },
      { source: "/admin/calendar", destination: "/calendar", permanent: false },
      { source: "/admin", destination: "/", permanent: false },

      { source: "/employee/dashboard", destination: "/", permanent: false },
      { source: "/employee/work", destination: "/work", permanent: false },
      { source: "/employee/attendance", destination: "/attendance", permanent: false },
      { source: "/employee/salary-slips", destination: "/salary-slips", permanent: false },
      { source: "/employee/leaves", destination: "/leaves", permanent: false },
      { source: "/employee/profile", destination: "/profile", permanent: false },
      { source: "/employee", destination: "/", permanent: false },

      { source: "/hr/dashboard", destination: "/", permanent: false },
      { source: "/hr/employees", destination: "/employees", permanent: false },
      { source: "/hr/attendance", destination: "/attendance", permanent: false },
      { source: "/hr/leaves", destination: "/leaves", permanent: false },
      { source: "/hr", destination: "/", permanent: false },

      { source: "/accountant/dashboard", destination: "/", permanent: false },
      { source: "/accountant/salary-slips", destination: "/salary-slips", permanent: false },
      { source: "/accountant", destination: "/", permanent: false },

      { source: "/team-lead/dashboard", destination: "/", permanent: false },
      { source: "/team-lead/work", destination: "/work", permanent: false },
      { source: "/team-lead", destination: "/", permanent: false },

      { source: "/bdo/dashboard", destination: "/", permanent: false },
      { source: "/bdo/leaves", destination: "/leaves", permanent: false },
      { source: "/bdo", destination: "/", permanent: false },

      { source: "/salary", destination: "/salary-slips", permanent: false },
    ];
  },
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
        source: "/uploads/:path*",
        destination: `${backendHost}/uploads/:path*`,
      },
      {
        source: "/socket.io",
        destination: `${backendHost}/socket.io`,
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
