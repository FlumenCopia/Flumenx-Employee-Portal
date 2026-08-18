import { Shell } from "@/components/shell";
import { WorkManagementPage } from "@/features/work/WorkManagementPage";

export default function SharedWorkRoute() {
  return (
    <Shell>
      <WorkManagementPage />
    </Shell>
  );
}
