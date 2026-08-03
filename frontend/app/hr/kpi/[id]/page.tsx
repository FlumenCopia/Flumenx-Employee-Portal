"use client";

import { use } from "react";
import { EmployeeKPIDetailPage } from "@/features/kpi/EmployeeKPIDetailPage";

export default function HREmployeeKPIDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  return <EmployeeKPIDetailPage employeeId={resolvedParams.id} backPath="/hr/kpi" canUpdateRating={true} />;
}
