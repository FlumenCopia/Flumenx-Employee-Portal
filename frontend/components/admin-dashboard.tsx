"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Kanban,
  Plus,
  Sparkles,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { Leave, Meeting } from "@/lib/types";
import { AttendanceSummary } from "@/features/attendance/types";
import { Avatar } from "./icons";
import { Badge, EmptyState, PageHeader, Section, StatCard } from "./ui";

type PendingLeaveItem = {
  id: number;
  employee_name: string;
  employee_code: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
};

type RecentWorkItem = {
  id: number;
  title: string;
  employee_name: string;
  client_name: string;
  due_date: string;
  status: string;
  priority: string;
};

type DashboardData = {
  total_employees?: number;
  active_employees?: number;
  pending_leaves?: number;
  pending_leave_items?: PendingLeaveItem[];
  pending_work?: number;
  overdue_work?: number;
  recent_work_items?: RecentWorkItem[];
  active_clients?: number;
  upcoming_meetings?: Meeting[];
  attendance?: AttendanceSummary;
};

export function AdminDashboard({ basePath = "/admin" }: { basePath?: "/admin" | "/hr" }) {
  const today = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");
  const [decidePendingId, setDecidePendingId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const loadDashboardData = () => {
    setDashboardLoading(true);
    setDashboardError("");
    api<DashboardData>("/dashboard/")
      .then(setDashboard)
      .catch((err) => {
        setDashboard(null);
        setDashboardError(err instanceof Error ? err.message : "Could not load dashboard.");
      })
      .finally(() => setDashboardLoading(false));
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function handleLeaveDecision(id: number, status: "Approved" | "Rejected") {
    if (decidePendingId !== null) return;
    setDecidePendingId(id);
    setActionMessage("");
    setActionError("");
    try {
      await api<Leave>(`/leaves/${id}/decide/`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      setActionMessage(`Leave request ${status.toLowerCase()} successfully.`);
      setDashboard((prev) => {
        if (!prev) return prev;
        const updatedItems = (prev.pending_leave_items || []).filter((x) => x.id !== id);
        return {
          ...prev,
          pending_leaves: Math.max(0, (prev.pending_leaves || 1) - 1),
          pending_leave_items: updatedItems,
        };
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Could not ${status.toLowerCase()} leave.`);
    } finally {
      setDecidePendingId(null);
    }
  }

  const attendance = dashboard?.attendance;
  const displayMeetings = dashboard?.upcoming_meetings || [];
  const pendingLeaveItems = dashboard?.pending_leave_items || [];
  const recentWorkItems = dashboard?.recent_work_items || [];

  return (
    <>
      {/* RWEN CMS MIDNIGHT SLATE WELCOME HERO BANNER */}
      <div
        style={{
          background: "#1b1c20",
          borderRadius: "16px",
          padding: "24px 28px",
          color: "#faf9f5",
          marginBottom: "20px",
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ position: "relative", zIndex: 2 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 12px",
              borderRadius: "999px",
              background: "#25272d",
              border: "1px solid #3a3d46",
              color: "#cba86e",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              marginBottom: "12px",
            }}
          >
            <Sparkles size={13} /> FLUMENX PORTAL ACTIVE
          </div>
          <h1 style={{ fontSize: "26px", fontWeight: 700, fontFamily: "serif, system-ui", margin: "0 0 6px", color: "#ffffff", letterSpacing: "-0.01em" }}>
            Welcome back, Flumenx Admin!
          </h1>
          <p style={{ margin: 0, fontSize: "13px", color: "#9fa3af", maxWidth: "600px", lineHeight: "1.5" }}>
            Manage executive workspace metrics, assigned project deliverables, team capacity, and client consultation workflows.
          </p>
        </div>

        {/* Decorative Building Watermark */}
        <div style={{ position: "absolute", right: "20px", bottom: "-10px", opacity: 0.08, pointerEvents: "none", zIndex: 1 }}>
          <Building2 size={160} color="#ffffff" />
        </div>
      </div>

      {dashboardError && <EmptyState title="Could not load dashboard" text={dashboardError} />}

      {actionMessage && (
        <div className="toast success" style={{ marginBottom: "12px" }}>
          <Check size={18} /> {actionMessage}
        </div>
      )}
      {actionError && (
        <div className="toast error" style={{ marginBottom: "12px" }}>
          {actionError}
        </div>
      )}

      {/* RWEN QUICK MANAGEMENT ACTIONS BAR */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e8e6e1",
          borderRadius: "16px",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "20px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#10b981",
              boxShadow: "0 0 8px #10b981",
            }}
          />
          <b style={{ fontSize: "12px", color: "#1a1b1e", fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            QUICK MANAGEMENT ACTIONS:
          </b>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <Link
            href={`${basePath}/work?createTask=true`}
            style={{
              background: "#cba86e",
              color: "#111215",
              fontWeight: 700,
              fontSize: "12px",
              padding: "8px 16px",
              borderRadius: "12px",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 2px 6px rgba(203,168,110,0.3)",
            }}
          >
            <Plus size={14} /> New Task
          </Link>
          <Link
            href={`${basePath}/leaves`}
            style={{
              background: "#f0f4f8",
              color: "#3e4756",
              fontWeight: 600,
              fontSize: "12px",
              padding: "8px 16px",
              borderRadius: "12px",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              border: "1px solid #e2e8f0",
            }}
          >
            <CalendarDays size={14} /> Review Leaves
          </Link>
          <Link
            href={`${basePath}/employees`}
            style={{
              background: "#f0f4f8",
              color: "#3e4756",
              fontWeight: 600,
              fontSize: "12px",
              padding: "8px 16px",
              borderRadius: "12px",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              border: "1px solid #e2e8f0",
            }}
          >
            <Users size={14} /> Directory
          </Link>
          <Link
            href={`${basePath}/attendance`}
            style={{
              background: "#f0f4f8",
              color: "#3e4756",
              fontWeight: 600,
              fontSize: "12px",
              padding: "8px 16px",
              borderRadius: "12px",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              border: "1px solid #e2e8f0",
            }}
          >
            <UserCheck size={14} /> Attendance Log
          </Link>
        </div>
      </div>

      {/* 6 STATS CARDS GRID */}
      <div className="stats-grid" style={{ marginBottom: "16px" }}>
        <Link href={`${basePath}/employees`} style={{ textDecoration: "none", color: "inherit" }}>
          <StatCard
            label="Total employees"
            value={dashboardLoading ? "--" : dashboard?.total_employees ?? "0"}
            note={dashboard?.active_employees !== undefined ? `${dashboard.active_employees} active` : "Workforce count"}
            icon={<Users />}
          />
        </Link>
        <Link href={`${basePath}/attendance`} style={{ textDecoration: "none", color: "inherit" }}>
          <StatCard
            label="Present today"
            value={attendance ? String(attendance.present).padStart(2, "0") : "--"}
            note={attendance ? `${attendance.attendance_percentage}% attendance rate` : "Daily check-in summary"}
            icon={<UserCheck />}
            accent
          />
        </Link>
        <Link href={`${basePath}/leaves`} style={{ textDecoration: "none", color: "inherit" }}>
          <StatCard
            label="Pending leave"
            value={dashboardLoading ? "--" : dashboard?.pending_leaves ?? "0"}
            note={(dashboard?.pending_leaves || 0) > 0 ? "Requires review" : "All caught up"}
            icon={<CalendarDays />}
            accent={(dashboard?.pending_leaves || 0) > 0}
          />
        </Link>
        <Link href={`${basePath}/work`} style={{ textDecoration: "none", color: "inherit" }}>
          <StatCard
            label="Pending work"
            value={dashboardLoading ? "--" : dashboard?.pending_work ?? "0"}
            note="Work waiting to begin"
            icon={<BriefcaseBusiness />}
          />
        </Link>
        <Link href={`${basePath}/work`} style={{ textDecoration: "none", color: "inherit" }}>
          <StatCard
            label="Overdue work"
            value={dashboardLoading ? "--" : dashboard?.overdue_work ?? "0"}
            note={(dashboard?.overdue_work || 0) > 0 ? "Past due & backlog" : "No overdue tasks"}
            icon={<AlertTriangle />}
            accent={(dashboard?.overdue_work || 0) > 0}
          />
        </Link>
        <Link href={`${basePath}/work`} style={{ textDecoration: "none", color: "inherit" }}>
          <StatCard
            label="Active clients"
            value={dashboardLoading ? "--" : dashboard?.active_clients ?? "0"}
            note="Client accounts"
            icon={<Building2 />}
          />
        </Link>
      </div>

      {/* DASHBOARD CONTENT GRID */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "16px",
        }}
      >
        {/* LEFT COLUMN: PENDING LEAVE APPROVALS */}
        <Section
          title="Leave Requests Awaiting Action"
          kicker="NEEDS ATTENTION"
          action={
            <Link href={`${basePath}/leaves`} style={{ fontSize: "12px", color: "var(--neon)", textDecoration: "none", fontWeight: 700 }}>
              View all ({dashboard?.pending_leaves || 0}) →
            </Link>
          }
        >
          {dashboardLoading && <EmptyState title="Loading leave requests" text="Fetching pending leave submissions." />}

          {!dashboardLoading && !pendingLeaveItems.length && (
            <EmptyState title="No pending leaves" text="All leave requests have been reviewed and resolved." />
          )}

          {!dashboardLoading && Boolean(pendingLeaveItems.length) && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "4px 0" }}>
              {pendingLeaveItems.map((l) => (
                <div
                  key={l.id}
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
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <Avatar name={l.employee_name} size={40} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <b style={{ fontSize: "13px", color: "var(--text)" }}>{l.employee_name}</b>
                        <span style={{ fontSize: "10px", color: "var(--muted)", fontFamily: "monospace" }}>
                          {l.employee_code}
                        </span>
                      </div>
                      <span style={{ fontSize: "11.5px", color: "var(--amber)", fontWeight: 600 }}>
                        {l.leave_type} Leave • {l.days} day{l.days === 1 ? "" : "s"} ({l.start_date} to {l.end_date})
                      </span>
                      {l.reason && (
                        <span style={{ fontSize: "11px", color: "var(--muted)", fontStyle: "italic" }}>
                          "{l.reason}"
                        </span>
                      )}
                    </div>
                  </div>

                  {/* INSTANT APPROVE / REJECT BUTTONS */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <button
                      type="button"
                      title="Approve Leave"
                      disabled={decidePendingId === l.id}
                      onClick={() => handleLeaveDecision(l.id, "Approved")}
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "8px",
                        background: "rgba(203, 168, 110, 0.14)",
                        color: "var(--neon)",
                        border: "1px solid rgba(203, 168, 110, 0.3)",
                        display: "grid",
                        placeItems: "center",
                        cursor: "pointer",
                      }}
                    >
                      <Check size={16} />
                    </button>
                    <button
                      type="button"
                      title="Reject Leave"
                      disabled={decidePendingId === l.id}
                      onClick={() => handleLeaveDecision(l.id, "Rejected")}
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "8px",
                        background: "rgba(255, 95, 109, 0.14)",
                        color: "#FF5F6D",
                        border: "1px solid rgba(255, 95, 109, 0.3)",
                        display: "grid",
                        placeItems: "center",
                        cursor: "pointer",
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* RIGHT COLUMN: RECENT COMPANY WORK & MEETINGS */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* RECENT WORK ASSIGNMENTS */}
          <Section
            title="Company Work Pulse"
            kicker="RECENT TASK ASSIGNMENTS"
            action={
              <Link href={`${basePath}/work`} style={{ fontSize: "12px", color: "var(--neon)", textDecoration: "none", fontWeight: 700 }}>
                Kanban Board →
              </Link>
            }
          >
            {dashboardLoading && <EmptyState title="Loading tasks" text="Fetching company work assignments." />}

            {!dashboardLoading && !recentWorkItems.length && (
              <EmptyState title="No work assignments" text="No active work assignments created yet." />
            )}

            {!dashboardLoading && Boolean(recentWorkItems.length) && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "4px 0" }}>
                {recentWorkItems.map((w) => (
                  <div
                    key={w.id}
                    style={{
                      background: "var(--panel)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "10px", fontFamily: "monospace", color: "var(--neon)", fontWeight: 700 }}>
                          EXP-{String(w.id).padStart(3, "0")}
                        </span>
                        <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                          • {w.client_name}
                        </span>
                      </div>
                      <b style={{ fontSize: "12.5px", color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {w.title}
                      </b>
                      <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                        Assigned to: <strong style={{ color: "var(--text)" }}>{w.employee_name}</strong> • Due: {w.due_date}
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                      <Badge>{w.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* UPCOMING MEETINGS */}
          <Section
            title="Team Meetings & Schedule"
            kicker="TODAY / SCHEDULE"
            action={<Link href={`${basePath}/meetings`}>Full calendar</Link>}
          >
            {dashboardLoading && <EmptyState title="Loading schedule" text="Fetching the latest schedule." />}
            {!dashboardLoading && !dashboardError && !displayMeetings.length && (
              <EmptyState title="No meetings scheduled" text="There are no upcoming meetings scheduled." />
            )}
            {!dashboardLoading && !dashboardError && Boolean(displayMeetings.length) && (
              <div className="schedule-list">
                {displayMeetings.slice(0, 3).map((m) => (
                  <div className="schedule-item" key={m.id}>
                    <div className="time-block">
                      <b>{m.time.slice(0, 5)}</b>
                      <span>{m.time >= "12:00" ? "PM" : "AM"}</span>
                    </div>
                    <i />
                    <div>
                      <b>{m.title}</b>
                      <span>
                        {m.location || "Online"} • {m.department || "All Team"}
                      </span>
                    </div>
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
