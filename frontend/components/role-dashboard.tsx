import { BriefcaseBusiness, Calculator, Target } from "lucide-react";
import { PageHeader, Section, StatCard } from "./ui";

export function RoleDashboard({ role }: { role: "Admin" | "Accountant" | "BDO" }) {
  const Icon = role === "Accountant" ? Calculator : role === "BDO" ? Target : BriefcaseBusiness;
  return <>
    <PageHeader eyebrow={`FLUMENX / ${role.toUpperCase()}`} title={`Welcome ${role}.`} subtitle={`Your ${role} workspace is ready.`} />
    <div className="stats-grid">
      <StatCard label="Workspace" value={role} note="Authenticated role dashboard" icon={<Icon />} accent />
      <StatCard label="Account status" value="Active" note="Secure access verified" icon={<BriefcaseBusiness />} />
    </div>
    <Section title={`${role} dashboard`} kicker="ROLE / WORKSPACE">
      <div className="empty-state"><Icon /><h3>{role} workspace</h3><p>Role-specific modules can be added here without changing the existing dashboard system.</p></div>
    </Section>
  </>;
}
