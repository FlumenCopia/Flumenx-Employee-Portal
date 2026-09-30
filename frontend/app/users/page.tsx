import { Shell } from "@/components/shell";
import { UserAccountsPage } from "@/features/admin/UserAccountsPage";

export default function SharedUsersRoute() {
  return (
    <Shell>
      <UserAccountsPage />
    </Shell>
  );
}
