"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { AdminTrackingPage, EmployeeTrackingPage } from "@/components/tracking-pages";
import { getCachedAuthUser } from "@/lib/auth-cache";
import { MapPin, Users } from "lucide-react";
import { TOKENS } from "@/components/design-system/tokens";

export default function SharedTrackingRoute() {
  const [activeTab, setActiveTab] = useState<"company" | "personal">("company");
  const [canViewCompanyLiveMap, setCanViewCompanyLiveMap] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const user = getCachedAuthUser();
    if (user) {
      const role = (user.portal_role || "").toUpperCase();
      const adminRole =
        role === "ADMIN" ||
        role === "SUPER_ADMIN" ||
        role === "OPERATIONS" ||
        role === "OPERATIONS_HEAD";
      const managerRole = role === "HR" || role === "TEAM_LEAD";

      setIsAdmin(adminRole);
      setCanViewCompanyLiveMap(adminRole || managerRole);

      if (adminRole || managerRole) {
        setActiveTab("company");
      } else {
        setActiveTab("personal");
      }
    }
  }, []);

  return (
    <Shell>
      {canViewCompanyLiveMap && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "18px",
            background: TOKENS.colors.surfacePanel,
            border: `1px solid ${TOKENS.colors.borderLight}`,
            padding: "5px",
            borderRadius: TOKENS.radius.lg,
            width: "fit-content",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("company")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              borderRadius: TOKENS.radius.md,
              border: 0,
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s ease",
              background: activeTab === "company" ? TOKENS.colors.brandPrimary : "transparent",
              color: activeTab === "company" ? "#FFFFFF" : TOKENS.colors.textSecondary,
            }}
          >
            <Users size={14} /> Team & Company Live Radar
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("personal")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              borderRadius: TOKENS.radius.md,
              border: 0,
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s ease",
              background: activeTab === "personal" ? TOKENS.colors.brandPrimary : "transparent",
              color: activeTab === "personal" ? "#FFFFFF" : TOKENS.colors.textSecondary,
            }}
          >
            <MapPin size={14} /> My Personal Location Tracker
          </button>
        </div>
      )}

      {activeTab === "company" ? <AdminTrackingPage /> : <EmployeeTrackingPage />}
    </Shell>
  );
}
