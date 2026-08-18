import { Shell } from "@/components/shell";
import { SettingsAccessPage } from "@/features/admin/SettingsAccessPage";

export default function SharedSettingsRoute() {
  return (
    <Shell>
      <SettingsAccessPage />
    </Shell>
  );
}
