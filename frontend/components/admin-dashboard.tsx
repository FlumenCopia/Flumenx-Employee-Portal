"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BriefcaseBusiness, Building2, CalendarDays, UserCheck, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Meeting } from "@/lib/types";
import { AttendanceSummary } from "@/features/attendance/types";
import { EmptyState, PageHeader, Section, StatCard } from "./ui";

type DashboardData = {
  total_employees?: number;
  active_employees?: number;
  pending_leaves?: number;
  pending_work?: number;
  overdue_work?: number;
  active_clients?: number;
  upcoming_meetings?: Meeting[];
  attendance?: AttendanceSummary;
};

export function AdminDashboard({ basePath = "/admin" }: { basePath?: "/admin" | "/hr" }) {
  const today = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "2-digit", month: "long" }).format(new Date());
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  useEffect(() => {
    setDashboardLoading(true);
    setDashboardError("");
    api<DashboardData>("/dashboard/")
      .then(setDashboard)
      .catch(err => {
        setDashboard(null);
        setDashboardError(err instanceof Error ? err.message : "Could not load dashboard.");
      })
      .finally(() => setDashboardLoading(false));
  }, []);

  const attendance = dashboard?.attendance;
  const displayMeetings = dashboard?.upcoming_meetings || [];

  return <>
    <PageHeader eyebrow={`COMMAND CENTRE - ${today.toUpperCase()}`} title="Good morning." subtitle="Here is the pulse of FLUMENX today." action={<Link className="text-action" href={`${basePath}/employees`}>View employees <ArrowRight size={17} /></Link>} />
    {dashboardError && <EmptyState title="Could not load dashboard" text={dashboardError} />}
    <div className="stats-grid">
      <StatCard label="Total employees" value={dashboardLoading ? "--" : dashboard?.total_employees ?? "Not available"} note={dashboard?.active_employees !== undefined ? `${dashboard.active_employees} active` : "Employee count"} icon={<Users />} />
      <StatCard label="Present today" value={attendance ? String(attendance.present).padStart(2, "0") : "Not available"} note={attendance ? `${attendance.attendance_percentage}% attendance` : "Attendance summary unavailable"} icon={<UserCheck />} accent />
      <StatCard label="Pending leave" value={dashboardLoading ? "--" : dashboard?.pending_leaves ?? "Not available"} note="awaiting approval" icon={<CalendarDays />} />
      <StatCard label="Pending work" value={dashboardLoading ? "--" : dashboard?.pending_work ?? "Not available"} note="waiting to begin" icon={<BriefcaseBusiness />} />
      <StatCard label="Overdue work" value={dashboardLoading ? "--" : dashboard?.overdue_work ?? "Not available"} note="past due and open" icon={<BriefcaseBusiness />} />
      <StatCard label="Active clients" value={dashboardLoading ? "--" : dashboard?.active_clients ?? "Not available"} note="client records" icon={<Building2 />} />
    </div>
    <div className="dashboard-grid lower">
      <Section title="Leave approvals" kicker="NEEDS ATTENTION" action={<Link href={`${basePath}/leaves`}>View all</Link>}>
        <div className="mini-metrics">
          <div><span>Pending</span><strong>{dashboardLoading ? "--" : dashboard?.pending_leaves ?? 0}</strong><small>awaiting review</small></div>
        </div>
      </Section>
      <Section title="Up next" kicker="TODAY / SCHEDULE" action={<Link href={`${basePath}/meetings`}>View all</Link>}>
        {dashboardLoading && <EmptyState title="Loading meetings" text="Fetching the latest schedule." />}
        {!dashboardLoading && !dashboardError && !displayMeetings.length && <EmptyState title="No meetings scheduled" text="There are no meetings to show yet." />}
        {!dashboardLoading && !dashboardError && Boolean(displayMeetings.length) && <div className="schedule-list">{displayMeetings.slice(0,3).map(m => <div className="schedule-item" key={m.id}><div className="time-block"><b>{m.time.slice(0,5)}</b><span>{m.time >= "12:00" ? "PM" : "AM"}</span></div><i /><div><b>{m.title}</b><span>{m.location || "Location not assigned"} - {m.department || "Audience not assigned"}</span></div></div>)}</div>}
      </Section>
    </div>
  </>;
}
