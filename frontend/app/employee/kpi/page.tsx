import { EmployeeKPIDetailPage } from "@/features/kpi/EmployeeKPIDetailPage";

export default function EmployeeSelfKPIPage() {
  return <EmployeeKPIDetailPage isSelf={true} canUpdateRating={false} />;
}
