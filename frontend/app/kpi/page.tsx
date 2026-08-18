import { Shell } from "@/components/shell";
import { KPIDashboardPage } from "@/features/kpi/KPIDashboardPage";

export default function SharedKPIRoute() {
  return (
    <Shell>
      <KPIDashboardPage basePath="/kpi" />
    </Shell>
  );
}
