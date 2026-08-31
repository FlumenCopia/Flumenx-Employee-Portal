import { Shell } from "@/components/shell";
import { WorkManagementPage } from "@/features/work/WorkManagementPage";

export default function ReviewApprovalsRoute() {
  return (
    <Shell>
      <WorkManagementPage defaultTab="approvals" />
    </Shell>
  );
}
