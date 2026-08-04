"use client";

import React, { useState, useMemo, useEffect } from "react";
import { SHOW_ADVANCED_WORKBOARD } from "@/lib/types";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  DollarSign,
  Filter,
  Kanban,
  Layers,
  LayoutDashboard,
  Megaphone,
  Pencil,
  Plus,
  RotateCw,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import type { WorkAssignment, Client, WorkPriority, WorkStatus, PortalRole } from "@/lib/types";
import { Modal } from "@/features/common/Modal";

export interface TaskItem {

  id: string;
  code: string;
  title: string;
  desc?: string;
  type: string;
  phase: string;
  assignee: string;
  assigneeName: string;
  reviewer: string;
  due: string;
  hours: number;
  deliverable?: string | null;
  status: "backlog" | "assigned" | "progress" | "review" | "approved" | "published";
  priority: "p0" | "p1" | "p2";
}

export interface MemberItem {
  id: string;
  name: string;
  short: string;
  role: string;
  department: string;
  color: string;
  cap: number;
  skills: string[];
}

export interface DeliverableItem {
  id: string;
  name: string;
  contracted: number;
  unit: string;
  type: string;
  note?: string;
}

export interface DualKPI {
  id: string;
  name: string;
  source: string;
  unit: string;
  agreedMin: number;
  agreedMax: number;
  dreamMin: number;
  dreamMax: number;
  current: number;
}

export interface BudgetItem {
  id: string;
  platform: string;
  total: number;
  spent: number;
}

export const PHASES = [
  { id: "ph1", name: "IGNITE", label: "PHASE 1 — IGNITE", start: "2026-07-18", end: "2026-08-03", goal: "Foundation, brand setup, vendor & sponsor outreach launch" },
  { id: "ph2", name: "AMPLIFY", label: "PHASE 2 — AMPLIFY", start: "2026-08-04", end: "2026-08-31", goal: "Vendor push, consumer awareness scale, pre-registration live" },
  { id: "ph3", name: "CONVERT", label: "PHASE 3 — CONVERT", start: "2026-09-01", end: "2026-09-20", goal: "Peak ad spend, conversion drive & registration push" },
  { id: "ph4", name: "LAST MILE", label: "PHASE 4 — LAST MILE", start: "2026-09-21", end: "2026-09-24", goal: "Final 4-day sprint, countdowns & maximum public reach" },
  { id: "ph5", name: "LIVE + POST", label: "PHASE 5 — LIVE + POST", start: "2026-09-25", end: "2026-09-29", goal: "Event coverage, recap reels & project handover" },
];

export const STATUSES: Array<{ id: TaskItem["status"]; name: string; color: string }> = [
  { id: "backlog", name: "Backlog", color: "#64748B" },
  { id: "assigned", name: "Assigned", color: "#3B82F6" },
  { id: "progress", name: "In Progress", color: "#F59E0B" },
  { id: "review", name: "In Review", color: "#A78BFA" },
  { id: "approved", name: "Approved", color: "#22D3EE" },
  { id: "published", name: "Published", color: "#4DFFA0" },
];

export const TASK_TYPES: Record<string, { id: string; name: string; color: string }> = {
  design: { id: "design", name: "Design", color: "#F59E0B" },
  video: { id: "video", name: "Video", color: "#F472B6" },
  ads: { id: "ads", name: "Ads", color: "#22D3EE" },
  it: { id: "it", name: "IT / Web", color: "#4DFFA0" },
  content: { id: "content", name: "Content", color: "#A78BFA" },
  ops: { id: "ops", name: "Ops", color: "#3B82F6" },
  client: { id: "client", name: "Client", color: "#89ACA0" },
};



const DEFAULT_MEMBERS: MemberItem[] = [];

const DEFAULT_DELIVERABLES: DeliverableItem[] = [];

const DEFAULT_KPIS: DualKPI[] = [];

const DEFAULT_BUDGET: BudgetItem[] = [];

const DEFAULT_SEED_TASKS: TaskItem[] = [];


