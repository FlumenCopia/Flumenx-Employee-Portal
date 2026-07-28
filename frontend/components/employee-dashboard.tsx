"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Clock3, LogIn } from "lucide-react";
import { api } from "@/lib/api";
import { AuthUser, AttendanceRecord, Meeting } from "@/lib/types";
import { AttendanceSummary } from "@/features/attendance/types";
import { Avatar } from "./icons";
import { useShellUser } from "./shell";
import { Badge, EmptyState, PageHeader, Section, StatCard } from "./ui";

type EmployeeDashboardData = {
  profile?: AuthUser["employee"];
  upcoming_meetings?: Meeting[];
  attendance?: {
    today: AttendanceRecord | null;
    monthly: AttendanceSummary;
    late_count: number;
    early_exit_count: number;
  };
};

const displayTime = (value: string | null | undefined) => value ? new Date(`2026-01-01T${value}`).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "Not recorded";

export function EmployeeDashboard() {
  const user = useShellUser();
  const [dashboard, setDashboard] = useState<EmployeeDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    api<EmployeeDashboardData>("/dashboard/")
      .then(setDashboard)
      .catch(err => {
        setDashboard(null);
        setError(err instanceof Error ? err.message : "Could not load dashboard.");
      })
      .finally(() => setLoading(false));
  }, []);

  const employee = dashboard?.profile || user?.employee || null;
  const name = employee?.name || user?.first_name || user?.email || user?.username || "User";
  const todayRecord = dashboard?.attendance?.today || null;
  const monthly = dashboard?.attendance?.monthly;
  const displayMeetings = dashboard?.upcoming_meetings || [];

  return <>
    <PageHeader eyebrow="MY WORKSPACE" title={`Hello, ${name}.`} subtitle="Everything you need, without the noise." />
    {error && <EmptyState title="Could not load workspace" text={error} />}
    <div className="employee-hero">
      <div className="profile-feature"><Avatar name={name} size={76} /><div><span>{employee?.employee_code || "Not assigned"} - {employee?.department || "Not assigned"}</span><h2>{name}</h2><p>{employee?.designation || "Not assigned"} - {employee?.location || "Not assigned"}</p></div><Link href="/employee/profile">View profile <ArrowRight size={17} /></Link></div>
      <div className="leave-balance"><span>ANNUAL LEAVE</span><strong>Not available</strong><p>Leave balance unavailable.</p><Link href="/employee/leaves">Request time off</Link></div>
    </div>
    <div className="stats-grid employee-stats">
      <StatCard label="Today's check-in" value={displayTime(todayRecord?.check_in_time)} note={todayRecord?.check_in_status || "Not recorded"} icon={<LogIn />} />
      <StatCard label="Late this month" value={dashboard?.attendance ? dashboard.attendance.late_count : "Not available"} note="Calculated from your check-ins" icon={<Clock3 />} accent />
    </div>
    <div className="dashboard-attendance-link employee"><div><span>TODAY'S ATTENDANCE</span><b>{todayRecord ? `${todayRecord.attendance_status} - ${todayRecord.working_hours} hours` : "No attendance recorded today"}</b><small>{monthly ? `${monthly.attendance_percentage}% attendance this month` : "Monthly attendance unavailable"}</small></div><Link href="/employee/attendance">View attendance <ArrowRight size={17}/></Link></div>
    <div className="dashboard-grid">
      <Section title="Your day" kicker="UPCOMING / SCHEDULE" action={<Link href="/employee/meetings">Full calendar</Link>}>
        {loading && !dashboard && <EmptyState title="Loading meetings" text="Fetching the latest schedule." />}
        {!loading && !error && !displayMeetings.length && <EmptyState title="No meetings scheduled" text="There are no meetings to show yet." />}
        {!loading && Boolean(displayMeetings.length) && <div className="day-list">{displayMeetings.map((m, i) => <div key={m.id}><div className="day-date"><b>{new Date(m.date).getDate()}</b><span>{new Date(m.date).toLocaleDateString("en-US", { month: "short" })}</span></div><div className="day-line"><i className={i === 0 ? "active" : ""} /></div><div><b>{m.title}</b><span><CalendarDays size={14} /> {m.time.slice(0,5)} - {m.location || "Location not assigned"}</span></div><Badge>{m.department || "Audience not assigned"}</Badge></div>)}</div>}
      </Section>
    </div>
  </>;
}
