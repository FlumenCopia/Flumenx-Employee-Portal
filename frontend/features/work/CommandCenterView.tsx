"use client";

import React, { useState, useMemo, useEffect } from "react";
import { SHOW_ADVANCED_WORKBOARD, CANONICAL_DEPARTMENTS, normalizeDepartment } from "@/lib/types";

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
  Trash2,
} from "lucide-react";

import type { WorkAssignment, Client, WorkEmployeeOption, WorkPriority, WorkStatus, PortalRole, DepartmentItem, WorkSummary } from "@/lib/types";
import { api } from "@/lib/api";
import { Modal } from "@/features/common/Modal";

function isDateStrictlyPast(dateStr?: string): boolean {
  if (!dateStr) return false;
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return dateStr < todayStr;
}

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
  reviewerId?: number | null;
  due: string;
  hours: number;
  deliverable?: string | null;
  status: "backlog" | "assigned" | "progress" | "review" | "approved" | "published";
  priority: "p0" | "p1" | "p2";
  rawStatus?: WorkStatus;
  reviewStatus?: "PENDING_REVIEW" | "OK" | "CORRECTION_NEEDED";
  reviewNote?: string;
  reviewedBy?: number | null;
  reviewedAt?: string | null;
  reviewedByName?: string;
  clientName?: string;
  clientId?: number;
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
  { id: "backlog", name: "Backlog", color: "#FF6B6B" },
  { id: "assigned", name: "Assigned", color: "#3B82F6" },
  { id: "progress", name: "In Progress", color: "#F59E0B" },
  { id: "review", name: "In Review", color: "#A78BFA" },
  { id: "approved", name: "Approved", color: "#22D3EE" },
  { id: "published", name: "Published", color: "#cba86e" },
];

export const ALL_WORK_STATUSES: Array<{ id: WorkStatus; name: string; isReviewerOnly: boolean }> = [
  { id: "Backlog", name: "Backlog", isReviewerOnly: false },
  { id: "Assigned", name: "Assigned", isReviewerOnly: false },
  { id: "In Progress", name: "In Progress", isReviewerOnly: false },
  { id: "In Review", name: "In Review", isReviewerOnly: false },
  { id: "Approved", name: "Approved", isReviewerOnly: true },
  { id: "Published", name: "Published", isReviewerOnly: true },
];

export const TASK_TYPES: Record<string, { id: string; name: string; color: string }> = {
  web_development: { id: "web_development", name: "Web Development", color: "#cba86e" },
  video_editing: { id: "video_editing", name: "Video Editing", color: "#F472B6" },
  design: { id: "design", name: "Design", color: "#F59E0B" },
  digital_marketing: { id: "digital_marketing", name: "Digital Marketing", color: "#22D3EE" },
  accountant: { id: "accountant", name: "Accountant", color: "#A78BFA" },
  operations: { id: "operations", name: "Operations", color: "#3B82F6" },
  hr: { id: "hr", name: "HR", color: "#EC4899" },
  // Fallbacks for legacy keys
  it: { id: "web_development", name: "Web Development", color: "#cba86e" },
  video: { id: "video_editing", name: "Video Editing", color: "#F472B6" },
  ads: { id: "digital_marketing", name: "Digital Marketing", color: "#22D3EE" },
  content: { id: "digital_marketing", name: "Digital Marketing", color: "#22D3EE" },
  ops: { id: "operations", name: "Operations", color: "#3B82F6" },
};

const DEFAULT_MEMBERS: MemberItem[] = [];
const DEFAULT_DELIVERABLES: DeliverableItem[] = [];
const DEFAULT_KPIS: DualKPI[] = [];
const DEFAULT_BUDGET: BudgetItem[] = [];
const DEFAULT_SEED_TASKS: TaskItem[] = [];

export interface TaskGroup {
  key: string;
  clientName: string;
  assigneeName: string;
  reviewerName: string;
  tasks: TaskItem[];
}

