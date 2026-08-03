"use client";

import { use } from "react";
import { EmployeeKPIDetailPage } from "@/features/kpi/EmployeeKPIDetailPage";

export default function AdminEmployeeKPIDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  return <EmployeeKPIDetailPage employeeId={resolvedParams.id} backPath="/admin/kpi" canUpdateRating={true} />;
}
