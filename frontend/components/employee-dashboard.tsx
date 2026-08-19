"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Kanban,
  LogIn,
  Palmtree,
  User,
} from "lucide-react";
import { api } from "@/lib/api";
import { AuthUser, AttendanceRecord, Meeting } from "@/lib/types";
import { AttendanceSummary } from "@/features/attendance/types";
import { Avatar } from "./icons";
import { useShellUser } from "./shell";
import { Badge, EmptyState, PageHeader, Section, StatCard } from "./ui";

type EmployeeTask = {
  id: number;
  title: string;
  client_name: string;
  due_date: string;
  status: string;
  priority: string;
};

type EmployeeDashboardData = {
  profile?: AuthUser["employee"];
  upcoming_meetings?: Meeting[];
  attendance?: {
    today: AttendanceRecord | null;
    monthly: AttendanceSummary;
    late_count: number;
    early_exit_count: number;
  };
  work_stats?: {
    active_tasks: number;
    completed_tasks: number;
    overdue_tasks: number;
  };
  recent_tasks?: EmployeeTask[];
  leaves?: any[];
};

const displayTime = (value: string | null | undefined) =>
  value
    ? new Date(`2026-01-01T${value}`).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Not recorded";

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
      .catch((err) => {
        setDashboard(null);
        setError(err instanceof Error ? err.message : "Could not load workspace dashboard.");
      })
      .finally(() => setLoading(false));
  }, []);

  const employee = dashboard?.profile || user?.employee || null;
  const name = employee?.name || user?.first_name || user?.email || user?.username || "User";
  const todayRecord = dashboard?.attendance?.today || null;
  const monthly = dashboard?.attendance?.monthly;
  const displayMeetings = dashboard?.upcoming_meetings || [];
  const workStats = dashboard?.work_stats || { active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 };
  const recentTasks = dashboard?.recent_tasks || [];

  return (
    <>
      <PageHeader
        eyebrow="MY WORKSPACE"
        title={`Hello, ${name}.`}
        subtitle="Your daily workspace hub — tasks, attendance, and team schedule."
      />

      {error && <EmptyState title="Could not load workspace" text={error} />}

      {/* HERO BANNER CARD */}
      <div
        className="employee-hero"
        style={{
          background: "linear-gradient(135deg, rgba(8, 20, 15, 0.95), rgba(16, 42, 29, 0.9))",
          border: "1px solid var(--border2)",
          borderRadius: "16px",
          padding: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          boxShadow: "0 12px 40px rgba(0,0,0,0.3)",
          marginBottom: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <Avatar name={name} size={68} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span
                style={{
                  background: "var(--neon-dim)",
                  color: "var(--neon)",
                  padding: "2px 8px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: 700,
                  fontFamily: "monospace",
                }}
              >
                {employee?.employee_code || "EMP-001"}
              </span>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                {employee?.department || "General"}
              </span>
            </div>
            <h2 style={{ fontSize: "22px", fontWeight: 700, margin: 0, color: "var(--text)" }}>
              {name}
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: "var(--muted)" }}>
              {employee?.designation || "Team Member"} {employee?.location ? `• ${employee.location}` : ""}
            </p>
          </div>
        </div>

        {/* QUICK NAVIGATION BUTTONS */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <Link
            href="/employee/work"
            className="primary-button"
            style={{ padding: "8px 14px", fontSize: "12px", gap: "6px" }}
          >
            <Kanban size={15} /> My Task Board
          </Link>
          <Link
            href="/employee/leaves"
            className="secondary-button"
            style={{ padding: "8px 14px", fontSize: "12px", gap: "6px" }}
          >
            <Palmtree size={15} /> Leaves
          </Link>
          <Link
            href="/employee/attendance"
            className="secondary-button"
            style={{ padding: "8px 14px", fontSize: "12px", gap: "6px" }}
          >
            <Clock3 size={15} /> Attendance
          </Link>
          <Link
            href="/employee/profile"
            className="secondary-button"
            style={{ padding: "8px 14px", fontSize: "12px", gap: "6px" }}
          >
            <User size={15} /> Profile
          </Link>
        </div>
      </div>

      {/* 4 STATS METRICS GRID */}
      <div className="stats-grid employee-stats" style={{ marginBottom: "16px" }}>
        <Link href="/employee/work" style={{ textDecoration: "none", color: "inherit" }}>
          <StatCard
            label="Active Tasks"
            value={workStats.active_tasks}
            note="Ongoing assigned work"
            icon={<Kanban />}
          />
        </Link>
        <Link href="/employee/work" style={{ textDecoration: "none", color: "inherit" }}>
          <StatCard
            label="Overdue / Backlog"
            value={workStats.overdue_tasks}
            note={workStats.overdue_tasks > 0 ? "Requires attention" : "All tasks on schedule"}
            icon={<AlertTriangle />}
            accent={workStats.overdue_tasks > 0}
          />
        </Link>
        <StatCard
          label="Completed Tasks"
          value={workStats.completed_tasks}
          note="Finished deliverables"
          icon={<CheckCircle2 />}
        />
        <Link href="/employee/attendance" style={{ textDecoration: "none", color: "inherit" }}>
          <StatCard
            label="Today's Check-in"
            value={displayTime(todayRecord?.check_in_time)}
            note={todayRecord?.check_in_status || "Clock in via Attendance"}
            icon={<LogIn />}
          />
        </Link>
      </div>

      {/* MAIN DASHBOARD CONTENT GRID */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "16px",
        }}
      >
        {/* LEFT COLUMN: MY ASSIGNED TASKS */}
        <Section
          title="My Active Tasks"
          kicker="WORK ASSIGNMENTS"
          action={
            <Link
              href="/employee/work"
              style={{
                fontSize: "12px",
                color: "var(--neon)",
                textDecoration: "none",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              Open Work Board <ArrowRight size={14} />
            </Link>
          }
        >
          {loading && !dashboard && (
            <EmptyState title="Loading tasks..." text="Fetching your assigned work items." />
          )}

          {!loading && !recentTasks.length && (
            <EmptyState
              title="No active tasks"
              text="You're all caught up! No active tasks currently assigned to you."
            />
          )}

          {!loading && Boolean(recentTasks.length) && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "4px 0" }}>
              {recentTasks.map((t) => {
                const isOverdue =
                  t.status !== "Completed" &&
                  t.status !== "Approved" &&
                  t.status !== "Published" &&
                  t.due_date &&
                  t.due_date < new Date().toISOString().slice(0, 10);
                return (
                  <div
                    key={t.id}
                    style={{
                      background: "var(--panel)",
                      border: "1px solid var(--border)",
                      borderRadius: "10px",
                      padding: "12px 14px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <span
                          style={{
                            fontSize: "10px",
                            fontFamily: "monospace",
                            color: "var(--neon)",
                            fontWeight: 700,
                          }}
                        >
                          EXP-{String(t.id).padStart(3, "0")}
                        </span>
                        <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                          • {t.client_name}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 700,
                          color: "var(--text)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {t.title}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px" }}>
                        <span style={{ color: isOverdue ? "#FF6B6B" : "var(--muted)", fontWeight: isOverdue ? 700 : 400 }}>
                          📅 {isOverdue ? "Overdue: " : "Due: "}{t.due_date}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                      <Badge>{t.status}</Badge>
                      <Link
                        href="/employee/work"
                        style={{
                          fontSize: "11px",
                          color: "var(--neon)",
                          fontWeight: 700,
                          textDecoration: "none",
                        }}
                      >
                        View task →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* RIGHT COLUMN: SCHEDULE & ATTENDANCE STATUS */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* ATTENDANCE SUMMARY STRIP */}
          <div
            className="dashboard-attendance-link employee"
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <span style={{ fontSize: "10px", letterSpacing: "1px", color: "var(--neon)" }}>
                TODAY'S ATTENDANCE
              </span>
              <b style={{ display: "block", fontSize: "14px", color: "var(--text)", margin: "4px 0" }}>
                {todayRecord
                  ? `${todayRecord.attendance_status} — ${todayRecord.working_hours || 0} hours`
                  : "No check-in recorded today"}
              </b>
              <small style={{ color: "var(--muted)", fontSize: "11px" }}>
                {monthly ? `${monthly.attendance_percentage}% attendance this month` : "Monthly record active"}
              </small>
            </div>
            <Link href="/employee/attendance" className="secondary-button" style={{ fontSize: "11px", gap: "4px" }}>
              Log Time <ArrowRight size={14} />
            </Link>
          </div>

          {/* UPCOMING SCHEDULE & MEETINGS */}
          <Section
            title="Team Meetings"
            kicker="UPCOMING / SCHEDULE"
            action={<Link href="/employee/meetings">Full calendar</Link>}
          >
            {loading && !dashboard && (
              <EmptyState title="Loading schedule" text="Fetching upcoming meetings." />
            )}
            {!loading && !displayMeetings.length && (
              <EmptyState
                title="No meetings scheduled"
                text="There are no upcoming meetings scheduled for today."
              />
            )}
            {!loading && Boolean(displayMeetings.length) && (
              <div className="day-list">
                {displayMeetings.map((m, i) => (
                  <div key={m.id}>
                    <div className="day-date">
                      <b>{new Date(m.date).getDate()}</b>
                      <span>
                        {new Date(m.date).toLocaleDateString("en-US", { month: "short" })}
                      </span>
                    </div>
                    <div className="day-line">
                      <i className={i === 0 ? "active" : ""} />
                    </div>
                    <div>
                      <b>{m.title}</b>
                      <span>
                        <CalendarDays size={14} /> {m.time.slice(0, 5)} - {m.location || "Online"}
                      </span>
                    </div>
                    <Badge>{m.department || "All Team"}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
