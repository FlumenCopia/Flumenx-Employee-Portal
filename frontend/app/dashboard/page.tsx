"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { EmployeeDashboard } from "@/components/employee-dashboard";
import { AdminDashboard } from "@/components/admin-dashboard";
import { getCachedAuthUser } from "@/lib/auth-cache";
import { LayoutDashboard, UserCheck } from "lucide-react";

export default function UniversalDashboardPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<"admin" | "workspace">("workspace");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const user = getCachedAuthUser();
    if (user) {
      const roleStr = (user.portal_role || user.role || "").toUpperCase();
      const isSuper =
        roleStr === "SUPER_ADMIN" ||
        roleStr === "ADMIN" ||
        roleStr === "OPERATIONS" ||
        roleStr === "HR" ||
        Boolean(user.is_superuser || (user as any).isSuperuser || (user as any).isSuperadminWildcard);
      setIsAdmin(isSuper);
      if (isSuper) {
        setActiveTab("admin");
      } else {
        setActiveTab("workspace");
      }
    }
    setLoaded(true);
  }, []);

  return (
    <Shell>
      {isAdmin && loaded && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "18px",
            background: "var(--panel)",
            border: "1px solid var(--border)",
            padding: "5px",
            borderRadius: "10px",
            width: "fit-content",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("admin")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              borderRadius: "7px",
              border: 0,
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s ease",
              background: activeTab === "admin" ? "var(--neon)" : "transparent",
              color: activeTab === "admin" ? "#ffffff" : "var(--muted)",
            }}
          >
            <LayoutDashboard size={14} /> Management Overview
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("workspace")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              borderRadius: "7px",
              border: 0,
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s ease",
              background: activeTab === "workspace" ? "var(--neon)" : "transparent",
              color: activeTab === "workspace" ? "#ffffff" : "var(--muted)",
            }}
          >
            <UserCheck size={14} /> My Workspace Hub
          </button>
        </div>
      )}

      {isAdmin && activeTab === "admin" ? (
        <AdminDashboard basePath="/admin" />
      ) : (
        <EmployeeDashboard />
      )}
    </Shell>
  );
}
