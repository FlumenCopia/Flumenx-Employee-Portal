"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { AdminAttendancePage, EmployeeAttendancePage } from "@/components/attendance-pages";
import { getCachedAuthUser } from "@/lib/auth-cache";
import { Clock3, Users } from "lucide-react";

export default function SharedAttendanceRoute() {
  const [activeTab, setActiveTab] = useState<"personal" | "company">("company");
  const [canViewRegister, setCanViewRegister] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const user = getCachedAuthUser();
    if (user) {
      const role = (user.portal_role || "").toUpperCase();
      const adminRole = role === "ADMIN" || role === "SUPER_ADMIN";
      const registerRole = role === "HR" || role === "ACCOUNTANT";

      setIsAdmin(adminRole);
      setCanViewRegister(adminRole || registerRole);

      if (adminRole || registerRole) {
        setActiveTab("company");
      } else {
        setActiveTab("personal");
      }
    }
  }, []);

  return (
    <Shell>
      {canViewRegister && (
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
            onClick={() => setActiveTab("company")}
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
              background: activeTab === "company" ? "var(--amber)" : "transparent",
              color: activeTab === "company" ? "#ffffff" : "var(--muted)",
            }}
          >
            <Users size={14} /> Company Attendance Register
          </button>

          {!isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab("personal")}
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
                background: activeTab === "personal" ? "var(--amber)" : "transparent",
                color: activeTab === "personal" ? "#ffffff" : "var(--muted)",
              }}
            >
              <Clock3 size={14} /> My Personal Clock-In Panel
            </button>
          )}
        </div>
      )}

      {activeTab === "company" ? <AdminAttendancePage /> : <EmployeeAttendancePage />}
    </Shell>
  );
}