export function CommandCenterView({
  assignments,
  clients,
  members,
  userRole = "ADMIN",
  currentUser,
  workSummary,
  selectedClientName,
  selectedClientId,
  onClientChange,
  onStatusChange,
  onReviewCheck,
  onDeleteWork,
  initialTab = "kanban",
}: {
  assignments: WorkAssignment[];
  clients: Client[];
  members?: WorkEmployeeOption[];
  userRole?: PortalRole | string;
  currentUser?: { id?: number; employeeId?: number | null; name?: string; username?: string; role?: string };
  workSummary?: WorkSummary;
  selectedClientName?: string;
  selectedClientId?: string;
  onClientChange?: (clientId: string) => void;
  onStatusChange?: (id: number, status: WorkStatus) => Promise<void> | void;
  onReviewCheck?: (id: number, reviewStatus: "PENDING_REVIEW" | "OK" | "CORRECTION_NEEDED", note?: string) => Promise<unknown>;
  onDeleteWork?: (id: number) => Promise<boolean>;
  initialTab?: string;
}) {
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [tasks, setTasks] = useState<TaskItem[]>(DEFAULT_SEED_TASKS);
  const [kpis, setKpis] = useState<DualKPI[]>(DEFAULT_KPIS);
  const [kpiInputs, setKpiInputs] = useState<Record<string, string>>({});
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [selectedTaskGroup, setSelectedTaskGroup] = useState<TaskGroup | null>(null);
  const [reviewNoteInput, setReviewNoteInput] = useState<string>("");
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);
  const [pendingCorrectionTaskId, setPendingCorrectionTaskId] = useState<string | null>(null);
  const [pendingCorrectionNote, setPendingCorrectionNote] = useState<string>("");
  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("flumenx_overdue_banner_dismissed") === "true";
    }
    return false;
  });

  useEffect(() => {
    if (selectedTask) {
      setReviewNoteInput(selectedTask.reviewNote || "");
    }
  }, [selectedTask]);





  const [selectedPhaseFilter, setSelectedPhaseFilter] = useState<string>("all");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>("all");
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusPillFilter, setStatusPillFilter] = useState<string>("all");

  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>({
    ph1: true,
    ph2: true,
    ph3: true,
    ph4: true,
    ph5: true,
  });

  const canManageAll = ["SUPER_ADMIN", "ADMIN", "HR", "OPERATIONS_HEAD", "TEAM_LEAD"].includes((userRole || "").toUpperCase());

  const isReviewerOrManager = (task: TaskItem | null): boolean => {
    if (!task) return false;
    const roleUpper = (currentUser?.role || userRole || "").toUpperCase();
    if (["SUPER_ADMIN", "ADMIN", "HR", "OPERATIONS_HEAD", "TEAM_LEAD", "BDE"].includes(roleUpper)) {
      return true;
    }
    if (currentUser?.id && task.reviewerId && Number(task.reviewerId) === Number(currentUser.id)) {
      return true;
    }
    if (currentUser?.employeeId && task.reviewerId && Number(task.reviewerId) === Number(currentUser.employeeId)) {
      return true;
    }
    if (task.reviewer) {
      const revLower = task.reviewer.toLowerCase().trim();
      if (currentUser?.name && revLower.includes(currentUser.name.toLowerCase().trim())) return true;
      if (currentUser?.username && revLower.includes(currentUser.username.toLowerCase().trim())) return true;
    }
    return false;
  };

  const canDeleteSelectedTask = useMemo(() => {
    return isReviewerOrManager(selectedTask);
  }, [userRole, currentUser, selectedTask]);

  const canEditSelectedTask = useMemo(() => {
    return isReviewerOrManager(selectedTask);
  }, [userRole, currentUser, selectedTask]);

  const canUserChangeTaskStatus = (task: TaskItem | null): boolean => {
    if (!task) return false;
    if (isReviewerOrManager(task)) return true;
    if (currentUser?.id && task.assignee && String(task.assignee) === String(currentUser.id)) {
      return true;
    }
    if (currentUser?.employeeId && task.assignee && String(task.assignee) === String(currentUser.employeeId)) {
      return true;
    }
    return false;
  };

  const canMoveSelectedTaskStatus = useMemo(() => {
    return canUserChangeTaskStatus(selectedTask);
  }, [userRole, selectedTask, currentUser]);


  const [departments, setDepartments] = useState<DepartmentItem[]>([]);

  useEffect(() => {
    api<DepartmentItem[] | { results: DepartmentItem[] }>("/portal/departments/")
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.results || [];
        setDepartments(list);
      })
      .catch(() => {});
  }, []);

  const dynamicDeptPills = useMemo(() => {
    return [
      { id: "web_development", name: "Web Development" },
      { id: "video_editing", name: "Video Editing" },
      { id: "design", name: "Design" },
      { id: "digital_marketing", name: "Digital Marketing" },
      { id: "accountant", name: "Accountant" },
      { id: "operations", name: "Operations" },
      { id: "hr", name: "HR" },
    ];
  }, []);

  useEffect(() => {
    setActiveTab(initialTab === "overview" || initialTab === "command-center" ? "kanban" : initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (assignments && assignments.length > 0) {
      const converted: TaskItem[] = assignments.map((a) => {
        const statusMap: Record<string, TaskItem["status"]> = {
          Backlog: "backlog",
          Assigned: "assigned",
          Pending: "assigned",
          "In Progress": "progress",
          Ongoing: "progress",
          Blocked: "progress",
          "In Review": "review",
          "Changes Requested": "progress",
          Rejected: "assigned",
          Approved: "approved",
          Completed: "published",
          Published: "published",
        };
        const priorityMap: Record<string, TaskItem["priority"]> = {
          Low: "p2",
          Normal: "p2",
          High: "p1",
          Urgent: "p0",
        };
        const rawWorkType = (a.deliverables && a.deliverables.length > 0 && a.deliverables[0].work_type)
          ? a.deliverables[0].work_type
          : a.employee_department;
        const detectedType = normalizeDepartment(rawWorkType);

        const mappedStatus = statusMap[a.status] || "progress";
        const isAssignedDatePast = a.assigned_date ? isDateStrictlyPast(a.assigned_date) : false;
        const isFinished = ["approved", "published"].includes(mappedStatus);
        const isBacklogTask = (a.is_backlog || a.status === "Backlog" || (isAssignedDatePast && !isFinished));
        const finalStatus = isBacklogTask ? "backlog" : mappedStatus;


        return {
          id: String(a.id),
          code: `EXP-${String(a.id).padStart(3, "0")}`,
          title: a.title,
          desc: (a.description || "").replace(/\[PHASE:\s*[^\]]+\]/gi, "").replace(/\[EST_HOURS:\s*[^\]]+\]/gi, "").trim(),
          type: detectedType,
          phase: "ph1",
          assignee: String(a.employee),
          assigneeName: a.employee_name,
          reviewer: a.reviewer_name || (a.reviewer_details ? a.reviewer_details.name : "") || "Admin",
          reviewerId: a.reviewer,
          due: a.due_date,
          hours: 8,
          status: finalStatus,
          priority: priorityMap[a.priority] || "p1",
          rawStatus: a.status,
          reviewStatus: a.review_status || "PENDING_REVIEW",
          reviewNote: a.review_note || "",
          reviewedBy: a.reviewed_by,
          reviewedAt: a.reviewed_at,
          reviewedByName: a.reviewed_by_name || "",
          clientName: a.client_name,
          clientId: a.client,
        };
      });
      setTasks(converted);
    } else {
      setTasks([]);
    }
  }, [assignments]);









  const dynamicMembers = useMemo(() => {
    return [...(members || [])]
      .map((member) => ({
        id: String(member.id),
        name: member.display_name,
        department: member.department || "Member",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [members]);

  useEffect(() => {
    if (selectedMemberFilter === "all") return;
    if (!dynamicMembers.some((member) => member.id === selectedMemberFilter)) {
      setSelectedMemberFilter("all");
    }
  }, [dynamicMembers, selectedMemberFilter]);



  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => ["published", "approved"].includes(t.status)).length;
  const inProgressTasks = tasks.filter((t) => t.status === "progress").length;
  const reviewTasks = tasks.filter((t) => t.status === "review").length;
  const lateTasks = tasks.filter((t) => isDateStrictlyPast(t.due) && !["published", "approved"].includes(t.status));
  const completionPct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const totalBudget = DEFAULT_BUDGET.reduce((a, b) => a + b.total, 0);
  const spentBudget = DEFAULT_BUDGET.reduce((a, b) => a + b.spent, 0);

  const totalContractedUnits = DEFAULT_DELIVERABLES.reduce((a, d) => a + d.contracted, 0);
  const deliveredUnits = DEFAULT_DELIVERABLES.reduce((a, d) => {
    const c = tasks.filter((t) => t.deliverable === d.id && ["published", "approved"].includes(t.status)).length;
    return a + Math.min(c, d.contracted);
  }, 0);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          if (!t.title.toLowerCase().includes(q) && !t.code.toLowerCase().includes(q) && !t.assigneeName.toLowerCase().includes(q)) return false;
        }
        if (selectedPhaseFilter !== "all" && t.phase !== selectedPhaseFilter) return false;
        if (selectedTypeFilter !== "all") {
          if (normalizeDepartment(t.type) !== normalizeDepartment(selectedTypeFilter)) {
            return false;
          }
        }

        if (selectedMemberFilter !== "all" && t.assignee !== selectedMemberFilter) return false;
        if (selectedPriorityFilter !== "all" && t.priority !== selectedPriorityFilter) return false;
        if (statusPillFilter !== "all" && t.status !== statusPillFilter) return false;
        return true;
      });

  }, [tasks, searchQuery, selectedPhaseFilter, selectedTypeFilter, selectedMemberFilter, selectedPriorityFilter, statusPillFilter]);

  const selectedMember = useMemo(() => {
    return selectedMemberFilter === "all" ? null : dynamicMembers.find((member) => member.id === selectedMemberFilter) || null;
  }, [dynamicMembers, selectedMemberFilter]);

  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState("");

  const handleWorkStatusChange = async (id: string, newStatus: WorkStatus) => {
    if (!onStatusChange || isNaN(Number(id)) || isUpdatingStatus) return;
    if (newStatus === "Backlog") {
      setStatusError("Backlog status is automatically calculated for overdue tasks after midnight and cannot be set manually.");
      return;
    }
    setIsUpdatingStatus(true);
    setStatusError("");
    const statusMap: Record<string, TaskItem["status"]> = {
      Backlog: "backlog",
      Assigned: "assigned",
      Pending: "assigned",
      "In Progress": "progress",
      Ongoing: "progress",
      Blocked: "progress",
      "In Review": "review",
      "Changes Requested": "progress",
      Rejected: "assigned",
      Approved: "approved",
      Completed: "published",
      Published: "published",
    };

    try {
      await onStatusChange(Number(id), newStatus);
      const kanbanStatus = statusMap[newStatus] || "progress";
      const todayStr = new Date().toISOString().split("T")[0];
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, rawStatus: newStatus, status: kanbanStatus, is_backlog: false, due: t.due < todayStr ? todayStr : t.due } : t)));
      if (selectedTask && selectedTask.id === id) {
        setSelectedTask(null);
      }
    } catch (err: any) {

      setStatusError(err?.message || "Could not update status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const moveTask = (id: string, newStatus: TaskItem["status"]) => {
    const reverseMap: Record<TaskItem["status"], WorkStatus> = {
      backlog: "Backlog",
      assigned: "Assigned",
      progress: "In Progress",
      review: "In Review",
      approved: "Approved",
      published: "Published",
    };
    handleWorkStatusChange(id, reverseMap[newStatus]);
  };

  const updateKpi = (id: string) => {
    const val = parseInt(kpiInputs[id] || "0", 10);
    if (isNaN(val)) return;
    setKpis((prev) => prev.map((k) => (k.id === id ? { ...k, current: val } : k)));
    setKpiInputs((prev) => ({ ...prev, [id]: "" }));
  };

  const overallProgressPct = useMemo(() => {
    if (workSummary && typeof workSummary.overall_progress === "number") {
      return workSummary.overall_progress;
    }
    const relevantTasks = tasks.filter((t) => {
      const typeStr = (t.type || "").toLowerCase();
      return (
        typeStr.includes("design") ||
        typeStr.includes("video") ||
        typeStr.includes("it") ||
        typeStr.includes("web") ||
        typeStr.includes("ads") ||
        typeStr.includes("content") ||
        typeStr.includes("marketing")
      );
    });
    if (relevantTasks.length === 0) return 0;
    const completed = relevantTasks.filter((t) => ["published", "approved"].includes(t.status)).length;
    return Math.round((completed / relevantTasks.length) * 100);
  }, [workSummary, tasks]);

  const trackerTitle = selectedClientName ? `${selectedClientName} Progress` : "Overall Client Progress";
  const deptProgress = workSummary?.dept_progress;

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
              { id: "deliverables", label: "Contract Scope", icon: CheckCircle2 },
              { id: "approvals", label: "Approvals Queue", icon: Zap },
              { id: "team", label: "Team Capacity", icon: Users },
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
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* COMPACT CLIENT PROGRESS TRACKER */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                padding: "12px 16px",
                borderRadius: "8px",
                background: "var(--panel2)",
                border: "1px solid var(--border2)",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text)", letterSpacing: "0.2px" }}>
                    {trackerTitle}
                  </span>
                  {onClientChange && (
                    <select
                      value={selectedClientId || ""}
                      onChange={(e) => onClientChange(e.target.value)}
                      style={{
                        background: "#ffffff",
                        color: "#1a1b1e",
                        border: "1px solid #dad7ce",
                        borderRadius: "6px",
                        padding: "4px 10px",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: "pointer",
                        outline: "none",
                      }}
                    >
                      <option value="" style={{ background: "#ffffff", color: "#1a1b1e" }}>
                        All Clients
                      </option>
                      {clients.map((c) => (
                        <option key={c.id} value={String(c.id)} style={{ background: "#ffffff", color: "#1a1b1e" }}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <span style={{ fontSize: "14px", fontWeight: 800, color: "var(--goldD)", fontFamily: "monospace" }}>
                  {Math.round(overallProgressPct)}%
                </span>
              </div>

              <div
                style={{
                  height: "7px",
                  width: "100%",
                  background: "#e8e6e1",
                  borderRadius: "99px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.max(0, Math.min(100, overallProgressPct))}%`,
                    background: "linear-gradient(90deg, #cba86e 0%, #a8874e 100%)",
                    borderRadius: "99px",
                    transition: "width 0.4s ease",
                    boxShadow: "0 0 8px rgba(203, 168, 110, 0.4)",
                  }}
                />
              </div>

              {deptProgress && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                    gap: "10px 14px",
                    paddingTop: "8px",
                    borderTop: "1px solid var(--line)",
                    marginTop: "2px",
                  }}
                >
                  {[
                    { label: "Design", key: "design" },
                    { label: "Marketing", key: "marketing" },
                    { label: "Web Dev", key: "web" },
                    { label: "Video Editing", key: "video" },
                  ].map(({ label, key }) => {
                    const cat = deptProgress[key as keyof typeof deptProgress];
                    const hasWork = cat ? (cat.has_work ?? (cat.assigned > 0)) : false;
                    const pct = cat ? cat.pct : 0;
                    return (
                      <div key={key} style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10.5px" }}>
                          <span style={{ color: "var(--muted)", fontWeight: 600 }}>{label}</span>
                          <span style={{ fontSize: "10px", fontWeight: 700, color: hasWork ? "var(--goldD)" : "var(--muted)", fontFamily: "monospace" }}>
                            {hasWork ? `${Math.round(pct)}%` : "No work"}
                          </span>
                        </div>
                        <div style={{ height: "4px", width: "100%", background: "#e8e6e1", borderRadius: "99px", overflow: "hidden" }}>
                          {hasWork ? (
                            <div
                              style={{
                                height: "100%",
                                width: `${Math.max(0, Math.min(100, pct))}%`,
                                background: "#cba86e",
                                borderRadius: "99px",
                                transition: "width 0.4s ease",
                              }}
                            />
                          ) : (
                            <div style={{ height: "100%", width: "0%", background: "transparent" }} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

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
              <div style={{ display: "flex", gap: "4px", overflowX: "auto", flexWrap: "nowrap", WebkitOverflowScrolling: "touch", paddingBottom: "2px" }}>
                <button
                  type="button"
                  onClick={() => setSelectedTypeFilter("all")}
                  style={{ flexShrink: 0, whiteSpace: "nowrap", padding: "4px 10px", borderRadius: "var(--rs)", fontSize: "10.5px", fontWeight: 700, background: selectedTypeFilter === "all" ? "var(--neon)" : "var(--panel2)", color: selectedTypeFilter === "all" ? "var(--bg)" : "var(--muted)" }}
                >
                  All Depts / Types
                </button>
                {dynamicDeptPills.map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setSelectedTypeFilter(pill.id)}
                    style={{ flexShrink: 0, whiteSpace: "nowrap", padding: "4px 10px", borderRadius: "var(--rs)", fontSize: "10.5px", fontWeight: 700, background: selectedTypeFilter === pill.id ? "var(--neon)" : "var(--panel2)", color: selectedTypeFilter === pill.id ? "var(--bg)" : "var(--muted)" }}
                  >
                    {pill.name}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <select
                  className="fs"
                  value={selectedMemberFilter}
                  onChange={(e) => setSelectedMemberFilter(e.target.value)}
                  style={{ width: "auto", minWidth: "128px", background: "var(--panel2)", color: "var(--text)", border: "1px solid var(--border2)" }}
                >
                  <option value="all" style={{ background: "var(--panel2)", color: "var(--text)" }}>All Members</option>
                  {dynamicMembers.map((m) => (
                    <option key={m.id} value={m.id} style={{ background: "var(--panel2)", color: "var(--text)" }}>{m.name}</option>
                  ))}
                </select>


                <select
                  className="fs"
                  value={selectedPriorityFilter}
                  onChange={(e) => setSelectedPriorityFilter(e.target.value)}
                  style={{ width: "auto", minWidth: "126px", background: "var(--panel2)", color: "var(--text)", border: "1px solid var(--border2)" }}
                >
                  <option value="all" style={{ background: "var(--panel2)", color: "var(--text)" }}>All Priorities</option>
                  <option value="p0" style={{ background: "var(--panel2)", color: "var(--text)" }}>P0 Critical</option>
                  <option value="p1" style={{ background: "var(--panel2)", color: "var(--text)" }}>P1 High</option>
                  <option value="p2" style={{ background: "var(--panel2)", color: "var(--text)" }}>P2 Normal</option>
                </select>

              </div>
            </div>

            {/* Status Pills */}
            <div style={{ display: "flex", gap: "6px", overflowX: "auto", flexWrap: "nowrap", WebkitOverflowScrolling: "touch", paddingTop: "8px", borderTop: "1px solid var(--border)", paddingBottom: "2px" }}>
              <button
                type="button"
                onClick={() => setStatusPillFilter("all")}
                style={{ flexShrink: 0, whiteSpace: "nowrap", padding: "4px 12px", borderRadius: "99px", fontSize: "11px", fontWeight: 700, background: statusPillFilter === "all" ? "var(--neon)" : "var(--panel2)", color: statusPillFilter === "all" ? "var(--bg)" : "var(--muted)" }}
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
                    style={{ flexShrink: 0, whiteSpace: "nowrap", padding: "4px 12px", borderRadius: "99px", fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px", background: statusPillFilter === st.id ? "var(--neon)" : "var(--panel2)", color: statusPillFilter === st.id ? "var(--bg)" : "var(--muted)" }}
                  >
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: st.color, flexShrink: 0 }} />
                    {st.name} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* EMPLOYEE BACKLOG REMINDER BANNER */}
          {!isBannerDismissed && tasks.filter(t => t.status === "backlog").length > 0 && (
            <div style={{
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              borderRadius: "var(--r-sm)",
              padding: "10px 14px",
              marginTop: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 700, color: "#DC2626" }}>
                <span>⚠️ {tasks.filter(t => t.status === "backlog").length === 1 ? "1 task is overdue" : `${tasks.filter(t => t.status === "backlog").length} tasks are overdue`}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsBannerDismissed(true);
                  if (typeof window !== "undefined") {
                    localStorage.setItem("flumenx_overdue_banner_dismissed", "true");
                  }
                }}
                style={{
                  background: "rgba(239, 68, 68, 0.15)",
                  color: "#DC2626",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "var(--r-sm)",
                  padding: "4px 10px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  whiteSpace: "nowrap",
                }}
                title="Close reminder banner"
              >
                <span>Close</span>
                <span>✕</span>
              </button>

            </div>
          )}


          {selectedMember && filteredTasks.length === 0 && (

            <div style={{ border: "1px solid var(--border)", background: "var(--panel2)", color: "var(--muted)", padding: "12px 14px", fontSize: "12px", fontWeight: 700 }}>
              No assignments found for this employee.
            </div>
          )}

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
                    {(() => {
                      if (colTasks.length === 0) {
                        return <div style={{ textAlign: "center", padding: "24px 8px", color: "var(--muted)", fontSize: "11px" }}>No tasks</div>;
                      }

                      const groupsMap = new Map<string, TaskItem[]>();
                      colTasks.forEach((t) => {
                        const cName = t.clientName || "General";
                        const aName = t.assigneeName || "Unassigned";
                        const key = `${cName}__${aName}`;
                        if (!groupsMap.has(key)) {
                          groupsMap.set(key, []);
                        }
                        groupsMap.get(key)!.push(t);
                      });

                      const renderedItems: React.ReactNode[] = [];

                      groupsMap.forEach((tasksInGroup, key) => {
                        if (tasksInGroup.length === 1) {
                          const t = tasksInGroup[0];
                          const isOverdue = isDateStrictlyPast(t.due);
                          const canonKey = normalizeDepartment(t.type);
                          const typeInfo = CANONICAL_DEPARTMENTS[canonKey] || { label: t.type, badge: t.type, color: "#89ACA0" };
                          renderedItems.push(
                            <div
                              key={t.id}
                              className="tcard"
                              onClick={() => setSelectedTask(t)}
                              style={{ padding: "12px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "8px", cursor: "pointer", marginBottom: "8px" }}
                            >
                              <div className="tc-top" style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                                <span className="chip" style={{ background: typeInfo.color + "20", color: typeInfo.color, padding: "2px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: 700 }}>
                                  {typeInfo.label}
                                </span>
                                <span className={`chip ${t.priority === "p0" ? "p-p0" : "p-p1"}`} style={{ padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 700 }}>
                                  {t.priority.toUpperCase()}
                                </span>
                                {t.reviewStatus === "OK" && (
                                  <span style={{ background: "rgba(34, 197, 94, 0.2)", color: "#4ADE80", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 700 }}>
                                    ✓ OK
                                  </span>
                                )}
                                {t.reviewStatus === "CORRECTION_NEEDED" && (
                                  <span style={{ background: "rgba(245, 158, 11, 0.2)", color: "#F59E0B", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 700 }}>
                                    ↩ Correction Needed
                                  </span>
                                )}
                                {(!t.reviewStatus || t.reviewStatus === "PENDING_REVIEW") && (
                                  <span style={{ background: "rgba(148, 163, 184, 0.15)", color: "#94A3B8", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 600 }}>
                                    ⏳ Pending Review
                                  </span>
                                )}
                                <span className="tc-code" style={{ marginLeft: "auto", fontSize: "10px", color: "var(--muted)", fontFamily: "monospace" }}>{t.code}</span>
                              </div>

                              <div className="tc-title" style={{ fontWeight: 700, fontSize: "13px", color: "#E8F5EF", marginBottom: "6px" }}>{t.title}</div>
                              {t.desc && <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "8px", lineHeight: "1.3" }}>{t.desc}</div>}

                              <div className="tc-assignee-info" style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "8px", background: "var(--panel2)", borderRadius: "6px", marginBottom: "8px" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px" }}>
                                  <span style={{ color: "var(--muted)" }}>Assigned To:</span>
                                  <span style={{ color: "var(--goldD)", fontWeight: 700 }}>{t.assigneeName || "Unassigned"}</span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "10.5px" }}>
                                  <span style={{ color: "var(--muted)" }}>Reviewer:</span>
                                  <span style={{ color: "#A78BFA", fontWeight: 600 }}>{t.reviewer || "Admin"}</span>
                                </div>
                              </div>

                              <div className="tc-meta" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px", color: "var(--muted)" }}>
                                <div className={`tc-due ${isOverdue ? "late" : ""}`} style={{ color: isOverdue ? "#FF6B6B" : "var(--muted)", fontSize: "11px", fontWeight: isOverdue ? 700 : 400 }}>
                                  📅 {isOverdue ? "Overdue: " : "Due: "}{t.due}
                                </div>
                              </div>

                              <div style={{ marginTop: "8px", paddingTop: "6px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "10.5px", color: "var(--muted)", fontWeight: 600 }}>Status:</span>
                                <select
                                   value={t.status === "backlog" ? "Backlog" : (t.rawStatus || "Assigned")}
                                   disabled={!canUserChangeTaskStatus(t) || isUpdatingStatus}
                                   onClick={(e) => e.stopPropagation()}
                                   onChange={async (e) => {
                                     e.stopPropagation();
                                     const newWorkStatus = e.target.value as WorkStatus;
                                     e.target.blur();
                                     if (!canUserChangeTaskStatus(t) || isUpdatingStatus) return;
                                     await handleWorkStatusChange(t.id, newWorkStatus);
                                   }}
                                   className="fs"
                                   style={{
                                     padding: "2px 8px",
                                     fontSize: "11px",
                                     color: t.status === "backlog" ? "#FF6B6B" : "#1a1b1e",
                                     background: t.status === "backlog" ? "#fef2f2" : "#ffffff",
                                     border: t.status === "backlog" ? "1px solid rgba(255,107,107,0.3)" : "1px solid #dad7ce",
                                     borderRadius: "4px",
                                     fontWeight: 600,
                                     cursor: canUserChangeTaskStatus(t) ? "pointer" : "not-allowed",
                                     opacity: canUserChangeTaskStatus(t) ? 1 : 0.6,
                                   }}
                                   title={!canUserChangeTaskStatus(t) ? "Only Reviewer and Admins can change status" : "Change status"}
                                 >
                                   {t.status === "backlog" && (
                                     <option value="Backlog">Backlog (Overdue)</option>
                                   )}
                                   {!ALL_WORK_STATUSES.some((st) => st.id === t.rawStatus) && t.rawStatus && t.status !== "backlog" && (
                                     <option value={t.rawStatus} disabled>
                                       {t.rawStatus}
                                     </option>
                                   )}
                                   {ALL_WORK_STATUSES.map((st) => {
                                     const isReviewerOnly = st.isReviewerOnly;
                                     const isBacklog = st.id === "Backlog";
                                     const isAllowed = !isBacklog && canUserChangeTaskStatus(t) && (!isReviewerOnly || isReviewerOrManager(t));
                                     return (
                                       <option key={st.id} value={st.id} disabled={!isAllowed}>
                                         {st.name} {isBacklog ? "(Auto Overdue)" : isReviewerOnly && !isReviewerOrManager(t) ? "🔒" : ""}
                                       </option>
                                     );
                                   })}
                                 </select>
                              </div>
                            </div>
                          );
                        } else {
                          const [clientName, assigneeName] = key.split("__");
                          const reviewerName = tasksInGroup[0].reviewer || "Admin";
                          const groupData: TaskGroup = {
                            key,
                            clientName,
                            assigneeName,
                            reviewerName,
                            tasks: tasksInGroup,
                          };

                          renderedItems.push(
                            <div
                              key={`group_${key}`}
                              className="tcard tcard-grouped"
                              onClick={() => setSelectedTaskGroup(groupData)}
                              style={{
                                padding: "12px",
                                background: "var(--panel)",
                                border: "1.5px solid var(--neon)",
                                borderRadius: "8px",
                                cursor: "pointer",
                                marginBottom: "8px",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                                <span className="chip" style={{ background: "rgba(203, 168, 110, 0.15)", color: "var(--goldD)", padding: "3px 10px", borderRadius: "4px", fontSize: "11px", fontWeight: 800 }}>
                                  {clientName}
                                </span>
                                <span style={{ background: "#3B82F6", color: "#FFFFFF", padding: "2px 8px", borderRadius: "12px", fontSize: "10.5px", fontWeight: 800 }}>
                                  {tasksInGroup.length} Tasks
                                </span>
                              </div>

                              <div style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text)", marginBottom: "6px" }}>
                                📁 {tasksInGroup.length} Work Assignments Batch
                              </div>

                              <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "8px", display: "flex", flexDirection: "column", gap: "3px", background: "var(--panel2)", padding: "6px 8px", borderRadius: "6px" }}>
                                {tasksInGroup.slice(0, 3).map((gt) => (
                                  <div key={gt.id} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    • {gt.title}
                                  </div>
                                ))}
                                {tasksInGroup.length > 3 && (
                                  <div style={{ fontSize: "10px", color: "var(--amber)", fontWeight: 700, marginTop: "2px" }}>
                                    +{tasksInGroup.length - 3} more task(s)...
                                  </div>
                                )}
                              </div>

                              <div className="tc-assignee-info" style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "8px", background: "var(--panel2)", borderRadius: "6px", marginBottom: "6px" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px" }}>
                                  <span style={{ color: "var(--muted)" }}>Assigned To:</span>
                                  <span style={{ color: "var(--goldD)", fontWeight: 700 }}>{assigneeName}</span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "10.5px" }}>
                                  <span style={{ color: "var(--muted)" }}>Reviewer:</span>
                                  <span style={{ color: "#A78BFA", fontWeight: 600 }}>{reviewerName}</span>
                                </div>
                              </div>

                              <div style={{ fontSize: "10.5px", color: "var(--neon)", fontWeight: 700, textAlign: "right" }}>
                                Click to view all {tasksInGroup.length} tasks ➔
                              </div>
                            </div>
                          );
                        }
                      });

                      return renderedItems;
                    })()}
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
                  {(canManageAll || isReviewerOrManager(t)) && (
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

      {/* TASK DETAIL MODAL */}
      {selectedTask && (
        <Modal title={selectedTask.title} eyebrow="FLUMENX / TASK DETAILS" size="xl" onClose={() => setSelectedTask(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "4px 0" }}>
            
            {/* SUB-HEADER & CODE */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "monospace", display: "flex", gap: "6px", alignItems: "center" }}>
                <span style={{ color: "var(--neon)", fontWeight: 700 }}>{selectedTask.code}</span>
              </div>

              {/* STATUS & PRIORITY CHIPS */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                <span className="chip" style={{ background: "rgba(34, 211, 238, 0.14)", color: "#22D3EE" }}>
                  {CANONICAL_DEPARTMENTS[normalizeDepartment(selectedTask.type)]?.label || selectedTask.type}
                </span>
                <span className="chip" style={{ background: "rgba(245, 158, 11, 0.14)", color: "#F59E0B" }}>
                  {selectedTask.priority.toUpperCase()}
                </span>
                <span className="chip" style={{ background: "rgba(100, 116, 139, 0.2)", color: "#94A3B8" }}>
                  {selectedTask.status.toUpperCase()}
                </span>
              </div>
            </div>

            {/* DESCRIPTION BOX */}
            {selectedTask.desc && (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "14px 16px", fontSize: "13px", color: "var(--text)", lineHeight: "1.5" }}>
                {selectedTask.desc}
              </div>
            )}

            {/* METADATA GRID (2 COLUMNS) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px 20px", fontSize: "12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "14px 16px" }}>
              <div style={{ display: "flex", gap: "6px" }}>
                <span style={{ color: "var(--muted)", fontWeight: 600 }}>Assigned to—</span>
                <span style={{ color: "var(--text)", fontWeight: 600 }}>{selectedTask.assigneeName || "—"}</span>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <span style={{ color: "var(--muted)", fontWeight: 600 }}>Estimated hours—</span>
                <span style={{ color: "var(--text)" }}>{selectedTask.hours || 6}h</span>
              </div>

              <div style={{ display: "flex", gap: "6px" }}>
                <span style={{ color: "var(--muted)", fontWeight: 600 }}>Reviewer—</span>
                <span style={{ color: "var(--text)" }}>{selectedTask.reviewer || "—"}</span>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <span style={{ color: "var(--muted)", fontWeight: 600 }}>Client—</span>
                <span style={{ color: "var(--neon)", fontWeight: 700 }}>{selectedTask.clientName || clients.find((c) => c.id === selectedTask.clientId)?.name || "—"}</span>
              </div>

              <div style={{ display: "flex", gap: "6px" }}>
                <span style={{ color: "var(--muted)", fontWeight: 600 }}>Due date—</span>
                <span style={{ color: "var(--text)" }}>{selectedTask.due || "—"}</span>
              </div>
            </div>

            {/* MOVE TO STATUS SECTION */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", flexWrap: "wrap", gap: "6px" }}>
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", color: "var(--muted)", textTransform: "uppercase" }}>
                  MOVE TO STATUS
                </span>
                {!canMoveSelectedTaskStatus && (
                  <span style={{ fontSize: "11px", color: "var(--amber)", fontWeight: 600 }}>
                    🔒 Restricted to designated Reviewer ({selectedTask.reviewer || "Reviewer"}) or Management
                  </span>
                )}
              </div>

              {statusError && (
                <div style={{ background: "rgba(255, 89, 77, 0.12)", color: "var(--red)", border: "1px solid rgba(255, 89, 77, 0.28)", padding: "8px 12px", borderRadius: "6px", fontSize: "12px", marginBottom: "10px" }}>
                  {statusError}
                </div>
              )}

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {selectedTask.rawStatus === "Backlog" && (
                  <button
                    type="button"
                    disabled
                    style={{
                      padding: "6px 14px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: 700,
                      background: "rgba(255, 107, 107, 0.2)",
                      color: "#FF6B6B",
                      border: "1px solid rgba(255, 107, 107, 0.4)",
                      cursor: "not-allowed",
                    }}
                  >
                    Backlog (Automated Overdue) ✓
                  </button>
                )}
                {!ALL_WORK_STATUSES.some((st) => st.id === selectedTask.rawStatus) && selectedTask.rawStatus && selectedTask.rawStatus !== "Backlog" && (
                  <button
                    type="button"
                    disabled
                    style={{
                      padding: "6px 14px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: 700,
                      background: "var(--neon)",
                      color: "var(--bg)",
                      border: "none",
                      cursor: "not-allowed",
                      opacity: 0.8,
                    }}
                  >
                    {selectedTask.rawStatus} ✓
                  </button>
                )}
                {ALL_WORK_STATUSES.filter((st) => st.id !== "Backlog").map((st) => {
                  const isCurrent = selectedTask.rawStatus === st.id;
                  const isReviewerOnly = st.isReviewerOnly;
                  const isAllowed = canMoveSelectedTaskStatus && (!isReviewerOnly || isReviewerOrManager(selectedTask));
                  return (
                    <button
                      key={st.id}
                      type="button"
                      disabled={!isAllowed || isUpdatingStatus}
                      onClick={async () => {
                        if (!isAllowed || isUpdatingStatus) return;
                        await handleWorkStatusChange(selectedTask.id, st.id);
                      }}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: 700,
                        background: isCurrent ? "var(--neon)" : "var(--panel2)",
                        color: isCurrent ? "var(--bg)" : "var(--muted)",
                        border: isCurrent ? "none" : "1px solid var(--border2)",
                        cursor: isAllowed ? "pointer" : "not-allowed",
                        opacity: isAllowed ? 1 : 0.45,
                        transition: "all 0.15s ease",
                      }}
                      title={!isAllowed ? `Requires Reviewer (${selectedTask.reviewer}) or Management permission` : `Move to ${st.name}`}
                    >
                      {st.name} {isCurrent ? "✓" : ""}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* REVIEWER CHECK (QUALITY AUDIT) SECTION */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "6px" }}>
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", color: "var(--muted)", textTransform: "uppercase" }}>
                  REVIEWER CHECK (QUALITY AUDIT)
                </span>
                <span style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  textTransform: "uppercase",
                  background: selectedTask.reviewStatus === "OK" ? "rgba(203, 168, 110, 0.12)" : selectedTask.reviewStatus === "CORRECTION_NEEDED" ? "rgba(255, 89, 77, 0.12)" : "rgba(245, 166, 35, 0.12)",
                  color: selectedTask.reviewStatus === "OK" ? "var(--goldD)" : selectedTask.reviewStatus === "CORRECTION_NEEDED" ? "#FF594D" : "#F5A623",
                  border: selectedTask.reviewStatus === "OK" ? "1px solid rgba(203, 168, 110, 0.28)" : selectedTask.reviewStatus === "CORRECTION_NEEDED" ? "1px solid rgba(255, 89, 77, 0.28)" : "1px solid rgba(245, 166, 35, 0.28)",
                }}>
                  {selectedTask.reviewStatus === "OK" ? "✓ OK" : selectedTask.reviewStatus === "CORRECTION_NEEDED" ? "↩ Correction Needed" : "⏳ Pending Review"}
                </span>
              </div>

              {selectedTask.reviewStatus === "CORRECTION_NEEDED" && (
                <div style={{ background: "rgba(255, 89, 77, 0.08)", border: "1px solid rgba(255, 89, 77, 0.25)", borderRadius: "6px", padding: "12px", marginBottom: "12px" }}>
                  <div style={{ fontWeight: 700, color: "#FF594D", fontSize: "11px", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "4px" }}>
                    ↩ CORRECTION NEEDED
                  </div>
                  <div style={{ fontSize: "12.5px", color: "var(--text)", marginBottom: "6px", lineHeight: "1.45" }}>
                    "{selectedTask.reviewNote || "Correction requested."}"
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                    Reviewed by <strong style={{ color: "#FF594D" }}>{selectedTask.reviewedByName || selectedTask.reviewer || "Reviewer"}</strong> {selectedTask.reviewedAt ? `• ${new Date(selectedTask.reviewedAt).toLocaleString()}` : ""}
                  </div>
                </div>
              )}

              {selectedTask.reviewStatus === "OK" && (
                <div style={{ background: "rgba(203, 168, 110, 0.08)", border: "1px solid rgba(203, 168, 110, 0.25)", borderRadius: "6px", padding: "10px 12px", marginBottom: "12px", fontSize: "12px", color: "var(--goldD)" }}>
                  ✓ Quality audit passed — Marked OK by <strong>{selectedTask.reviewedByName || selectedTask.reviewer || "Reviewer"}</strong> {selectedTask.reviewedAt ? `on ${new Date(selectedTask.reviewedAt).toLocaleDateString()}` : ""}
                </div>
              )}

              {isReviewerOrManager(selectedTask) ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "6px" }}>
                      REVIEWER NOTE / FEEDBACK
                    </label>
                    <textarea
                      rows={2}
                      value={reviewNoteInput}
                      onChange={(e) => setReviewNoteInput(e.target.value)}
                      placeholder="Type reviewer feedback or correction details..."
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "6px", background: "var(--panel)", border: "1px solid var(--border2)", color: "var(--text)", fontSize: "12px", resize: "vertical" }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      disabled={isSubmittingReview}
                      onClick={async () => {
                        if (!onReviewCheck || isSubmittingReview) return;
                        setIsSubmittingReview(true);
                        try {
                          await onReviewCheck(Number(selectedTask.id), "OK", reviewNoteInput);
                          setSelectedTask((prev) => prev ? { ...prev, reviewStatus: "OK", reviewNote: reviewNoteInput } : null);
                        } finally {
                          setIsSubmittingReview(false);
                        }
                      }}
                      style={{ flex: 1, minWidth: "130px", height: "38px", borderRadius: "6px", background: "var(--neon)", color: "var(--bg)", fontWeight: 700, fontSize: "12px", border: "none", cursor: isSubmittingReview ? "not-allowed" : "pointer" }}
                    >
                      ✓ Mark as OK
                    </button>

                    <button
                      type="button"
                      disabled={isSubmittingReview || !reviewNoteInput.trim()}
                      onClick={async () => {
                        if (!onReviewCheck || isSubmittingReview || !reviewNoteInput.trim()) return;
                        setIsSubmittingReview(true);
                        try {
                          await onReviewCheck(Number(selectedTask.id), "CORRECTION_NEEDED", reviewNoteInput);
                          setSelectedTask((prev) => prev ? { ...prev, reviewStatus: "CORRECTION_NEEDED", reviewNote: reviewNoteInput } : null);
                        } finally {
                          setIsSubmittingReview(false);
                        }
                      }}
                      style={{ flex: 1, minWidth: "150px", height: "38px", borderRadius: "6px", background: "rgba(255, 89, 77, 0.12)", color: "#FF594D", border: "1px solid rgba(255, 89, 77, 0.3)", fontWeight: 700, fontSize: "12px", cursor: (isSubmittingReview || !reviewNoteInput.trim()) ? "not-allowed" : "pointer", opacity: reviewNoteInput.trim() ? 1 : 0.5 }}
                      title={!reviewNoteInput.trim() ? "A reviewer note is required to request corrections" : "Request Correction"}
                    >
                      ↩ Correction Needed
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: "11.5px", color: "var(--muted)", fontStyle: "italic" }}>
                  Quality audit is managed by assigned Reviewer ({selectedTask.reviewer || "Reviewer"}) or Management.
                </div>
              )}

            </div>

            {/* FOOTER ACTIONS */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
              {canDeleteSelectedTask && (
                <button
                  type="button"
                  style={{ background: "rgba(255, 89, 77, 0.12)", color: "#FF594D", border: "1px solid rgba(255, 89, 77, 0.3)", padding: "0 16px", height: "38px", borderRadius: "6px", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}
                  onClick={async () => {
                    if (confirm("Delete this task?")) {
                      if (onDeleteWork) {
                        const ok = await onDeleteWork(Number(selectedTask.id));
                        if (ok) {
                          setTasks((prev) => prev.filter((t) => t.id !== selectedTask.id));
                          setSelectedTask(null);
                        }
                      }
                    }
                  }}
                >
                  Delete
                </button>
              )}
              <button
                type="button"
                className="secondary-button"
                style={{ height: "38px" }}
                onClick={() => setSelectedTask(null)}
              >
                Close
              </button>
            </div>

          </div>
        </Modal>
      )}

      {/* GROUPED TASKS DRILL-DOWN MODAL */}
      {selectedTaskGroup && (
        <Modal
          title={`Grouped Work Tasks — ${selectedTaskGroup.clientName}`}
          eyebrow="FLUMENX / BATCH WORK ASSIGNMENTS"
          size="xl"
          onClose={() => setSelectedTaskGroup(null)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "4px 0" }}>
            {/* GROUP HEADER METADATA BANNER */}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", padding: "12px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px" }}>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>Client: {selectedTaskGroup.clientName}</div>
                <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                  Assigned To: <strong style={{ color: "var(--neon)" }}>{selectedTaskGroup.assigneeName}</strong> | Reviewer: <strong style={{ color: "#A78BFA" }}>{selectedTaskGroup.reviewerName}</strong>
                </div>
              </div>
              <span style={{ background: "#3B82F6", color: "#FFFFFF", padding: "4px 12px", borderRadius: "16px", fontSize: "12px", fontWeight: 800 }}>
                {selectedTaskGroup.tasks.length} Independent Tasks
              </span>
            </div>

            {/* TASK LIST */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "60vh", overflowY: "auto", paddingRight: "4px" }}>
              {selectedTaskGroup.tasks.map((gt, idx) => {
                const isOverdue = isDateStrictlyPast(gt.due);
                const canonKey = normalizeDepartment(gt.type);
                const typeInfo = CANONICAL_DEPARTMENTS[canonKey] || { label: gt.type, badge: gt.type, color: "#89ACA0" };
                return (
                  <div
                    key={gt.id}
                    style={{
                      padding: "14px 16px",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "14px" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)" }}>#{idx + 1}</span>
                          <span style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--muted)" }}>{gt.code}</span>
                          <span className="chip" style={{ background: typeInfo.color + "20", color: typeInfo.color, padding: "2px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: 700 }}>
                            {typeInfo.label}
                          </span>
                          <span className={`chip ${gt.priority === "p0" ? "p-p0" : "p-p1"}`} style={{ padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 700 }}>
                            {gt.priority.toUpperCase()}
                          </span>
                          {gt.reviewStatus === "OK" && (
                            <span style={{ background: "rgba(34, 197, 94, 0.2)", color: "#4ADE80", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 700 }}>
                              ✓ OK
                            </span>
                          )}
                          {gt.reviewStatus === "CORRECTION_NEEDED" && (
                            <span style={{ background: "rgba(245, 158, 11, 0.2)", color: "#F59E0B", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 700 }}>
                              ↩ Correction Needed
                            </span>
                          )}
                          {(!gt.reviewStatus || gt.reviewStatus === "PENDING_REVIEW") && (
                            <span style={{ background: "rgba(148, 163, 184, 0.15)", color: "#94A3B8", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 600 }}>
                              ⏳ Pending Review
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--text)", marginBottom: "4px" }}>{gt.title}</div>
                        {gt.desc && <div style={{ fontSize: "11.5px", color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{gt.desc}</div>}
                      </div>

                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: "11.5px", color: isOverdue ? "#FF6B6B" : "var(--muted)", fontWeight: isOverdue ? 700 : 500 }}>
                          📅 {isOverdue ? "Overdue: " : "Due: "}{gt.due}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTaskGroup(null);
                            setSelectedTask(gt);
                          }}
                          style={{
                            background: "transparent",
                            border: 0,
                            color: "var(--neon)",
                            fontWeight: 700,
                            fontSize: "11.5px",
                            cursor: "pointer",
                            marginTop: "6px",
                            padding: 0,
                          }}
                        >
                          Manage Details ➔
                        </button>
                      </div>
                    </div>

                    {/* DIRECT ROW ACTIONS: STATUS, REVIEWER CHECK & DELETE */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingTop: "8px", borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
                      {/* Status Selector */}
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>Status:</span>
                        <select
                          value={gt.status === "backlog" ? "Backlog" : (gt.rawStatus || "Assigned")}
                          disabled={!canUserChangeTaskStatus(gt) || isUpdatingStatus}

                          onChange={async (e) => {
                            const newWorkStatus = e.target.value as WorkStatus;
                            e.target.blur();
                            if (!canUserChangeTaskStatus(gt) || isUpdatingStatus) return;
                            await handleWorkStatusChange(gt.id, newWorkStatus);
                            setSelectedTaskGroup((prev) => {
                              if (!prev) return null;
                              const kanbanStatusMap: Record<string, TaskItem["status"]> = {
                                Backlog: "backlog",
                                Assigned: "assigned",
                                Pending: "assigned",
                                "In Progress": "progress",
                                Ongoing: "progress",
                                Blocked: "progress",
                                "In Review": "review",
                                "Changes Requested": "progress",
                                Rejected: "assigned",
                                Approved: "approved",
                                Completed: "published",
                                Published: "published",
                              };
                              const targetKanbanStatus = kanbanStatusMap[newWorkStatus] || "progress";
                              return {
                                ...prev,
                                tasks: prev.tasks.map((t) => (t.id === gt.id ? { ...t, rawStatus: newWorkStatus, status: targetKanbanStatus, is_backlog: false } : t)),
                              };
                            });


                          }}
                          className="fs"
                          style={{
                            padding: "3px 8px",
                            fontSize: "11px",
                            color: "var(--text)",
                            background: "#ffffff",
                            border: "1px solid #dad7ce",
                            borderRadius: "4px",
                            fontWeight: 600,
                            cursor: canUserChangeTaskStatus(gt) ? "pointer" : "not-allowed",
                            opacity: canUserChangeTaskStatus(gt) ? 1 : 0.6,
                          }}
                        >
                          {ALL_WORK_STATUSES.map((st) => {
                            const isBacklog = st.id === "Backlog";
                            const isReviewerOnly = st.isReviewerOnly;
                            const isAllowed = !isBacklog && canUserChangeTaskStatus(gt) && (!isReviewerOnly || isReviewerOrManager(gt));
                            return (
                              <option key={st.id} value={st.id} disabled={!isAllowed} style={{ background: "#ffffff", color: isAllowed ? "#1a1b1e" : "#8a8e99" }}>
                                {st.name} {isBacklog ? "(Auto Overdue)" : isReviewerOnly && !isReviewerOrManager(gt) ? "🔒" : ""}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* Reviewer Check Selector */}
                      {isReviewerOrManager(gt) && onReviewCheck && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>Reviewer Check:</span>
                          <select
                            value={pendingCorrectionTaskId === gt.id ? "CORRECTION_NEEDED" : (gt.reviewStatus || "PENDING_REVIEW")}
                            onChange={async (e) => {
                              const newRev = e.target.value as "PENDING_REVIEW" | "OK" | "CORRECTION_NEEDED";
                              e.target.blur();
                              if (newRev === "CORRECTION_NEEDED") {
                                setPendingCorrectionTaskId(gt.id);
                                setPendingCorrectionNote(gt.reviewNote || "");
                              } else {
                                if (pendingCorrectionTaskId === gt.id) setPendingCorrectionTaskId(null);
                                await onReviewCheck(Number(gt.id), newRev, "");
                                setSelectedTaskGroup((prev) => {
                                  if (!prev) return null;
                                  return {
                                    ...prev,
                                    tasks: prev.tasks.map((t) => (t.id === gt.id ? { ...t, reviewStatus: newRev, reviewNote: "" } : t)),
                                  };
                                });
                              }
                            }}
                            className="fs"
                            style={{
                              padding: "3px 8px",
                              fontSize: "11px",
                              color: (pendingCorrectionTaskId === gt.id || gt.reviewStatus === "CORRECTION_NEEDED") ? "#F59E0B" : gt.reviewStatus === "OK" ? "var(--goldD)" : "#94A3B8",
                              background: "#ffffff",
                              border: "1px solid #dad7ce",
                              borderRadius: "4px",
                              fontWeight: 600,
                            }}
                          >
                            <option value="PENDING_REVIEW" style={{ background: "#ffffff", color: "#1a1b1e" }}>⏳ Pending Review</option>
                            <option value="OK" style={{ background: "#ffffff", color: "#1a1b1e" }}>✓ OK / Approved</option>
                            <option value="CORRECTION_NEEDED" style={{ background: "#ffffff", color: "#1a1b1e" }}>↩ Correction Needed</option>
                          </select>
                        </div>
                      )}

                      {/* Delete Task Button */}
                      {canManageAll && onDeleteWork && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm(`Delete task "${gt.title}"?`)) {
                              const ok = await onDeleteWork(Number(gt.id));
                              if (ok) {
                                setTasks((prev) => prev.filter((t) => t.id !== gt.id));
                                setSelectedTaskGroup((prev) => {
                                  if (!prev) return null;
                                  const updatedTasks = prev.tasks.filter((t) => t.id !== gt.id);
                                  if (updatedTasks.length === 0) return null;
                                  return { ...prev, tasks: updatedTasks };
                                });
                              }
                            }
                          }}
                          style={{
                            marginLeft: "auto",
                            background: "rgba(239, 68, 68, 0.12)",
                            color: "#EF4444",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            padding: "3px 10px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          <Trash2 size={12} />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>

                    {/* PENDING CORRECTION INPUT BOX WITH SAVE & CLOSE BUTTONS */}
                    {pendingCorrectionTaskId === gt.id && (
                      <div style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.35)", borderRadius: "6px", padding: "10px 12px", marginTop: "6px", display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "#F59E0B", letterSpacing: "0.04em", textTransform: "uppercase", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span>↩ ADD CORRECTION DETAILS</span>
                          <button
                            type="button"
                            onClick={() => {
                              setPendingCorrectionTaskId(null);
                              setPendingCorrectionNote("");
                            }}
                            style={{ background: "transparent", border: 0, color: "var(--muted)", fontSize: "14px", fontWeight: 700, cursor: "pointer", padding: "0 4px" }}
                            title="Close / Cancel correction"
                          >
                            ✕
                          </button>
                        </div>

                        <input
                          type="text"
                          autoFocus
                          value={pendingCorrectionNote}
                          placeholder="Type required correction details for assigned employee..."
                          onChange={(e) => setPendingCorrectionNote(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === "Enter" && pendingCorrectionNote.trim()) {
                              e.preventDefault();
                              const noteToSave = pendingCorrectionNote.trim();
                              if (!onReviewCheck) return;
                              await onReviewCheck(Number(gt.id), "CORRECTION_NEEDED", noteToSave);
                              setSelectedTaskGroup((prev) => {
                                if (!prev) return null;
                                return {
                                  ...prev,
                                  tasks: prev.tasks.map((t) => (t.id === gt.id ? { ...t, reviewStatus: "CORRECTION_NEEDED", reviewNote: noteToSave } : t)),
                                };
                              });
                              setPendingCorrectionTaskId(null);
                              setPendingCorrectionNote("");
                            }
                          }}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            borderRadius: "4px",
                            background: "var(--panel)",
                            border: "1px solid rgba(245, 158, 11, 0.5)",
                            color: "var(--text)",
                            fontSize: "12px",
                            outline: "none",
                          }}
                        />

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setPendingCorrectionTaskId(null);
                              setPendingCorrectionNote("");
                            }}
                            style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--muted)", padding: "4px 12px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
                          >
                            Close
                          </button>

                          <button
                            type="button"
                            disabled={!pendingCorrectionNote.trim()}
                            onClick={async () => {
                              const noteToSave = pendingCorrectionNote.trim();
                              if (!noteToSave || !onReviewCheck) return;
                              await onReviewCheck(Number(gt.id), "CORRECTION_NEEDED", noteToSave);
                              setSelectedTaskGroup((prev) => {
                                if (!prev) return null;
                                return {
                                  ...prev,
                                  tasks: prev.tasks.map((t) => (t.id === gt.id ? { ...t, reviewStatus: "CORRECTION_NEEDED", reviewNote: noteToSave } : t)),
                                };
                              });
                              setPendingCorrectionTaskId(null);
                              setPendingCorrectionNote("");
                            }}
                            style={{
                              background: "#F59E0B",
                              color: "#000",
                              border: "none",
                              padding: "4px 14px",
                              borderRadius: "4px",
                              fontSize: "11px",
                              fontWeight: 700,
                              cursor: "pointer",
                              opacity: pendingCorrectionNote.trim() ? 1 : 0.5,
                            }}
                          >
                            Save Correction ✓
                          </button>
                        </div>
                      </div>
                    )}

                    {/* SAVED CORRECTION DISPLAY */}
                    {gt.reviewStatus === "CORRECTION_NEEDED" && pendingCorrectionTaskId !== gt.id && (
                      <div style={{ background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.28)", borderRadius: "6px", padding: "10px 12px", marginTop: "4px", display: "flex", flexDirection: "column", gap: "4px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#F59E0B", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                            ↩ CORRECTION DETAILS
                          </span>
                          {isReviewerOrManager(gt) && (
                            <button
                              type="button"
                              onClick={() => {
                                setPendingCorrectionTaskId(gt.id);
                                setPendingCorrectionNote(gt.reviewNote || "");
                              }}
                              style={{ background: "transparent", border: 0, color: "#F59E0B", fontSize: "11px", fontWeight: 700, cursor: "pointer", textDecoration: "underline", padding: 0 }}
                            >
                              Edit Note ✏️
                            </button>
                          )}
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--text)", fontStyle: "italic", lineHeight: "1.4" }}>
                          "{gt.reviewNote || "Correction requested."}"
                        </div>
                      </div>
                    )}



                  </div>

                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
              <button
                type="button"
                className="secondary-button"
                style={{ height: "38px" }}
                onClick={() => setSelectedTaskGroup(null)}
              >
                Close Batch View
              </button>
            </div>
          </div>
        </Modal>
      )}



    </div>
  );
}