export function CommandCenterView({
  assignments,
  clients,
  userRole = "ADMIN",
  currentUser,
  onStatusChange,
  initialTab = "overview",
}: {
  assignments: WorkAssignment[];
  clients: Client[];
  userRole?: PortalRole | string;
  currentUser?: { id?: number; name?: string; username?: string; role?: string };
  onStatusChange?: (id: number, status: WorkStatus) => void;
  initialTab?: "overview" | "kanban" | "timeline" | "deliverables" | "approvals" | "team" | "kpis" | "budget";
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [tasks, setTasks] = useState<TaskItem[]>(DEFAULT_SEED_TASKS);
  const [kpis, setKpis] = useState<DualKPI[]>(DEFAULT_KPIS);
  const [kpiInputs, setKpiInputs] = useState<Record<string, string>>({});
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  // Filter States matching screenshot

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPhaseFilter, setSelectedPhaseFilter] = useState("all");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("all");
  const [selectedMemberFilter, setSelectedMemberFilter] = useState("all");
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState("all");
  const [statusPillFilter, setStatusPillFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"date-asc" | "date-desc" | "priority">("date-desc");

  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>({
    ph1: true,
    ph2: true,
    ph3: true,
    ph4: true,
    ph5: true,
  });

  const canManageAll = ["ADMIN", "HR", "OPERATIONS_HEAD", "OPERATIONS", "TEAM_LEAD"].includes((userRole || "").toUpperCase());

  const canUserChangeTaskStatus = (task: TaskItem | null): boolean => {
    if (!task) return false;
    const roleUpper = (userRole || currentUser?.role || "").toUpperCase();
    const isManagement = ["ADMIN", "HR", "OPERATIONS_HEAD", "OPERATIONS", "TEAM_LEAD"].includes(roleUpper);
    if (isManagement) return true;

    if (currentUser) {
      const uName = (currentUser.name || "").toLowerCase().trim();
      const uUsername = (currentUser.username || "").toLowerCase().trim();
      const currentUserId = String(currentUser.id || "").trim();

      const rev = (task.reviewer || "").toLowerCase().trim();
      const isReviewer = Boolean(
        rev && (
          (uName && (rev === uName || uName.includes(rev) || rev.includes(uName))) ||
          (uUsername && (rev === uUsername || uUsername.includes(rev) || rev.includes(uUsername)))
        )
      );

      const assigneeName = (task.assigneeName || "").toLowerCase().trim();
      const assigneeId = String(task.assignee || "").trim();
      const isAssignee = Boolean(
        (uName && assigneeName && (uName === assigneeName || assigneeName.includes(uName))) ||
        (currentUserId && assigneeId && currentUserId === assigneeId)
      );

      if (isReviewer) return true;
      if (isAssignee && !isReviewer) return false;
    }

    return true;
  };

  const canMoveSelectedTaskStatus = useMemo(() => {
    return canUserChangeTaskStatus(selectedTask);
  }, [userRole, selectedTask, currentUser]);







  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (assignments && assignments.length > 0) {
      const converted: TaskItem[] = assignments.map((a) => {
        const statusMap: Record<string, TaskItem["status"]> = {
          Pending: "backlog",
          Ongoing: "assigned",
          "In Progress": "progress",
          "In Review": "review",
          Blocked: "review",
          Completed: "published",
        };
        const priorityMap: Record<string, TaskItem["priority"]> = {
          Low: "p2",
          Normal: "p2",
          High: "p1",
          Urgent: "p0",
        };
        let detectedType = "design";
        if (a.employee_department) {
          const d = a.employee_department.toLowerCase();
          if (d.includes("video") || d.includes("anim") || d.includes("editing")) detectedType = "video";
          else if (d.includes("web") || d.includes("it") || d.includes("dev") || d.includes("software")) detectedType = "it";
          else if (d.includes("design") || d.includes("ui") || d.includes("ux") || d.includes("graphic")) detectedType = "design";
          else if (d.includes("marketing") || d.includes("ad") || d.includes("bde")) detectedType = "ads";
          else if (d.includes("content") || d.includes("copy") || d.includes("writer")) detectedType = "content";
          else if (d.includes("ops") || d.includes("operations") || d.includes("hr") || d.includes("account")) detectedType = "ops";
        }
        if (a.deliverables && a.deliverables.length > 0 && a.deliverables[0].work_type) {
          const wt = a.deliverables[0].work_type.toLowerCase();
          if (wt.includes("video") || wt.includes("reel") || wt.includes("edit")) detectedType = "video";
          else if (wt.includes("web") || wt.includes("it") || wt.includes("dev")) detectedType = "it";
          else if (wt.includes("ad") || wt.includes("market")) detectedType = "ads";
          else if (wt.includes("design") || wt.includes("graphic") || wt.includes("ui") || wt.includes("ux")) detectedType = "design";
          else if (wt.includes("content") || wt.includes("copy")) detectedType = "content";
          else if (wt.includes("ops")) detectedType = "ops";
        }



        return {
          id: String(a.id),
          code: `EXP-${String(a.id).padStart(3, "0")}`,
          title: a.title,
          desc: a.description || "",
          type: detectedType,
          phase: "ph1",
          assignee: String(a.employee),
          assigneeName: a.employee_name,
          reviewer: a.assigned_by_name || "Manager",
          due: a.due_date,
          hours: 8,
          status: statusMap[a.status] || "progress",
          priority: priorityMap[a.priority] || "p1",
        };

      });
      setTasks(converted);
    } else {
      setTasks([]);
    }
  }, [assignments]);

  const dynamicMembers = useMemo(() => {
    if (!assignments || assignments.length === 0) return [];
    const map = new Map<string, { id: string; name: string; department: string }>();
    assignments.forEach((a) => {
      const id = String(a.employee);
      if (!map.has(id)) {
        map.set(id, { id, name: a.employee_name, department: a.employee_department || "Member" });
      }
    });
    return Array.from(map.values());
  }, [assignments]);



  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => ["published", "approved"].includes(t.status)).length;
  const inProgressTasks = tasks.filter((t) => t.status === "progress").length;
  const reviewTasks = tasks.filter((t) => t.status === "review").length;
  const lateTasks = tasks.filter((t) => new Date(t.due) < new Date() && !["published", "approved"].includes(t.status));
  const completionPct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const totalBudget = DEFAULT_BUDGET.reduce((a, b) => a + b.total, 0);
  const spentBudget = DEFAULT_BUDGET.reduce((a, b) => a + b.spent, 0);

  const totalContractedUnits = DEFAULT_DELIVERABLES.reduce((a, d) => a + d.contracted, 0);
  const deliveredUnits = DEFAULT_DELIVERABLES.reduce((a, d) => {
    const c = tasks.filter((t) => t.deliverable === d.id && ["published", "approved"].includes(t.status)).length;
    return a + Math.min(c, d.contracted);
  }, 0);

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          if (!t.title.toLowerCase().includes(q) && !t.code.toLowerCase().includes(q) && !t.assigneeName.toLowerCase().includes(q)) return false;
        }
        if (selectedPhaseFilter !== "all" && t.phase !== selectedPhaseFilter) return false;
        if (selectedTypeFilter !== "all") {
          if (["it", "web", "development"].includes(selectedTypeFilter)) {
            if (!["it", "web", "development"].includes(t.type)) return false;
          } else if (t.type !== selectedTypeFilter) {
            return false;
          }
        }

        if (selectedMemberFilter !== "all" && t.assignee !== selectedMemberFilter && t.assigneeName !== selectedMemberFilter) return false;
        if (selectedPriorityFilter !== "all" && t.priority !== selectedPriorityFilter) return false;
        if (statusPillFilter !== "all" && t.status !== statusPillFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortOrder === "date-desc") return Number(b.id) - Number(a.id);
        if (sortOrder === "date-asc") return Number(a.id) - Number(b.id);
        if (sortOrder === "priority") {
          const pRank: Record<string, number> = { p0: 0, p1: 1, p2: 2 };
          return pRank[a.priority] - pRank[b.priority];
        }
        return Number(b.id) - Number(a.id);
      });

  }, [tasks, searchQuery, selectedPhaseFilter, selectedTypeFilter, selectedMemberFilter, selectedPriorityFilter, statusPillFilter, sortOrder]);

  const moveTask = (id: string, newStatus: TaskItem["status"]) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t)));
    const portalStatusMap: Record<TaskItem["status"], WorkStatus> = {
      backlog: "Pending",
      assigned: "Ongoing",
      progress: "In Progress",
      review: "Blocked",
      approved: "Completed",
      published: "Completed",
    };
    if (onStatusChange && !isNaN(Number(id))) {
      onStatusChange(Number(id), portalStatusMap[newStatus]);
    }
  };

  const updateKpi = (id: string) => {
    const val = parseInt(kpiInputs[id] || "0", 10);
    if (isNaN(val)) return;
    setKpis((prev) => prev.map((k) => (k.id === id ? { ...k, current: val } : k)));
    setKpiInputs((prev) => ({ ...prev, [id]: "" }));
  };

  const currentActiveTab = SHOW_ADVANCED_WORKBOARD ? activeTab : "kanban";

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Top Header Control Navigation Tabs */}
      {SHOW_ADVANCED_WORKBOARD && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "8px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "var(--r)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", overflowX: "auto", width: "100%" }}>
            {[
              { id: "overview", label: "Command Center", icon: LayoutDashboard },
              { id: "kanban", label: "Task Board", icon: Kanban },
              { id: "timeline", label: "Timeline & Phases", icon: Layers },
              { id: "deliverables", label: "Contract Scope", icon: CheckCircle2 },
              { id: "approvals", label: "Approvals Queue", icon: Zap },
              { id: "team", label: "Team Capacity", icon: Users },
              { id: "kpis", label: "KPI Tracker", icon: Target },
              { id: "budget", label: "Ad Budget", icon: DollarSign },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = currentActiveTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    borderRadius: "var(--r-sm)",
                    fontSize: "12px",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    background: active ? "var(--neon)" : "var(--panel2)",
                    color: active ? "var(--bg)" : "var(--muted)",
                    border: "1px solid " + (active ? "var(--neon)" : "var(--border2)"),
                  }}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 1. COMMAND CENTER OVERVIEW */}
      {currentActiveTab === "overview" && (

        <div className="grid mb">
          {lateTasks.length > 0 && (
            <div style={{ padding: "12px 16px", borderRadius: "var(--r-sm)", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "var(--red)", fontSize: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
              <AlertTriangle size={16} />
              <div><b>{lateTasks.length} tasks overdue.</b> {lateTasks.map((t) => t.code).join(", ")} — reassign or extend before this cascades into the next phase.</div>
            </div>
          )}

          <div className="grid g5">
            <div className="stat">
              <div className="stat-l">Campaign Progress</div>
              <div className="stat-v">{completionPct}%</div>
              <div className="pbar"><div className="pfill g" style={{ width: `${completionPct}%` }} /></div>
              <div className="stat-n">{doneTasks} of {totalTasks} tasks complete</div>
            </div>

            <div className="stat c">
              <div className="stat-l">Active Phase</div>
              <div className="stat-v" style={{ fontSize: "20px", color: "#22D3EE" }}>PHASE 2</div>
              <div className="pbar"><div className="pfill c" style={{ width: "40%" }} /></div>
              <div className="stat-n">AMPLIFY · Pre-Reg Live</div>
            </div>

            <div className="stat a">
              <div className="stat-l">In Progress</div>
              <div className="stat-v" style={{ color: "#F59E0B" }}>{inProgressTasks}</div>
              <div className="stat-n">{reviewTasks} in review</div>
            </div>

            <div className={`stat ${lateTasks.length > 0 ? "r" : "g"}`}>
              <div className="stat-l">Overdue</div>
              <div className="stat-v" style={{ color: lateTasks.length > 0 ? "var(--red)" : "var(--neon)" }}>{lateTasks.length}</div>
              <div className="stat-n">{lateTasks.length > 0 ? "Needs action today" : "All on schedule"}</div>
            </div>

            <div className="stat p">
              <div className="stat-l">Ad Spend Deployed</div>
              <div className="stat-v">₹{Math.round(spentBudget / 1000)}K</div>
              <div className="pbar"><div className="pfill" style={{ width: `${(spentBudget / totalBudget) * 100}%`, background: "#A78BFA" }} /></div>
              <div className="stat-n">of ₹{totalBudget.toLocaleString("en-IN")} allocated</div>
            </div>
          </div>

          <div className="grid g-2-1">
            <div className="card">
              <div className="card-h">
                <div>
                  <div className="card-t">Task Flow by Status</div>
                  <div className="card-s">Where work is sitting right now</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "8px", paddingTop: "16px" }}>
                {STATUSES.map((status) => {
                  const count = tasks.filter((t) => t.status === status.id).length;
                  const pct = totalTasks ? Math.round((count / totalTasks) * 100) : 0;
                  return (
                    <div key={status.id} style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "6px" }}>
                      <div style={{ height: "110px", background: "var(--panel2)", borderRadius: "6px", display: "flex", alignItems: "flex-end", padding: "4px" }}>
                        <div style={{ width: "100%", height: `${Math.max(10, pct)}%`, background: status.color, borderRadius: "4px" }} />
                      </div>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text)" }}>{status.name}</div>
                      <div style={{ fontSize: "10px", color: "var(--muted)" }}>{count}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card">
              <div className="card-h">
                <div>
                  <div className="card-t">Deliverables</div>
                  <div className="card-s">Contracted scope</div>
                </div>
              </div>
              <div style={{ textAlign: "center", padding: "8px 0 14px" }}>
                <div style={{ fontSize: "32px", fontWeight: 800, color: "var(--text)" }}>
                  {deliveredUnits}<span style={{ fontSize: "16px", color: "var(--muted)" }}>/{totalContractedUnits}</span>
                </div>
                <div style={{ fontSize: "10px", color: "var(--muted)", marginTop: "4px" }}>units delivered</div>
              </div>
              <div className="pbar"><div className="pfill g" style={{ width: `${(deliveredUnits / totalContractedUnits) * 100}%` }} /></div>
              <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {DEFAULT_DELIVERABLES.slice(0, 5).map((del) => {
                  const completed = tasks.filter((t) => t.deliverable === del.id && ["published", "approved"].includes(t.status)).length;
                  const delPct = Math.min(100, Math.round((completed / del.contracted) * 100));
                  return (
                    <div key={del.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "3px" }}>
                        <span style={{ color: "var(--muted)" }}>{del.name}</span>
                        <span className="mono" style={{ color: "var(--neon)", fontWeight: 600 }}>{completed}/{del.contracted}</span>
                      </div>
                      <div className="pbar" style={{ height: "3px" }}><div className="pfill g" style={{ width: `${delPct}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. TASK BOARD (Matches screenshot expo-ui-bice.vercel.app/tasks) */}
      {currentActiveTab === "kanban" && (

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Filter Bar Row 1 & 2 */}
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
              <input
                type="text"
                className="fi"
                style={{ flex: 1, minWidth: "220px", background: "var(--panel2)" }}
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <div style={{ display: "flex", gap: "4px", overflowX: "auto" }}>
                <button
                  type="button"
                  onClick={() => setSelectedPhaseFilter("all")}
                  style={{ padding: "6px 12px", borderRadius: "var(--rs)", fontSize: "11px", fontWeight: 700, background: selectedPhaseFilter === "all" ? "var(--neon)" : "var(--panel2)", color: selectedPhaseFilter === "all" ? "var(--bg)" : "var(--muted)" }}
                >
                  All Phases
                </button>
                {SHOW_ADVANCED_WORKBOARD && PHASES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPhaseFilter(p.id)}
                    style={{ padding: "6px 12px", borderRadius: "var(--rs)", fontSize: "11px", fontWeight: 700, background: selectedPhaseFilter === p.id ? "var(--neon)" : "var(--panel2)", color: selectedPhaseFilter === p.id ? "var(--bg)" : "var(--muted)" }}
                  >
                    {p.name}
                  </button>
                ))}

              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "8px", paddingTop: "8px", borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", gap: "4px", overflowX: "auto" }}>
                <button
                  type="button"
                  onClick={() => setSelectedTypeFilter("all")}
                  style={{ padding: "4px 10px", borderRadius: "var(--rs)", fontSize: "10.5px", fontWeight: 700, background: selectedTypeFilter === "all" ? "var(--neon)" : "var(--panel2)", color: selectedTypeFilter === "all" ? "var(--bg)" : "var(--muted)" }}
                >
                  All Depts / Types
                </button>
                {Object.entries(TASK_TYPES).map(([key, val]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedTypeFilter(key)}
                    style={{ padding: "4px 10px", borderRadius: "var(--rs)", fontSize: "10.5px", fontWeight: 700, background: selectedTypeFilter === key ? "var(--neon)" : "var(--panel2)", color: selectedTypeFilter === key ? "var(--bg)" : "var(--muted)" }}
                  >
                    {val.name}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <select className="fs" value={selectedMemberFilter} onChange={(e) => setSelectedMemberFilter(e.target.value)} style={{ width: "auto" }}>
                  <option value="all">All Members</option>
                  {dynamicMembers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>


                <select className="fs" value={selectedPriorityFilter} onChange={(e) => setSelectedPriorityFilter(e.target.value)} style={{ width: "auto" }}>
                  <option value="all">All Priorities</option>
                  <option value="p0">P0 Critical</option>
                  <option value="p1">P1 High</option>
                  <option value="p2">P2 Normal</option>
                </select>

                <select className="fs" value={sortOrder} onChange={(e) => setSortOrder(e.target.value as any)} style={{ width: "auto" }}>
                  <option value="date-desc">Sort: Newest First</option>
                  <option value="date-asc">Sort: Oldest First</option>
                  <option value="priority">Sort: Priority</option>
                </select>

              </div>
            </div>

            {/* Status Pills */}
            <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingTop: "8px", borderTop: "1px solid var(--border)" }}>
              <button
                type="button"
                onClick={() => setStatusPillFilter("all")}
                style={{ padding: "4px 12px", borderRadius: "99px", fontSize: "11px", fontWeight: 700, background: statusPillFilter === "all" ? "var(--neon)" : "var(--panel2)", color: statusPillFilter === "all" ? "var(--bg)" : "var(--muted)" }}
              >
                All Board ({filteredTasks.length})
              </button>
              {STATUSES.map((st) => {
                const count = tasks.filter((t) => t.status === st.id).length;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStatusPillFilter(st.id)}
                    style={{ padding: "4px 12px", borderRadius: "99px", fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px", background: statusPillFilter === st.id ? "var(--neon)" : "var(--panel2)", color: statusPillFilter === st.id ? "var(--bg)" : "var(--muted)" }}
                  >
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: st.color }} />
                    {st.name} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* 6 Kanban Columns Grid */}
          <div className="kb">
            {STATUSES.map((col) => {
              const colTasks = filteredTasks.filter((t) => t.status === col.id);
              return (
                <div key={col.id} className="kb-col">
                  <div className="kb-head">
                    <div className="kb-name">
                      <span className="kb-dot" style={{ background: col.color }} />
                      {col.name}
                    </div>
                    <span className="kb-count">{colTasks.length}</span>
                  </div>

                  <div className="kb-body">
                    {colTasks.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "24px 8px", color: "var(--muted)", fontSize: "11px" }}>No tasks</div>
                    ) : (
                      colTasks.map((t) => {
                        const isOverdue = new Date(t.due) < new Date();
                        const typeInfo = TASK_TYPES[t.type] || { name: t.type, color: "#89ACA0" };
                        return (
                          <div
                            key={t.id}
                            className="tcard"
                            onClick={() => setSelectedTask(t)}
                            style={{ padding: "12px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "8px", cursor: "pointer" }}
                          >

                            <div className="tc-top" style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                              <span className="chip" style={{ background: typeInfo.color + "20", color: typeInfo.color, padding: "2px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: 700 }}>
                                {typeInfo.name}
                              </span>
                              <span className={`chip ${t.priority === "p0" ? "p-p0" : "p-p1"}`} style={{ padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 700 }}>
                                {t.priority.toUpperCase()}
                              </span>
                              <span className="tc-code" style={{ marginLeft: "auto", fontSize: "10px", color: "var(--muted)", fontFamily: "monospace" }}>{t.code}</span>
                            </div>

                            <div className="tc-title" style={{ fontWeight: 700, fontSize: "13px", color: "#E8F5EF", marginBottom: "6px" }}>{t.title}</div>
                            {t.desc && <div style={{ fontSize: "11px", color: "#89ACA0", marginBottom: "8px", lineHeight: "1.3" }}>{t.desc}</div>}

                            <div className="tc-assignee-info" style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "8px", background: "rgba(15,34,24,0.6)", borderRadius: "6px", marginBottom: "8px" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px" }}>
                                <span style={{ color: "#89ACA0" }}>Assigned To:</span>
                                <span style={{ color: "#4DFFA0", fontWeight: 700 }}>{t.assigneeName || "Unassigned"}</span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "10.5px" }}>
                                <span style={{ color: "#89ACA0" }}>Assigned By:</span>
                                <span style={{ color: "#A78BFA", fontWeight: 600 }}>{t.reviewer || "Admin"}</span>
                              </div>
                            </div>

                            <div className="tc-meta" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px", color: "#89ACA0" }}>
                              <div className={`tc-due ${isOverdue ? "late" : ""}`} style={{ color: isOverdue ? "#FF6B6B" : "#89ACA0", fontSize: "11px", fontWeight: isOverdue ? 700 : 400 }}>
                                📅 {isOverdue ? "Overdue: " : "Due: "}{t.due}
                              </div>
                            </div>

                            <div style={{ marginTop: "8px", paddingTop: "6px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: "10.5px", color: "#89ACA0", fontWeight: 600 }}>Status:</span>
                              <select
                                value={t.status}
                                disabled={!canUserChangeTaskStatus(t)}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  if (!canUserChangeTaskStatus(t)) return;
                                  moveTask(t.id, e.target.value as any);
                                }}
                                className="fs"
                                style={{
                                  padding: "2px 8px",
                                  fontSize: "11px",
                                  color: "#4DFFA0",
                                  background: "#0F2218",
                                  border: "1px solid rgba(77,255,160,0.2)",
                                  borderRadius: "4px",
                                  fontWeight: 600,
                                  cursor: canUserChangeTaskStatus(t) ? "pointer" : "not-allowed",
                                  opacity: canUserChangeTaskStatus(t) ? 1 : 0.6,
                                  pointerEvents: canUserChangeTaskStatus(t) ? "auto" : "none",
                                }}
                              >
                                {STATUSES.map((s) => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>

                            </div>
                          </div>

                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. TIMELINE & PHASES VIEW */}
      {activeTab === "timeline" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div className="card">
            <div className="card-t">Structured Phase Timeline</div>
            <div className="card-s">Sequential execution breakdown across campaign cycles.</div>
          </div>

          {PHASES.map((phase) => {
            const phaseTasks = tasks.filter((t) => t.phase === phase.id);
            const doneCount = phaseTasks.filter((t) => ["published", "approved"].includes(t.status)).length;
            const phasePct = phaseTasks.length ? Math.round((doneCount / phaseTasks.length) * 100) : 0;
            const isOpen = openPhases[phase.id] !== false;

            return (
              <div key={phase.id} className="tl-phase open">
                <div className="tl-ph-h" onClick={() => setOpenPhases((prev) => ({ ...prev, [phase.id]: !isOpen }))}>
                  <div>
                    <div className="tl-ph-n">{phase.label}</div>
                    <div className="tl-ph-d">{phase.start} – {phase.end} · {phase.goal}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ textTransform: "uppercase", fontSize: "12px", fontWeight: 700, color: "var(--neon)" }}>{phasePct}%</div>
                    <div style={{ fontSize: "11px", color: "var(--muted)" }}>{isOpen ? "Collapse ▲" : "Expand ▼"}</div>
                  </div>
                </div>

                {isOpen && (
                  <div className="tl-ph-body">
                    {phaseTasks.length === 0 ? (
                      <div style={{ padding: "12px", color: "var(--muted)", fontSize: "11.5px" }}>No tasks in this phase</div>
                    ) : (
                      phaseTasks.map((t) => (
                        <div key={t.id} className="tl-task">
                          <input
                            type="checkbox"
                            checked={["published", "approved"].includes(t.status)}
                            onChange={() => moveTask(t.id, ["published", "approved"].includes(t.status) ? "progress" : "published")}
                          />
                          <span className="tc-code">{t.code}</span>
                          <span style={{ flex: 1, textDecoration: ["published", "approved"].includes(t.status) ? "line-through" : "none" }}>
                            {t.title}
                          </span>
                          <span style={{ fontSize: "10.5px", color: "var(--muted)" }}>{t.assigneeName}</span>
                          <span style={{ fontSize: "10.5px", color: "var(--muted)" }}>{t.due}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 4. DELIVERABLES / CONTRACT SCOPE */}
      {activeTab === "deliverables" && (
        <div className="card">
          <div className="card-h">
            <div>
              <div className="card-t">Contract Scope Deliverables Tracker</div>
              <div className="card-s">Live count against contracted scope (Package B — Rs 4,50,000)</div>
            </div>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--neon)" }}>{deliveredUnits} / {totalContractedUnits}</div>
          </div>
          <table className="tbl">
            <thead>
              <tr><th>Deliverable</th><th>Type</th><th>Contracted</th><th>Delivered</th><th>Progress</th></tr>
            </thead>
            <tbody>
              {DEFAULT_DELIVERABLES.map((d) => {
                const completed = tasks.filter((t) => t.deliverable === d.id && ["published", "approved"].includes(t.status)).length;
                const pct = Math.min(100, Math.round((completed / d.contracted) * 100));
                return (
                  <tr key={d.id}>
                    <td className="strong">{d.name}<div style={{ fontSize: "10.5px", color: "var(--muted)" }}>{d.note}</div></td>
                    <td style={{ textTransform: "capitalize", color: "#22D3EE", fontWeight: 700 }}>{d.type}</td>
                    <td className="mono">{d.contracted} {d.unit}</td>
                    <td className="mono strong" style={{ color: "var(--neon)" }}>{completed}</td>
                    <td>
                      <div className="pbar"><div className="pfill g" style={{ width: `${pct}%` }} /></div>
                      <div style={{ fontSize: "10px", color: "var(--muted)", marginTop: "3px" }}>{pct}%</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. APPROVALS QUEUE */}
      {activeTab === "approvals" && (
        <div className="card">
          <div className="card-h">
            <div>
              <div className="card-t">Approvals Queue</div>
              <div className="card-s">24-hour SLA pending approval tasks</div>
            </div>
          </div>
          {tasks.filter((t) => t.status === "review").length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--muted)", fontSize: "12px" }}>All caught up! No tasks waiting for approval.</div>
          ) : (
            tasks
              .filter((t) => t.status === "review")
              .map((t) => (
                <div key={t.id} style={{ background: "var(--panel2)", border: "1px solid var(--border2)", borderRadius: "8px", padding: "12px", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>

                  <div>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <span className="tc-code">{t.code}</span>
                      <b style={{ color: "var(--text)", fontSize: "13px" }}>{t.title}</b>
                    </div>
                  </div>
                  {canManageAll && (
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button type="button" onClick={() => moveTask(t.id, "approved")} className="btn btn-p" style={{ padding: "4px 10px", fontSize: "11px" }}>✓ Approve</button>
                      <button type="button" onClick={() => moveTask(t.id, "progress")} className="btn btn-d" style={{ padding: "4px 10px", fontSize: "11px" }}>← Revise</button>
                    </div>
                  )}
                </div>
              ))
          )}
        </div>
      )}

      {/* 6. TEAM CAPACITY */}
      {activeTab === "team" && (
        <div className="grid g3">
          {DEFAULT_MEMBERS.map((m) => {
            const own = tasks.filter((t) => t.assignee === m.id || t.assigneeName === m.name);
            const load = own.reduce((a, b) => a + (b.hours || 8), 0);
            const pct = Math.min(100, Math.round((load / m.cap) * 100));
            return (
              <div key={m.id} className="tm">
                <div className="tm-top">
                  <div className="tm-av" style={{ background: m.color }}>{m.short}</div>
                  <div><div className="tm-n">{m.name}</div><div className="tm-r">{m.department}</div></div>
                </div>
                <div className="tm-cap"><span>Workload</span><span className="mono">{load}h / {m.cap}h</span></div>
                <div className="pbar"><div className="pfill g" style={{ width: `${pct}%` }} /></div>
              </div>
            );
          })}
        </div>
      )}

      {/* 7. KPI TRACKER */}
      {activeTab === "kpis" && (
        <div className="grid g2">
          {kpis.map((k) => {
            const pct = Math.min(100, Math.round((k.current / k.dreamMax) * 100));
            return (
              <div key={k.id} className="card">
                <div className="card-h">
                  <div><div className="card-t">{k.name}</div><div className="card-s">{k.source}</div></div>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--neon)" }}>{k.current.toLocaleString("en-IN")}</div>
                </div>
                <div className="pbar" style={{ height: "7px" }}><div className="pfill g" style={{ width: `${pct}%` }} /></div>
                {canManageAll && (
                  <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                    <input className="fi" type="number" placeholder="Update metric" value={kpiInputs[k.id] || ""} onChange={(e) => setKpiInputs((prev) => ({ ...prev, [k.id]: e.target.value }))} />
                    <button type="button" onClick={() => updateKpi(k.id)} className="btn btn-p" style={{ padding: "6px 12px", fontSize: "11px" }}>Update</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 8. AD BUDGET */}
      {activeTab === "budget" && (
        <div className="grid g2">
          {DEFAULT_BUDGET.map((b) => {
            const pct = Math.min(100, Math.round((b.spent / b.total) * 100));
            return (
              <div key={b.id} className="card">
                <div className="card-h">
                  <div className="card-t">{b.platform}</div>
                  <div className="mono strong" style={{ color: "#A78BFA" }}>₹{b.spent.toLocaleString("en-IN")} / ₹{b.total.toLocaleString("en-IN")}</div>
                </div>
                <div className="pbar"><div className="pfill" style={{ width: `${pct}%`, background: "#A78BFA" }} /></div>
              </div>
            );
          })}
        </div>
      )}

      {/* TASK DETAIL MODAL (Exact match to Reference Screenshot) */}
      {selectedTask && (
        <Modal title="" onClose={() => setSelectedTask(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "4px" }}>
            
            {/* TITLE & CODE */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ fontSize: "17px", fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.2px" }}>
                {selectedTask.title}
              </div>
              <div style={{ fontSize: "11px", color: "#6B7280", fontFamily: "monospace", display: "flex", gap: "6px", alignItems: "center" }}>
                <span>{selectedTask.code}</span>
                <span>·</span>
                <span>{PHASES.find((p) => p.id === selectedTask.phase)?.name || "AMPLIFY"}</span>
              </div>
            </div>

            {/* STATUS CHIPS */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ background: "rgba(34, 211, 238, 0.15)", color: "#22D3EE", padding: "3px 9px", borderRadius: "5px", fontSize: "10px", fontWeight: 800, textTransform: "uppercase" }}>
                {TASK_TYPES[selectedTask.type]?.name || selectedTask.type}
              </span>
              <span style={{ background: "rgba(245, 158, 11, 0.15)", color: "#F59E0B", padding: "3px 9px", borderRadius: "5px", fontSize: "10px", fontWeight: 800, textTransform: "uppercase" }}>
                {selectedTask.priority.toUpperCase()}
              </span>
              <span style={{ background: "rgba(100, 116, 139, 0.2)", color: "#94A3B8", padding: "3px 9px", borderRadius: "5px", fontSize: "10px", fontWeight: 800, textTransform: "uppercase" }}>
                {selectedTask.status.toUpperCase()}
              </span>
            </div>

            {/* DESCRIPTION BOX */}
            <div style={{ background: "rgba(18, 32, 26, 0.8)", border: "1px solid rgba(77, 255, 160, 0.1)", borderRadius: "8px", padding: "14px 16px", fontSize: "13px", color: "#A7C1B5", lineHeight: "1.5" }}>
              {selectedTask.desc || "Instant form, stall pricing visual, floor plan creative. Primary B2B lead engine."}
            </div>

            {/* METADATA GRID (2 COLUMNS) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px", fontSize: "13px", padding: "4px 0" }}>
              <div style={{ display: "flex", gap: "6px" }}>
                <span style={{ color: "#FFFFFF", fontWeight: 600 }}>Assigned to—</span>
                <span style={{ color: "#A7C1B5" }}>{selectedTask.assigneeName || "—"}</span>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <span style={{ color: "#FFFFFF", fontWeight: 600 }}>Estimated hours</span>
                <span style={{ color: "#A7C1B5" }}>{selectedTask.hours || 6}h</span>
              </div>

              <div style={{ display: "flex", gap: "6px" }}>
                <span style={{ color: "#FFFFFF", fontWeight: 600 }}>Reviewer—</span>
                <span style={{ color: "#A7C1B5" }}>{selectedTask.reviewer || "—"}</span>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <span style={{ color: "#FFFFFF", fontWeight: 600 }}>Phase</span>
                <span style={{ color: "#A7C1B5" }}>{PHASES.find((p) => p.id === selectedTask.phase)?.name || "AMPLIFY"}</span>
              </div>

              <div style={{ display: "flex", gap: "6px" }}>
                <span style={{ color: "#FFFFFF", fontWeight: 600 }}>Due date</span>
                <span style={{ color: "#A7C1B5" }}>{selectedTask.due}</span>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <span style={{ color: "#FFFFFF", fontWeight: 600 }}>Counts toward—</span>
                <span style={{ color: "#A7C1B5" }}>{clients.find((c) => String(c.id) === selectedTask.deliverable)?.name || "—"}</span>
              </div>
            </div>

            {/* DIVIDER LINE */}
            <div style={{ borderBottom: "1px solid rgba(77, 255, 160, 0.12)", margin: "4px 0" }} />

            {/* MOVE TO STATUS SECTION */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase" }}>
                  MOVE TO STATUS
                </span>
                {!canMoveSelectedTaskStatus && (
                  <span style={{ fontSize: "10.5px", color: "#F59E0B", fontWeight: 600 }}>
                    🔒 Status changes restricted — Only designated Reviewer ({selectedTask.reviewer || "Reviewer"}) or Admin/HR can move status
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: "8px", overflowX: "auto", flexWrap: "wrap" }}>
                {STATUSES.map((st) => {
                  const isActive = selectedTask.status === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      disabled={!canMoveSelectedTaskStatus}
                      onClick={() => {
                        if (!canMoveSelectedTaskStatus) return;
                        moveTask(selectedTask.id, st.id);
                        setSelectedTask({ ...selectedTask, status: st.id });
                      }}
                      style={{
                        padding: "7px 18px",
                        borderRadius: "999px",
                        fontSize: "12px",
                        fontWeight: 700,
                        background: isActive ? "#00E676" : "rgba(20, 35, 28, 0.6)",
                        color: isActive ? "#051A10" : "#8EA89D",
                        border: isActive ? "none" : "1px solid rgba(77, 255, 160, 0.12)",
                        cursor: canMoveSelectedTaskStatus ? "pointer" : "not-allowed",
                        opacity: canMoveSelectedTaskStatus ? 1 : 0.6,
                        pointerEvents: canMoveSelectedTaskStatus ? "auto" : "none",
                        transition: "all 0.15s ease",
                      }}
                      title={!canMoveSelectedTaskStatus ? `Only designated Reviewer (${selectedTask.reviewer}) or Admin/HR can change status` : `Move to ${st.name}`}
                    >
                      {st.name}
                    </button>
                  );
                })}
              </div>
            </div>




            {/* FOOTER ACTIONS */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
              <button
                type="button"
                style={{ background: "rgba(185, 28, 28, 0.3)", color: "#F87171", border: "1px solid rgba(239, 68, 68, 0.25)", padding: "8px 20px", borderRadius: "8px", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
                onClick={() => {
                  if (confirm("Delete this task?")) {
                    setTasks((prev) => prev.filter((t) => t.id !== selectedTask.id));
                    setSelectedTask(null);
                  }
                }}
              >
                Delete
              </button>
              <button
                type="button"
                style={{ background: "rgba(30, 41, 59, 0.8)", color: "#E2E8F0", border: "1px solid rgba(255, 255, 255, 0.1)", padding: "8px 20px", borderRadius: "8px", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
                onClick={() => setSelectedTask(null)}
              >
                Close
              </button>
              <button
                type="button"
                style={{ background: "#00E676", color: "#051A10", border: "none", padding: "8px 22px", borderRadius: "8px", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
                onClick={() => setSelectedTask(null)}
              >
                Edit
              </button>
            </div>

          </div>
        </Modal>
      )}


    </div>
  );
}

