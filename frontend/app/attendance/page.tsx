"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { AdminAttendancePage, EmployeeAttendancePage } from "@/components/attendance-pages";
import { getCachedAuthUser } from "@/lib/auth-cache";

export default function SharedAttendanceRoute() {
  const [isEmployeeView, setIsEmployeeView] = useState(false);

  useEffect(() => {
    const user = getCachedAuthUser();
    if (user) {
      const role = (user.portal_role || "").toUpperCase();
      if (role === "EMPLOYEE" || role === "BDO" || role === "TEAM_LEAD") {
        setIsEmployeeView(true);
      }
    }
  }, []);

  return (
    <Shell>
      {isEmployeeView ? <EmployeeAttendancePage /> : <AdminAttendancePage />}
    </Shell>
  );
}
