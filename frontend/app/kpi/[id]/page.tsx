"use client";

import { use } from "react";
import { Shell } from "@/components/shell";
import { EmployeeKPIDetailPage } from "@/features/kpi/EmployeeKPIDetailPage";

export default function SharedEmployeeKPIDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  return (
    <Shell>
      <EmployeeKPIDetailPage employeeId={resolvedParams.id} backPath="/kpi" canUpdateRating={true} />
    </Shell>
  );
}
