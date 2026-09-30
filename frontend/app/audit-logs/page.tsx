import { Shell } from "@/components/shell";
import { AuditLogsPage } from "@/features/admin/AuditLogsPage";

export default function SharedAuditLogsRoute() {
  return (
    <Shell>
      <AuditLogsPage />
    </Shell>
  );
}
