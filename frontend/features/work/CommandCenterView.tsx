"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
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
  Globe,
  List,
  Table,
  Play,
  Pause,
  Eye,
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

function formatTimeSpent(totalSeconds: number, activeTimer?: { started_at: string } | null, nowMs?: number): string {
  let seconds = totalSeconds || 0;
  if (activeTimer && activeTimer.started_at) {
    const startedMs = new Date(activeTimer.started_at).getTime();
    const currentMs = nowMs || Date.now();
    const diffSec = Math.max(0, Math.floor((currentMs - startedMs) / 1000));
    seconds += diffSec;
  }

  if (seconds <= 0) return "00m 00s";

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const pad = (n: number) => String(n).padStart(2, "0");

  if (hrs > 0) {
    return `${hrs}h ${pad(mins)}m ${pad(secs)}s`;
  }
  return `${pad(mins)}m ${pad(secs)}s`;
}

export interface TaskItem {
  id: string;
  code: string;
  title: string;
  desc?: string;
  type: string;
  phase: string;
  assignee: string;
  assigneeId?: number | null;
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
  parentTask?: string;
  parentTaskTitle?: string;
  isMasterClientTask?: boolean;
  assignedQuantity?: number;
  completedQuantity?: number;
  unit?: string;
  totalTimeSpentSeconds?: number;
  activeTimer?: { started_at: string; started_by?: number | null } | null;
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

export function getPriorityBadgeStyle(priority: string) {
  const p = (priority || "").toLowerCase();
  if (p === "p0" || p === "critical" || p === "urgent") {
    return {
      background: "rgba(239, 68, 68, 0.12)",
      color: "#DC2626",
      border: "1px solid rgba(239, 68, 68, 0.3)",
      padding: "3px 8px",
      borderRadius: "6px",
      fontSize: "11px",
      fontWeight: 800 as const,
    };
  }
  if (p === "p1" || p === "high") {
    return {
      background: "rgba(245, 158, 11, 0.12)",
      color: "#D97706",
      border: "1px solid rgba(245, 158, 11, 0.3)",
      padding: "3px 8px",
      borderRadius: "6px",
      fontSize: "11px",
      fontWeight: 800 as const,
    };
  }
  if (p === "p2" || p === "normal") {
    return {
      background: "rgba(37, 99, 235, 0.12)",
      color: "#2563EB",
      border: "1px solid rgba(37, 99, 235, 0.3)",
      padding: "3px 8px",
      borderRadius: "6px",
      fontSize: "11px",
      fontWeight: 800 as const,
    };
  }
  return {
    background: "rgba(100, 116, 139, 0.12)",
    color: "#475569",
    border: "1px solid rgba(100, 116, 139, 0.28)",
    padding: "3px 8px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: 800 as const,
  };
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
  onEditWork,
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
  onEditWork?: (assignment: WorkAssignment) => void;
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
    if ((currentUser as any)?.is_superuser) return true;
    const roleUpper = (currentUser?.role || userRole || "").toUpperCase();
    if (["SUPER_ADMIN", "ADMIN", "HR", "OPERATIONS_HEAD", "TEAM_LEAD", "BDE"].includes(roleUpper) || roleUpper.endsWith("_TEAM_LEAD") || roleUpper.endsWith("TEAM_LEAD") || roleUpper.includes("LEAD")) {
      return true;
    }
    const workPerms = (currentUser as any)?.permissions?.WORK_BOARD || (currentUser as any)?.permissions?.["*"];
    if (workPerms?.can_edit || workPerms?.can_create) return true;

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
    return isReviewerOrManager(task) || isAssignedToCurrentUser(task);
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
    if (!assignments || assignments.length === 0) {
      setTasks([]);
      return;
    }
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
          assigneeId: a.employee,
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
          parentTask: a.parent_task ? String(a.parent_task) : undefined,
          parentTaskTitle: a.parent_task_title || "",
          isMasterClientTask: Boolean(a.is_master_client_task),
          assignedQuantity: a.assigned_quantity || 1,
          completedQuantity: a.completed_quantity || 0,
          unit: a.unit || "tasks",
          totalTimeSpentSeconds: a.total_time_spent_seconds || 0,
          activeTimer: a.active_timer || null,
        };
      });
      setTasks(converted);
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

  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [timerLoadingId, setTimerLoadingId] = useState<string | null>(null);
  const [kanbanDisplayMode, setKanbanDisplayMode] = useState<"board" | "stack">("board");

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isAssignedToCurrentUser = useCallback((t: TaskItem): boolean => {
    if (!currentUser) return false;
    const currentEmpId = currentUser.employeeId ? String(currentUser.employeeId) : null;
    const currentUserId = currentUser.id ? String(currentUser.id) : null;
    const currentName = (currentUser.name || currentUser.username || "").toLowerCase().trim();

    if (currentEmpId && t.assigneeId && String(t.assigneeId) === currentEmpId) return true;
    if (currentUserId && t.assigneeId && String(t.assigneeId) === currentUserId) return true;
    if (currentName && t.assigneeName && t.assigneeName.toLowerCase().trim() === currentName) return true;
    if (currentName && t.assignee && t.assignee.toLowerCase().trim() === currentName) return true;
    return false;
  }, [currentUser]);

  const handleStartTaskTimer = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    const targetTask = tasks.find((t) => String(t.id) === String(taskId));
    const isSuper = (currentUser as any)?.is_superuser || (userRole || "").toUpperCase() === "SUPER_ADMIN";
    if (targetTask && !isAssignedToCurrentUser(targetTask) && !isSuper) {
      alert("You can only start the timer for tasks assigned to you.");
      return;
    }
    if (timerLoadingId) return;
    setTimerLoadingId(taskId);
    try {
      await api(`/work-assignments/${taskId}/start-timer/`, { method: "POST" });
      if (onStatusChange) {
        onStatusChange(Number(taskId), "In Progress");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not start task timer.");
    } finally {
      setTimerLoadingId(null);
    }
  };

  const handleStopTaskTimer = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    if (timerLoadingId) return;
    setTimerLoadingId(taskId);
    try {
      await api(`/work-assignments/${taskId}/stop-timer/`, { method: "POST" });
      if (onStatusChange) {
        onStatusChange(Number(taskId), "In Progress");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not stop task timer.");
    } finally {
      setTimerLoadingId(null);
    }
  };

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
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px", maxWidth: "100%", overflow: "hidden" }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", maxWidth: "100%" }}>
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
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(new CustomEvent("flumenx:open_share_client_modal", { detail: { clientId: selectedClientId, clientName: selectedClientName } }));
                      }
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      background: "#087A5B",
                      color: "#ffffff",
                      fontSize: "11px",
                      fontWeight: 700,
                      border: "1px solid #065F46",
                      cursor: "pointer",
                      boxShadow: "0 1px 3px rgba(8, 122, 91, 0.2)",
                    }}
                    title="Generate secure shareable public link for client"
                  >
                    <Globe size={12} /> Share Client Portal
                  </button>
                </div>
                <span style={{ fontSize: "14px", fontWeight: 800, color: "var(--primary-green)", fontFamily: "monospace" }}>
                  {Math.round(overallProgressPct)}%
                </span>
              </div>

              <div
                style={{
                  height: "7px",
                  width: "100%",
                  background: "var(--line)",
                  borderRadius: "99px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.max(0, Math.min(100, overallProgressPct))}%`,
                    background: "linear-gradient(90deg, #10B981 0%, #087A5B 100%)",
                    borderRadius: "99px",
                    transition: "width 0.4s ease",
                    boxShadow: "0 0 8px rgba(16, 185, 129, 0.35)",
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
                          <span style={{ fontSize: "10px", fontWeight: 700, color: hasWork ? "var(--primary-green)" : "var(--muted)", fontFamily: "monospace" }}>
                            {hasWork ? `${Math.round(pct)}%` : "No work"}
                          </span>
                        </div>
                        <div style={{ height: "4px", width: "100%", background: "var(--line)", borderRadius: "99px", overflow: "hidden" }}>
                          {hasWork ? (
                            <div
                              style={{
                                height: "100%",
                                width: `${Math.max(0, Math.min(100, pct))}%`,
                                background: "#10B981",
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
              <div style={{ display: "flex", gap: "6px", overflowX: "auto", flexWrap: "nowrap", WebkitOverflowScrolling: "touch", paddingBottom: "2px" }}>
                <button
                  type="button"
                  onClick={() => setSelectedTypeFilter("all")}
                  style={{
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                    padding: "5px 12px",
                    borderRadius: "8px",
                    fontSize: "11.5px",
                    fontWeight: 700,
                    background: selectedTypeFilter === "all" ? "var(--amber)" : "#FFFFFF",
                    color: selectedTypeFilter === "all" ? "#FFFFFF" : "var(--text)",
                    border: selectedTypeFilter === "all" ? "1px solid var(--amber)" : "1.5px solid var(--border)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  All Depts / Types
                </button>
                {dynamicDeptPills.map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setSelectedTypeFilter(pill.id)}
                    style={{
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                      padding: "5px 12px",
                      borderRadius: "8px",
                      fontSize: "11.5px",
                      fontWeight: 700,
                      background: selectedTypeFilter === pill.id ? "var(--amber)" : "#FFFFFF",
                      color: selectedTypeFilter === pill.id ? "#FFFFFF" : "var(--text)",
                      border: selectedTypeFilter === pill.id ? "1px solid var(--amber)" : "1.5px solid var(--border)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
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
                  style={{ width: "auto", minWidth: "128px", background: "#FFFFFF", color: "var(--text)", border: "1.5px solid var(--border)", fontWeight: 700, fontSize: "12px", borderRadius: "8px" }}
                >
                  <option value="all" style={{ background: "#FFFFFF", color: "var(--text)" }}>All Members</option>
                  {dynamicMembers.map((m) => (
                    <option key={m.id} value={m.id} style={{ background: "#FFFFFF", color: "var(--text)" }}>{m.name}</option>
                  ))}
                </select>


                <select
                  className="fs"
                  value={selectedPriorityFilter}
                  onChange={(e) => setSelectedPriorityFilter(e.target.value)}
                  style={{ width: "auto", minWidth: "126px", background: "#FFFFFF", color: "var(--text)", border: "1.5px solid var(--border)", fontWeight: 700, fontSize: "12px", borderRadius: "8px" }}
                >
                  <option value="all" style={{ background: "#FFFFFF", color: "var(--text)" }}>All Priorities</option>
                  <option value="p0" style={{ background: "#FFFFFF", color: "var(--text)" }}>P0 Critical</option>
                  <option value="p1" style={{ background: "#FFFFFF", color: "var(--text)" }}>P1 High</option>
                  <option value="p2" style={{ background: "#FFFFFF", color: "var(--text)" }}>P2 Normal</option>
                </select>

              </div>
            </div>

            {/* Status Pills */}
            <div style={{ display: "flex", gap: "8px", overflowX: "auto", flexWrap: "nowrap", WebkitOverflowScrolling: "touch", paddingTop: "10px", borderTop: "1px solid var(--border)", paddingBottom: "4px" }}>
              <button
                type="button"
                onClick={() => setStatusPillFilter("all")}
                style={{
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                  padding: "5px 14px",
                  borderRadius: "99px",
                  fontSize: "12px",
                  fontWeight: 800,
                  background: statusPillFilter === "all" ? "var(--amber)" : "#FFFFFF",
                  color: statusPillFilter === "all" ? "#FFFFFF" : "var(--text)",
                  border: statusPillFilter === "all" ? "1px solid var(--amber)" : "1.5px solid var(--border)",
                  boxShadow: statusPillFilter === "all" ? "0 2px 6px rgba(8,122,91,0.2)" : "none",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                All Board ({filteredTasks.length})
              </button>
              {STATUSES.map((st) => {
                const count = tasks.filter((t) => t.status === st.id).length;
                const isActive = statusPillFilter === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStatusPillFilter(st.id)}
                    style={{
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                      padding: "5px 14px",
                      borderRadius: "99px",
                      fontSize: "12px",
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      gap: "7px",
                      background: isActive ? "var(--amber)" : "#FFFFFF",
                      color: isActive ? "#FFFFFF" : "var(--text)",
                      border: isActive ? "1px solid var(--amber)" : "1.5px solid var(--border)",
                      boxShadow: isActive ? "0 2px 6px rgba(8,122,91,0.2)" : "none",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: isActive ? "#FFFFFF" : st.color, flexShrink: 0 }} />
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

          {/* View Mode Toggle Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap", margin: "4px 0 2px 0" }}>
            <div style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--muted)" }}>
              Showing <b style={{ color: "var(--text)" }}>{filteredTasks.length}</b> {filteredTasks.length === 1 ? "task" : "tasks"}
            </div>
            <div style={{ display: "inline-flex", background: "var(--panel)", padding: "3px", borderRadius: "8px", border: "1.5px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <button
                type="button"
                onClick={() => setKanbanDisplayMode("board")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 12px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 700,
                  background: kanbanDisplayMode === "board" ? "var(--amber)" : "transparent",
                  color: kanbanDisplayMode === "board" ? "#FFFFFF" : "var(--muted)",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <Kanban size={13} />
                <span>Kanban Columns</span>
              </button>
              <button
                type="button"
                onClick={() => setKanbanDisplayMode("stack")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 12px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 700,
                  background: kanbanDisplayMode === "stack" ? "var(--amber)" : "transparent",
                  color: kanbanDisplayMode === "stack" ? "#FFFFFF" : "var(--muted)",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <Table size={13} />
                <span>Stacked Table (Mobile Friendly)</span>
              </button>
            </div>
          </div>

          {/* STACKED TABLE VIEW (MOBILE & COMPACT) */}
          {kanbanDisplayMode === "stack" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {filteredTasks.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 16px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "12px", color: "var(--muted)" }}>
                  <p style={{ fontWeight: 700, fontSize: "14px", margin: "0 0 4px 0" }}>No tasks match your current filters</p>
                  <p style={{ fontSize: "12px", margin: 0 }}>Try adjusting or resetting your department, priority, or search filter.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {filteredTasks.map((t) => {
                    const isOverdue = isDateStrictlyPast(t.due);
                    const canonKey = normalizeDepartment(t.type);
                    const typeInfo = CANONICAL_DEPARTMENTS[canonKey] || { label: t.type, badge: t.type, color: "var(--amber)" };
                    const colInfo = STATUSES.find((s) => s.id === t.status) || STATUSES[0];
                    const isTimerActive = Boolean(t.activeTimer && t.activeTimer.started_at);
                    const timeFormatted = formatTimeSpent(t.totalTimeSpentSeconds || 0, t.activeTimer, nowMs);

                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTask(t)}
                        style={{
                          background: "var(--panel)",
                          border: isTimerActive ? "2px solid #10B981" : isOverdue ? "1.5px solid rgba(239, 68, 68, 0.45)" : "1px solid var(--border)",
                          borderRadius: "12px",
                          padding: "14px 16px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                          cursor: "pointer",
                          boxShadow: isTimerActive ? "0 0 12px rgba(16, 185, 129, 0.18)" : "var(--shadow-sm)",
                          transition: "all 0.2s ease",
                        }}
                      >
                        {/* Top Header: Chips & Status Dropdown */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                            {t.clientName && (
                              <span style={{ background: "rgba(59, 130, 246, 0.12)", color: "#2563eb", border: "1px solid rgba(59, 130, 246, 0.3)", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 800 }}>
                                🏢 {t.clientName}
                              </span>
                            )}
                            <span style={{ background: "var(--soft-brand-bg)", color: "var(--amber)", border: "1px solid rgba(8, 122, 91, 0.25)", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 800, textTransform: "uppercase" }}>
                              {typeInfo.label}
                            </span>
                            <span style={getPriorityBadgeStyle(t.priority)}>
                              {(t.priority || "NORMAL").toUpperCase()}
                            </span>
                            {t.reviewStatus === "OK" && (
                              <span style={{ background: "rgba(22, 133, 91, 0.1)", color: "var(--green)", border: "1px solid rgba(22, 133, 91, 0.25)", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 800 }}>
                                ✓ OK
                              </span>
                            )}
                            {t.reviewStatus === "CORRECTION_NEEDED" && (
                              <span style={{ background: "rgba(200, 75, 75, 0.1)", color: "var(--red)", border: "1px solid rgba(200, 75, 75, 0.25)", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 800 }}>
                                ↩ Correction Needed
                              </span>
                            )}
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }} onClick={(e) => e.stopPropagation()}>
                            {/* Status Selector Dropdown */}
                            <select
                              value={t.status === "backlog" ? "Backlog" : (t.rawStatus || "Assigned")}
                              disabled={!canUserChangeTaskStatus(t) || isUpdatingStatus}
                              onChange={async (e) => {
                                e.stopPropagation();
                                const newWorkStatus = e.target.value as WorkStatus;
                                if (!canUserChangeTaskStatus(t) || isUpdatingStatus) return;
                                await handleWorkStatusChange(t.id, newWorkStatus);
                              }}
                              style={{
                                padding: "4px 10px",
                                borderRadius: "6px",
                                fontSize: "11.5px",
                                fontWeight: 800,
                                background: colInfo.color,
                                color: "#FFFFFF",
                                border: "none",
                                cursor: canUserChangeTaskStatus(t) ? "pointer" : "not-allowed",
                                outline: "none",
                                opacity: canUserChangeTaskStatus(t) ? 1 : 0.7,
                              }}
                            >
                              {t.status === "backlog" && <option value="Backlog">Backlog (Overdue)</option>}
                              {ALL_WORK_STATUSES.map((st) => (
                                <option key={st.id} value={st.id} style={{ background: "#FFFFFF", color: "var(--text)" }}>
                                  {st.name}
                                </option>
                              ))}
                            </select>

                            <span style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "monospace", fontWeight: 700 }}>
                              {t.code}
                            </span>
                          </div>
                        </div>

                        {/* Title & Description */}
                        <div>
                          <div style={{ fontWeight: 800, fontSize: "15px", color: "var(--text)", lineHeight: "1.35", marginBottom: t.desc ? "4px" : "0" }}>
                            {t.title}
                          </div>
                          {t.desc && (
                            <div style={{ fontSize: "12.5px", color: "var(--muted)", lineHeight: "1.4" }}>
                              {t.desc}
                            </div>
                          )}
                        </div>

                        {/* Bottom Row: Metadata & Actions */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", paddingTop: "8px", borderTop: "1px solid var(--line)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", fontSize: "12px" }}>
                            {/* Assignee */}
                            <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--text)", fontWeight: 600 }}>
                              <span style={{ color: "var(--muted)", fontSize: "11px" }}>👤</span>
                              <span>{t.assigneeName || "Unassigned"}</span>
                            </div>

                            {/* Due Date */}
                            <div style={{ display: "flex", alignItems: "center", gap: "4px", color: isOverdue ? "var(--red)" : "var(--muted)", fontWeight: isOverdue ? 800 : 600 }}>
                              <Clock size={13} />
                              <span>{t.due || "No date"}</span>
                              {isOverdue && <span style={{ fontSize: "10px", background: "rgba(239, 68, 68, 0.15)", color: "var(--red)", padding: "1px 5px", borderRadius: "4px", fontWeight: 800 }}>OVERDUE</span>}
                            </div>

                            {/* Quantity progress */}
                            {t.assignedQuantity !== undefined && (
                              <div style={{ fontSize: "11.5px", color: "var(--muted)", fontWeight: 600 }}>
                                Units: <b style={{ color: "var(--text)" }}>{t.completedQuantity || 0}</b> / {t.assignedQuantity} {t.unit || "tasks"}
                              </div>
                            )}
                          </div>

                          {/* Right Controls: Timer & Edit */}
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }} onClick={(e) => e.stopPropagation()}>
                            {/* Timer widget */}
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", background: isTimerActive ? "rgba(16, 185, 129, 0.12)" : "var(--panel2)", border: `1px solid ${isTimerActive ? "rgba(16, 185, 129, 0.3)" : "var(--border)"}`, borderRadius: "8px", padding: "4px 8px" }}>
                              <span style={{ fontSize: "11.5px", fontFamily: "monospace", fontWeight: 700, color: isTimerActive ? "#10B981" : "var(--text)" }}>
                                {timeFormatted}
                              </span>
                              {(isAssignedToCurrentUser(t) || (currentUser as any)?.is_superuser || (userRole || "").toUpperCase() === "SUPER_ADMIN") ? (
                                isTimerActive ? (
                                  <button
                                    type="button"
                                    onClick={(e) => handleStopTaskTimer(e, t.id)}
                                    style={{ background: "#EF4444", border: "none", color: "#FFF", borderRadius: "6px", width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                                    title="Stop task timer"
                                  >
                                    <Pause size={12} />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => handleStartTaskTimer(e, t.id)}
                                    style={{ background: "#10B981", border: "none", color: "#FFF", borderRadius: "6px", width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                                    title="Start task timer"
                                  >
                                    <Play size={12} />
                                  </button>
                                )
                              ) : (
                                isTimerActive ? (
                                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#EF4444", display: "inline-block", animation: "pulse 1.5s infinite" }} title={`Active timer running by ${t.assigneeName || 'assignee'}`} />
                                ) : null
                              )}
                            </div>

                            {/* Edit Button */}
                            {onEditWork && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const rawWa = assignments.find((a) => String(a.id) === String(t.id));
                                  if (rawWa) onEditWork(rawWa);
                                }}
                                style={{
                                  background: "var(--panel2)",
                                  border: "1px solid var(--border)",
                                  color: "var(--text)",
                                  padding: "4px 8px",
                                  borderRadius: "6px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                                title="Edit task details"
                              >
                                <Pencil size={12} />
                                <span>Edit</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* 6 Kanban Columns Grid */
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

                        return colTasks.map((t) => {
                          const isOverdue = isDateStrictlyPast(t.due);
                          const canonKey = normalizeDepartment(t.type);
                          const typeInfo = CANONICAL_DEPARTMENTS[canonKey] || { label: t.type, badge: t.type, color: "var(--amber)" };
                          return (
                            <div
                              key={t.id}
                              className="tcard"
                              onClick={() => setSelectedTask(t)}
                              style={{
                                padding: "16px",
                                background: "var(--panel)",
                                border: "1px solid var(--border)",
                                borderRadius: "12px",
                                cursor: "pointer",
                                marginBottom: "12px",
                                boxShadow: "var(--shadow-sm)",
                                transition: "all 0.2s ease",
                              }}
                            >
                              <div className="tc-top" style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px", flexWrap: "wrap" }}>
                                {t.clientName && (
                                  <span className="chip" style={{ background: "rgba(59, 130, 246, 0.12)", color: "#2563eb", border: "1px solid rgba(59, 130, 246, 0.3)", padding: "3px 9px", borderRadius: "6px", fontSize: "11px", fontWeight: 800 }}>
                                    🏢 {t.clientName}
                                  </span>
                                )}
                                <span className="chip" style={{ background: "var(--soft-brand-bg)", color: "var(--amber)", border: "1px solid rgba(8, 122, 91, 0.25)", padding: "3px 9px", borderRadius: "6px", fontSize: "11px", fontWeight: 800, textTransform: "uppercase" }}>
                                  {typeInfo.label}
                                </span>
                                <span className="chip" style={getPriorityBadgeStyle(t.priority)}>
                                  {(t.priority || "NORMAL").toUpperCase()}
                                </span>
                                {t.reviewStatus === "OK" && (
                                  <span style={{ background: "rgba(22, 133, 91, 0.1)", color: "var(--green)", border: "1px solid rgba(22, 133, 91, 0.25)", padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 800 }}>
                                    ✓ OK
                                  </span>
                                )}
                                {t.reviewStatus === "CORRECTION_NEEDED" && (
                                  <span style={{ background: "rgba(200, 75, 75, 0.1)", color: "var(--red)", border: "1px solid rgba(200, 75, 75, 0.25)", padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 800 }}>
                                    ↩ Correction Needed
                                  </span>
                                )}
                                {(!t.reviewStatus || t.reviewStatus === "PENDING_REVIEW") && (
                                  <span style={{ background: "rgba(201, 135, 23, 0.12)", color: "var(--warning)", border: "1px solid rgba(201, 135, 23, 0.3)", padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700 }}>
                                    ⏳ Pending Review
                                  </span>
                                )}
                                <span className="tc-code" title={t.code} style={{ marginLeft: "auto", fontSize: "10.5px", color: "var(--muted)", fontFamily: "monospace", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "110px", flexShrink: 1 }}>{t.code}</span>
                              </div>

                              <div className="tc-title" style={{ fontWeight: 800, fontSize: "15px", color: "var(--text)", marginBottom: "8px", lineHeight: "1.4" }}>{t.title}</div>
                              {t.desc && <div style={{ fontSize: "12.5px", color: "var(--muted)", marginBottom: "12px", lineHeight: "1.45" }}>{t.desc}</div>}

                              <div className="tc-assignee-info" style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "10px 12px", background: "var(--panel2)", border: "1px solid var(--line)", borderRadius: "8px", marginBottom: "12px" }} onClick={(e) => e.stopPropagation()}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px" }}>
                                  <span style={{ color: "var(--muted)", fontWeight: 600 }}>Assigned To:</span>
                                  {canManageAll ? (
                                    <select
                                      value={(members || []).find((m) => m.display_name === t.assigneeName || String(m.id) === String(t.assignee))?.id || ""}
                                      onChange={async (e) => {
                                        const newEmpId = e.target.value;
                                        const empObj = (members || []).find((m) => String(m.id) === newEmpId);
                                        const newEmpName = empObj ? empObj.display_name : "Unassigned";
                                        try {
                                          await api(`/work-assignments/${t.id}/`, {
                                            method: "PATCH",
                                            body: JSON.stringify({ employee: newEmpId || null }),
                                          });
                                          setTasks((prev) =>
                                            prev.map((task) =>
                                              task.id === t.id
                                                ? {
                                                    ...task,
                                                    assignee: newEmpId || "",
                                                    assigneeName: newEmpName,
                                                  }
                                                : task
                                            )
                                          );
                                        } catch (err: any) {
                                          alert(err.message || "Failed to reassign task");
                                        }
                                      }}
                                      style={{
                                        border: "1px solid var(--border)",
                                        borderRadius: "4px",
                                        padding: "2px 6px",
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        background: "var(--panel)",
                                        color: "var(--text)",
                                        maxWidth: "130px"
                                      }}
                                    >
                                      <option value="">Unassigned</option>
                                      {(members || []).map((m) => (
                                        <option key={m.id} value={m.id}>
                                          {m.display_name}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span style={{ fontWeight: 700, color: "var(--text)" }}>{t.assigneeName || "Unassigned"}</span>
                                  )}
                                </div>
                              </div>

                              <div className="tc-mid" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", marginBottom: "12px", fontSize: "11.5px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "4px", color: isOverdue ? "var(--red)" : "var(--muted)" }}>
                                  <Clock size={13} />
                                  <span style={{ fontWeight: isOverdue ? 800 : 600 }}>{t.due}</span>
                                </div>
                                <div style={{ fontWeight: 700, color: "var(--muted)" }}>{t.hours}h</div>
                              </div>

                              {t.assignedQuantity !== undefined && t.assignedQuantity > 1 && (
                                <div style={{ marginBottom: "12px" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", color: "var(--muted)", marginBottom: "4px" }}>
                                    <span>Quantity Progress</span>
                                    <span>{t.completedQuantity || 0} / {t.assignedQuantity} {t.unit || "tasks"}</span>
                                  </div>
                                  <div style={{ height: "4px", background: "var(--line)", borderRadius: "2px", overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: `${Math.min(100, Math.round(((t.completedQuantity || 0) / t.assignedQuantity) * 100))}%`, background: "var(--amber)", borderRadius: "2px" }} />
                                  </div>
                                </div>
                              )}

                              {/* Task Timer Widget */}
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: "8px",
                                  padding: "8px 10px",
                                  background: t.activeTimer ? "rgba(22, 133, 91, 0.12)" : "var(--panel2)",
                                  border: t.activeTimer ? "1px solid rgba(22, 133, 91, 0.35)" : "1px solid var(--line)",
                                  borderRadius: "8px",
                                  marginTop: "8px",
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <Clock size={13} color={t.activeTimer ? "var(--green)" : "var(--muted)"} />
                                  <span
                                    style={{
                                      fontFamily: "monospace",
                                      fontWeight: 800,
                                      fontSize: "11.5px",
                                      color: t.activeTimer ? "var(--green)" : "var(--text)",
                                    }}
                                  >
                                    {formatTimeSpent(t.totalTimeSpentSeconds || 0, t.activeTimer, nowMs)}
                                  </span>
                                </div>

                                {(isAssignedToCurrentUser(t) || (currentUser as any)?.is_superuser || (userRole || "").toUpperCase() === "SUPER_ADMIN") ? (
                                  t.activeTimer ? (
                                    <button
                                      type="button"
                                      onClick={(e) => handleStopTaskTimer(e, t.id)}
                                      disabled={timerLoadingId === t.id}
                                      style={{
                                        background: "var(--red)",
                                        color: "#ffffff",
                                        border: "none",
                                        padding: "4px 10px",
                                        borderRadius: "6px",
                                        fontSize: "11px",
                                        fontWeight: 800,
                                        cursor: "pointer",
                                      }}
                                    >
                                      ⏹ Stop Timer
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => handleStartTaskTimer(e, t.id)}
                                      disabled={timerLoadingId === t.id}
                                      style={{
                                        background: "var(--amber)",
                                        color: "#ffffff",
                                        border: "none",
                                        padding: "4px 10px",
                                        borderRadius: "6px",
                                        fontSize: "11px",
                                        fontWeight: 800,
                                        cursor: "pointer",
                                      }}
                                    >
                                      ▶ Start Timer
                                    </button>
                                  )
                                ) : (
                                  t.activeTimer ? (
                                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--red)", background: "rgba(239, 68, 68, 0.12)", padding: "3px 8px", borderRadius: "6px" }}>
                                      🔴 Active ({t.assigneeName || 'Assignee'})
                                    </span>
                                  ) : null
                                )}
                              </div>

                              <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>Status:</span>
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
                                     padding: "5px 12px",
                                     fontSize: "12.5px",
                                     color: t.status === "backlog" ? "var(--red)" : "var(--text)",
                                     background: t.status === "backlog" ? "rgba(200,75,75,0.08)" : "var(--panel)",
                                     border: t.status === "backlog" ? "1px solid rgba(200,75,75,0.3)" : "1px solid var(--border)",
                                     borderRadius: "8px",
                                     fontWeight: 700,
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

                                 {onEditWork && (
                                   <button
                                     type="button"
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       const rawWa = assignments.find((a) => String(a.id) === String(t.id));
                                       if (rawWa) onEditWork(rawWa);
                                     }}
                                     style={{
                                       background: "var(--panel2)",
                                       border: "1px solid var(--border)",
                                       color: "var(--text)",
                                       padding: "3px 8px",
                                       borderRadius: "6px",
                                       fontSize: "11px",
                                       fontWeight: 700,
                                       cursor: "pointer",
                                       display: "flex",
                                       alignItems: "center",
                                       gap: "4px",
                                       marginLeft: "auto",
                                     }}
                                   >
                                     <Pencil size={12} />
                                     <span>Edit</span>
                                   </button>
                                 )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>

                  </div>
                );
              })}
            </div>
          )}
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
              <div style={{ fontSize: "13px", fontFamily: "monospace", display: "flex", gap: "6px", alignItems: "center" }}>
                <span style={{ color: "var(--amber)", fontWeight: 800 }}>{selectedTask.code}</span>
              </div>

              {/* STATUS & PRIORITY CHIPS */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                <span className="chip" style={{ background: "var(--soft-brand-bg)", color: "var(--amber)", border: "1px solid rgba(8, 122, 91, 0.25)", padding: "3px 9px", borderRadius: "6px", fontSize: "11px", fontWeight: 800, textTransform: "uppercase" }}>
                  {CANONICAL_DEPARTMENTS[normalizeDepartment(selectedTask.type)]?.label || selectedTask.type}
                </span>
                <span className="chip" style={getPriorityBadgeStyle(selectedTask.priority)}>
                  {(selectedTask.priority || "NORMAL").toUpperCase()}
                </span>
                <span style={{ background: "#13231F", color: "#FFFFFF", border: "1px solid #192D27", padding: "3px 9px", borderRadius: "6px", fontSize: "11px", fontWeight: 800, textTransform: "uppercase" }}>
                  {(selectedTask.status || "ASSIGNED").toUpperCase()}
                </span>
              </div>
            </div>

            {/* DESCRIPTION BOX */}
            {selectedTask.desc && (
              <div style={{ background: "var(--panel2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "14px 16px", fontSize: "13px", color: "var(--text)", lineHeight: "1.5", fontWeight: 500 }}>
                {selectedTask.desc}
              </div>
            )}

            {/* METADATA GRID (2 COLUMNS) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px 20px", fontSize: "12.5px", background: "var(--panel2)", border: "1px solid var(--border)", borderRadius: "10px", padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ color: "#64748B", fontWeight: 700 }}>Assigned to —</span>
                {canManageAll ? (
                  <select
                    value={selectedTask.assignee || ""}
                    onChange={async (e) => {
                      const newEmpId = e.target.value;
                      const empObj = (members || []).find((m) => String(m.id) === newEmpId);
                      const newEmpName = empObj ? empObj.display_name : "Unassigned";
                      try {
                        await api(`/work-assignments/${selectedTask.id}/`, {
                          method: "PATCH",
                          body: JSON.stringify({ employee: newEmpId || null }),
                        });
                        setSelectedTask((prev) => prev ? { ...prev, assignee: newEmpId, assigneeName: newEmpName } : null);
                        setTasks((prev) => prev.map((t) => (t.id === selectedTask.id ? { ...t, assignee: newEmpId, assigneeName: newEmpName } : t)));
                      } catch {
                        // fallback local update
                      }
                    }}
                    style={{
                      padding: "2px 6px",
                      fontSize: "12px",
                      fontWeight: 800,
                      color: "var(--text)",
                      background: "#FFFFFF",
                      border: "1px solid #CBD5E1",
                      borderRadius: "6px",
                    }}
                  >
                    <option value="">Unassigned</option>
                    {(members || []).map((m) => (
                      <option key={m.id} value={String(m.id)}>
                        {m.display_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <b style={{ color: "var(--text)", fontWeight: 800 }}>{selectedTask.assigneeName || "—"}</b>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ color: "#64748B", fontWeight: 700 }}>Estimated hours —</span>
                <b style={{ color: "var(--text)", fontWeight: 800 }}>{selectedTask.hours || 6}h</b>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ color: "#64748B", fontWeight: 700 }}>Reviewer —</span>
                <b style={{ color: "var(--text)", fontWeight: 800 }}>{selectedTask.reviewer || "—"}</b>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ color: "#64748B", fontWeight: 700 }}>Client —</span>
                <b style={{ color: "var(--amber)", fontWeight: 800 }}>{selectedTask.clientName || clients.find((c) => c.id === selectedTask.clientId)?.name || "—"}</b>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ color: "#64748B", fontWeight: 700 }}>Due date —</span>
                <b style={{ color: "var(--text)", fontWeight: 800 }}>{selectedTask.due || "—"}</b>
              </div>
            </div>

            {/* MOVE TO STATUS SECTION */}
            <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "10px", padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "6px" }}>
                <span style={{ fontSize: "11.5px", fontWeight: 800, letterSpacing: "0.06em", color: "var(--text)", textTransform: "uppercase" }}>
                  MOVE TO STATUS
                </span>
                {!canMoveSelectedTaskStatus && (
                  <span style={{ fontSize: "11.5px", color: "var(--amber)", fontWeight: 700 }}>
                    🔒 Restricted to designated Reviewer ({selectedTask.reviewer || "Reviewer"}) or Management
                  </span>
                )}
              </div>

              {statusError && (
                <div style={{ background: "rgba(200, 75, 75, 0.08)", color: "var(--red)", border: "1px solid rgba(200, 75, 75, 0.28)", padding: "8px 12px", borderRadius: "6px", fontSize: "12.5px", fontWeight: 700, marginBottom: "12px" }}>
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
                      fontSize: "12px",
                      fontWeight: 800,
                      background: "rgba(200, 75, 75, 0.1)",
                      color: "var(--red)",
                      border: "1px solid rgba(200, 75, 75, 0.3)",
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
                      fontSize: "12px",
                      fontWeight: 800,
                      background: "var(--amber)",
                      color: "#FFFFFF",
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
                        fontSize: "12px",
                        fontWeight: 800,
                        background: isCurrent ? "var(--amber)" : "#FFFFFF",
                        color: isCurrent ? "#FFFFFF" : "var(--text)",
                        border: isCurrent ? "1px solid var(--amber)" : "1.5px solid var(--border)",
                        boxShadow: isCurrent ? "0 2px 6px rgba(8,122,91,0.2)" : "none",
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
            <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "10px", padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", flexWrap: "wrap", gap: "6px" }}>
                <span style={{ fontSize: "11.5px", fontWeight: 800, letterSpacing: "0.06em", color: "var(--text)", textTransform: "uppercase" }}>
                  REVIEWER CHECK (QUALITY AUDIT)
                </span>
                <span style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  letterSpacing: "0.05em",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  textTransform: "uppercase",
                  background: selectedTask.reviewStatus === "OK" ? "rgba(22, 133, 91, 0.1)" : selectedTask.reviewStatus === "CORRECTION_NEEDED" ? "rgba(200, 75, 75, 0.1)" : "rgba(201, 135, 23, 0.12)",
                  color: selectedTask.reviewStatus === "OK" ? "var(--green)" : selectedTask.reviewStatus === "CORRECTION_NEEDED" ? "var(--red)" : "var(--warning)",
                  border: selectedTask.reviewStatus === "OK" ? "1px solid rgba(22, 133, 91, 0.25)" : selectedTask.reviewStatus === "CORRECTION_NEEDED" ? "1px solid rgba(200, 75, 75, 0.25)" : "1px solid rgba(201, 135, 23, 0.3)",
                }}>
                  {selectedTask.reviewStatus === "OK" ? "✓ OK" : selectedTask.reviewStatus === "CORRECTION_NEEDED" ? "↩ Correction Needed" : "⏳ Pending Review"}
                </span>
              </div>

              {selectedTask.reviewStatus === "CORRECTION_NEEDED" && (
                <div style={{ background: "rgba(200, 75, 75, 0.05)", border: "1px solid rgba(200, 75, 75, 0.2)", borderRadius: "8px", padding: "12px 14px", marginBottom: "14px" }}>
                  <div style={{ fontWeight: 800, color: "var(--red)", fontSize: "11px", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "4px" }}>
                    ↩ CORRECTION NEEDED
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--text)", marginBottom: "6px", lineHeight: "1.45", fontWeight: 500 }}>
                    "{selectedTask.reviewNote || "Correction requested."}"
                  </div>
                  <div style={{ fontSize: "11.5px", color: "var(--muted)", fontWeight: 600 }}>
                    Reviewed by <b style={{ color: "var(--red)", fontWeight: 800 }}>{selectedTask.reviewedByName || selectedTask.reviewer || "Reviewer"}</b> {selectedTask.reviewedAt ? `• ${new Date(selectedTask.reviewedAt).toLocaleString()}` : ""}
                  </div>
                </div>
              )}

              {selectedTask.reviewStatus === "OK" && (
                <div style={{ background: "rgba(22, 133, 91, 0.08)", border: "1px solid rgba(22, 133, 91, 0.25)", borderRadius: "8px", padding: "12px 14px", marginBottom: "14px", fontSize: "12.5px", color: "var(--green)", fontWeight: 600 }}>
                  ✓ Quality audit passed — Marked OK by <b style={{ fontWeight: 800 }}>{selectedTask.reviewedByName || selectedTask.reviewer || "Reviewer"}</b> {selectedTask.reviewedAt ? `on ${new Date(selectedTask.reviewedAt).toLocaleDateString()}` : ""}
                </div>
              )}

              {isReviewerOrManager(selectedTask) ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <label style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--text)", display: "block", marginBottom: "6px" }}>
                      REVIEWER NOTE / FEEDBACK
                    </label>
                    <textarea
                      rows={2}
                      value={reviewNoteInput}
                      onChange={(e) => setReviewNoteInput(e.target.value)}
                      placeholder="Type reviewer feedback or correction details..."
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "6px", background: "#FFFFFF", border: "1.5px solid #CBD5E1", color: "var(--text)", fontSize: "12.5px", fontWeight: 600, resize: "vertical" }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
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
                      style={{ flex: 1, minWidth: "130px", height: "40px", borderRadius: "6px", background: "var(--amber)", color: "#FFFFFF", fontWeight: 800, fontSize: "12.5px", border: "none", cursor: isSubmittingReview ? "not-allowed" : "pointer" }}
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
                      style={{ flex: 1, minWidth: "150px", height: "40px", borderRadius: "6px", background: "var(--red)", color: "#FFFFFF", border: "none", fontWeight: 800, fontSize: "12.5px", cursor: (isSubmittingReview || !reviewNoteInput.trim()) ? "not-allowed" : "pointer", opacity: reviewNoteInput.trim() ? 1 : 0.5 }}
                      title={!reviewNoteInput.trim() ? "A reviewer note is required to request corrections" : "Request Correction"}
                    >
                      ↩ Correction Needed
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: "12px", color: "var(--muted)", fontStyle: "italic", fontWeight: 500 }}>
                  Quality audit is managed by assigned Reviewer ({selectedTask.reviewer || "Reviewer"}) or Management.
                </div>
              )}

            </div>

            {/* FOOTER ACTIONS */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
              {canDeleteSelectedTask && (
                <button
                  type="button"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "#DC2626",
                    color: "#FFFFFF",
                    border: "1px solid #B91C1C",
                    padding: "0 18px",
                    height: "38px",
                    borderRadius: "8px",
                    fontWeight: 800,
                    fontSize: "12.5px",
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(220, 38, 38, 0.28)",
                    transition: "all 0.18s ease",
                  }}
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
                  <Trash2 size={14} />
                  <span>Delete Task</span>
                </button>
              )}
              <button
                type="button"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#FFFFFF",
                  color: "var(--text)",
                  border: "1.5px solid #CBD5E1",
                  padding: "0 18px",
                  height: "38px",
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "12.5px",
                  cursor: "pointer",
                  transition: "all 0.18s ease",
                }}
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", padding: "14px 18px", background: "var(--panel2)", border: "1px solid var(--border)", borderRadius: "10px" }}>
              <div>
                <div style={{ fontSize: "15px", fontWeight: 800, color: "var(--text)" }}>Client: {selectedTaskGroup.clientName}</div>
                <div style={{ fontSize: "12.5px", color: "var(--muted)", marginTop: "3px" }}>
                  Assigned To: <b style={{ color: "var(--text)", fontWeight: 700 }}>{selectedTaskGroup.assigneeName}</b> &nbsp;|&nbsp; Reviewer: <b style={{ color: "var(--text)", fontWeight: 700 }}>{selectedTaskGroup.reviewerName}</b>
                </div>
              </div>
              <span style={{ background: "#13231F", color: "#FFFFFF", border: "1px solid #192D27", padding: "4px 14px", borderRadius: "12px", fontSize: "12px", fontWeight: 800 }}>
                {selectedTaskGroup.tasks.length} Independent Tasks
              </span>
            </div>

            {/* TASK LIST */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "60vh", overflowY: "auto", paddingRight: "4px" }}>
              {selectedTaskGroup.tasks.map((gt, idx) => {
                const isOverdue = isDateStrictlyPast(gt.due);
                const canonKey = normalizeDepartment(gt.type);
                const typeInfo = CANONICAL_DEPARTMENTS[canonKey] || { label: gt.type, badge: gt.type, color: "var(--amber)" };
                return (
                  <div
                    key={gt.id}
                    style={{
                      padding: "16px",
                      background: "var(--panel)",
                      border: "1px solid var(--border)",
                      borderRadius: "10px",
                      boxShadow: "var(--shadow-sm)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "14px" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--muted)" }}>#{idx + 1}</span>
                          <span style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--muted)", fontWeight: 700 }}>{gt.code}</span>
                          <span className="chip" style={{ background: "var(--soft-brand-bg)", color: "var(--amber)", border: "1px solid rgba(8, 122, 91, 0.25)", padding: "3px 9px", borderRadius: "6px", fontSize: "11px", fontWeight: 800, textTransform: "uppercase" }}>
                            {typeInfo.label}
                          </span>
                          <span className="chip" style={getPriorityBadgeStyle(gt.priority)}>
                            {(gt.priority || "NORMAL").toUpperCase()}
                          </span>
                          {gt.reviewStatus === "OK" && (
                            <span style={{ background: "rgba(22, 133, 91, 0.1)", color: "var(--green)", border: "1px solid rgba(22, 133, 91, 0.25)", padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 800 }}>
                              ✓ OK
                            </span>
                          )}
                          {gt.reviewStatus === "CORRECTION_NEEDED" && (
                            <span style={{ background: "rgba(200, 75, 75, 0.1)", color: "var(--red)", border: "1px solid rgba(200, 75, 75, 0.25)", padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 800 }}>
                              ↩ Correction Needed
                            </span>
                          )}
                          {(!gt.reviewStatus || gt.reviewStatus === "PENDING_REVIEW") && (
                            <span style={{ background: "rgba(201, 135, 23, 0.12)", color: "var(--warning)", border: "1px solid rgba(201, 135, 23, 0.3)", padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700 }}>
                              ⏳ Pending Review
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "15px", fontWeight: 800, color: "var(--text)", marginBottom: "4px", lineHeight: "1.4" }}>{gt.title}</div>
                        {gt.desc && <div style={{ fontSize: "12.5px", color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{gt.desc}</div>}
                      </div>

                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: "12px", color: isOverdue ? "var(--red)" : "var(--muted)", fontWeight: isOverdue ? 800 : 600 }}>
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
                            color: "var(--amber)",
                            fontWeight: 800,
                            fontSize: "12px",
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
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", paddingTop: "10px", borderTop: "1px solid var(--line)", flexWrap: "wrap" }}>
                      {/* Status Selector */}
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>Status:</span>
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
                            padding: "4px 10px",
                            fontSize: "12px",
                            color: "var(--text)",
                            background: "var(--panel)",
                            border: "1px solid var(--border)",
                            borderRadius: "6px",
                            fontWeight: 700,
                            cursor: canUserChangeTaskStatus(gt) ? "pointer" : "not-allowed",
                            opacity: canUserChangeTaskStatus(gt) ? 1 : 0.6,
                          }}
                        >
                          {ALL_WORK_STATUSES.map((st) => {
                            const isBacklog = st.id === "Backlog";
                            const isReviewerOnly = st.isReviewerOnly;
                            const isAllowed = !isBacklog && canUserChangeTaskStatus(gt) && (!isReviewerOnly || isReviewerOrManager(gt));
                            return (
                              <option key={st.id} value={st.id} disabled={!isAllowed} style={{ background: "var(--panel)", color: isAllowed ? "var(--text)" : "var(--muted)" }}>
                                {st.name} {isBacklog ? "(Auto Overdue)" : isReviewerOnly && !isReviewerOrManager(gt) ? "🔒" : ""}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* Reviewer Check Selector */}
                      {isReviewerOrManager(gt) && onReviewCheck && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>Reviewer Check:</span>
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
                              padding: "4px 10px",
                              fontSize: "12px",
                              color: (pendingCorrectionTaskId === gt.id || gt.reviewStatus === "CORRECTION_NEEDED") ? "var(--red)" : gt.reviewStatus === "OK" ? "var(--green)" : "var(--muted)",
                              background: "var(--panel)",
                              border: "1px solid var(--border)",
                              borderRadius: "6px",
                              fontWeight: 700,
                            }}
                          >
                            <option value="PENDING_REVIEW" style={{ background: "var(--panel)", color: "var(--text)" }}>⏳ Pending Review</option>
                            <option value="OK" style={{ background: "var(--panel)", color: "var(--text)" }}>✓ OK / Approved</option>
                            <option value="CORRECTION_NEEDED" style={{ background: "var(--panel)", color: "var(--text)" }}>↩ Correction Needed</option>
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
                            background: "#DC2626",
                            color: "#FFFFFF",
                            border: "none",
                            padding: "4px 12px",
                            borderRadius: "6px",
                            fontSize: "11.5px",
                            fontWeight: 800,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            boxShadow: "0 2px 4px rgba(220, 38, 38, 0.2)",
                          }}
                        >
                          <Trash2 size={13} />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>

                    {/* PENDING CORRECTION INPUT BOX WITH SAVE & CLOSE BUTTONS */}
                    {pendingCorrectionTaskId === gt.id && (
                      <div style={{ background: "rgba(200, 75, 75, 0.05)", border: "1px solid rgba(200, 75, 75, 0.2)", borderRadius: "8px", padding: "12px 14px", marginTop: "6px", display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 800, color: "var(--red)", letterSpacing: "0.05em", textTransform: "uppercase", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
                            padding: "9px 12px",
                            borderRadius: "6px",
                            background: "var(--panel)",
                            border: "1px solid var(--border)",
                            color: "var(--text)",
                            fontSize: "12.5px",
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
                            style={{ background: "var(--panel2)", border: "1px solid var(--border)", color: "var(--text)", padding: "5px 12px", borderRadius: "6px", fontSize: "11.5px", fontWeight: 600, cursor: "pointer" }}
                          >
                            Cancel
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
                              background: "var(--red)",
                              color: "#FFFFFF",
                              border: "none",
                              padding: "5px 14px",
                              borderRadius: "6px",
                              fontSize: "11.5px",
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
                      <div style={{ background: "rgba(200, 75, 75, 0.05)", border: "1px solid rgba(200, 75, 75, 0.2)", borderRadius: "8px", padding: "10px 14px", marginTop: "4px", display: "flex", flexDirection: "column", gap: "4px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--red)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                            ↩ CORRECTION DETAILS
                          </span>
                          {isReviewerOrManager(gt) && (
                            <button
                              type="button"
                              onClick={() => {
                                setPendingCorrectionTaskId(gt.id);
                                setPendingCorrectionNote(gt.reviewNote || "");
                              }}
                              style={{ background: "transparent", border: 0, color: "var(--amber)", fontSize: "11px", fontWeight: 700, cursor: "pointer", textDecoration: "underline", padding: 0 }}
                            >
                              Edit Note ✏️
                            </button>
                          )}
                        </div>
                        <div style={{ fontSize: "12.5px", color: "var(--text)", fontWeight: 500, lineHeight: "1.45" }}>
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
