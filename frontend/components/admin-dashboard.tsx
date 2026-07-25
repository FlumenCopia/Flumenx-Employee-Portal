"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Clock3, TimerOff, UserCheck, UserX } from "lucide-react";
import { api } from "@/lib/api";
import { Employee, Leave, Meeting, Paginated } from "@/lib/types";
import { AttendanceSummary } from "@/features/attendance/types";
import { Avatar } from "./icons";
import { Badge, EmptyState, PageHeader, Section, StatCard } from "./ui";

type DashboardData = {
  total_employees?: number;
  active_employees?: number;
  pending_leaves?: number;
  recent_leaves?: Leave[];
  upcoming_meetings?: Meeting[];
  attendance?: AttendanceSummary;
};

export function AdminDashboard({ basePath = "/admin" }: { basePath?: "/admin" | "/hr" }) {
  const today = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "2-digit", month: "long" }).format(new Date());
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [meetingsLoading, setMeetingsLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");
  const [employeesError, setEmployeesError] = useState("");
  const [meetingsError, setMeetingsError] = useState("");

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

    setEmployeesLoading(true);
    setEmployeesError("");
    api<Paginated<Employee>>("/employees/")
      .then(data => setEmployees(data.results))
      .catch(err => {
        setEmployees([]);
        setEmployeesError(err instanceof Error ? err.message : "Could not load employees.");
      })
      .finally(() => setEmployeesLoading(false));

    setMeetingsLoading(true);
    setMeetingsError("");
    api<Paginated<Meeting>>("/meetings/")
      .then(data => setMeetings(data.results))
      .catch(err => {
        setMeetings([]);
        setMeetingsError(err instanceof Error ? err.message : "Could not load meetings.");
      })
      .finally(() => setMeetingsLoading(false));
  }, []);

  const attendance = dashboard?.attendance;
  const recentLeaves = dashboard?.recent_leaves || [];
  const displayMeetings = dashboard?.upcoming_meetings?.length ? dashboard.upcoming_meetings : meetings;

  return <>
    <PageHeader eyebrow={`COMMAND CENTRE - ${today.toUpperCase()}`} title="Good morning." subtitle="Here is the pulse of FLUMENX today." action={<Link className="text-action" href={`${basePath}/employees`}>View employees <ArrowRight size={17} /></Link>} />
    {dashboardError && <EmptyState title="Could not load dashboard" text={dashboardError} />}
    <div className="stats-grid">
      <StatCard label="Absent today" value={attendance ? String(attendance.absent).padStart(2, "0") : "Not available"} note={attendance ? `${attendance.leave} on leave` : "Attendance summary unavailable"} icon={<UserX />} />
      <StatCard label="Present today" value={attendance ? String(attendance.present).padStart(2, "0") : "Not available"} note={attendance ? `${attendance.attendance_percentage}% attendance` : "Attendance summary unavailable"} icon={<UserCheck />} />
      <StatCard label="Late today" value={attendance ? String(attendance.late).padStart(2, "0") : "Not available"} note="Calculated from office time" icon={<Clock3 />} accent />
      <StatCard label="Early exits" value={attendance ? String(attendance.early_exits).padStart(2, "0") : "Not available"} note="Before office end time" icon={<TimerOff />} />
    </div>
    <div className="dashboard-attendance-link"><div><span>ATTENDANCE CONTROL</span><b>Live register</b><small>{attendance ? `${attendance.attendance_percentage}% attendance today` : "Attendance summary unavailable"}</small></div><Link href={`${basePath}/attendance`}>Open live register <ArrowRight size={17}/></Link></div>
    <div className="dashboard-grid">
      <Section title="People pulse" kicker="WORKFORCE / 30 DAYS" action={<span className="chart-legend"><i /> Active headcount</span>}>
        <EmptyState title="Trend data unavailable" text="No workforce trend endpoint is available yet." />
      </Section>
      <Section title="Up next" kicker="TODAY / SCHEDULE" action={<Link href={`${basePath}/meetings`}>View all</Link>}>
        {meetingsLoading && <EmptyState title="Loading meetings" text="Fetching the latest schedule." />}
        {meetingsError && <EmptyState title="Could not load meetings" text={meetingsError} />}
        {!meetingsLoading && !meetingsError && !displayMeetings.length && <EmptyState title="No meetings scheduled" text="There are no meetings to show yet." />}
        {!meetingsLoading && !meetingsError && Boolean(displayMeetings.length) && <div className="schedule-list">{displayMeetings.slice(0,3).map(m => <div className="schedule-item" key={m.id}><div className="time-block"><b>{m.time.slice(0,5)}</b><span>{m.time >= "12:00" ? "PM" : "AM"}</span></div><i /><div><b>{m.title}</b><span>{m.location || "Location not assigned"} - {m.department || "Audience not assigned"}</span></div></div>)}</div>}
      </Section>
    </div>
    <div className="dashboard-grid lower">
      <Section title="Leave requests" kicker="NEEDS ATTENTION" action={<Link href={`${basePath}/leaves`}>Review all</Link>}>
        {dashboardLoading && <EmptyState title="Loading leave requests" text="Fetching pending requests." />}
        {!dashboardLoading && !dashboardError && !recentLeaves.length && <EmptyState title="No leave requests" text="There are no leave requests to review." />}
        {!dashboardLoading && !dashboardError && Boolean(recentLeaves.length) && <div className="compact-table">{recentLeaves.map(l => <div className="compact-row" key={l.id}><Avatar name={l.employee_name || "User"} /><div className="grow"><b>{l.employee_name || "Not assigned"}</b><span>{l.leave_type} - {l.days ?? "No"} day{l.days === 1 ? "" : "s"}</span></div><div className="date-cell"><b>{new Date(l.start_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</b><span>START</span></div><Badge tone={l.status}>{l.status}</Badge></div>)}</div>}
      </Section>
    </div>
    <div className="team-strip"><div><span>THE FLUMENX / NEWEST MEMBERS</span><h3>Fresh energy in the room.</h3></div>{employeesLoading && <span>Loading employees</span>}{employeesError && <span>{employeesError}</span>}{!employeesLoading && !employeesError && !employees.length && <span>No employee data available</span>}{!employeesLoading && !employeesError && Boolean(employees.length) && <div className="member-stack">{employees.slice(0,5).map(e => <Avatar key={e.id} name={e.name} size={46} />)}</div>}<Link href={`${basePath}/employees`}>Meet the team <ArrowRight size={17} /></Link></div>
  </>;
}
