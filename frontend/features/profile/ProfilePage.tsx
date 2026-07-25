"use client";

import { Pencil } from "lucide-react";
import { Avatar } from "@/components/icons";
import { EmptyState, PageHeader } from "@/components/ui";
import { useShellUser } from "@/components/shell";

export function ProfilePage() {
  const user = useShellUser();

  if (!user) return <EmptyState title="No profile found" text="Your account profile is not available." />;

  const e = user.employee;
  const name = e?.name || user.first_name || user.email || user.username;
  const code = e?.employee_code || "Not assigned";
  const designation = e?.designation || user.portal_role;
  const department = e?.department || "Not assigned";
  const location = e?.location || "Not assigned";
  const joined = e?.joining_date ? new Date(e.joining_date).toLocaleDateString("en-IN",{day:"2-digit",month:"long",year:"numeric"}) : "Not assigned";
  const status = e?.status || "Active";

  return <><PageHeader eyebrow="IDENTITY / PROFILE" title="Your profile." subtitle="The details that help your team know and reach you."/><div className="profile-page-card"><div className="profile-cover"><span>FLUMENX / {department.toUpperCase()}</span></div><div className="profile-main"><Avatar name={name} size={96}/><div><span>{code}</span><h2>{name}</h2><p>{designation}</p></div><button><Pencil size={17}/> Edit details</button></div><div className="profile-facts">{[["WORK EMAIL",e?.email || user.email || user.username],["PHONE",e?.phone || "Not assigned"],["DEPARTMENT",department],["LOCATION",location],["JOINED",joined],["STATUS",status]].map(([k,v])=><div key={k}><span>{k}</span><b>{v}</b></div>)}</div></div></>;
}
