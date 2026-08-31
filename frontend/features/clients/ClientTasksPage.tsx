"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Filter,
  FolderOpen,
  Layers,
  LayoutGrid,
  List,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Tag,
  Upload,
  User,
  X,
  AlertTriangle,
  Flame,
  CheckSquare,
  Sparkles,
} from "lucide-react";
import { Shell } from "@/components/shell";
import { PageHeader, PrimaryButton, Badge } from "@/components/ui";
import { Modal } from "@/features/common/Modal";
import { api } from "@/lib/api";
import { toast } from "@/components/ToastContext";
import type { Client, WorkAssignment, WorkPriority, WorkStatus, WorkspaceRole } from "@/lib/types";

type ViewMode = "matrix" | "calendar" | "grouped" | "table";

type Props = {
  role?: WorkspaceRole;
};

const PRIORITY_ORDER: WorkPriority[] = ["Urgent", "High", "Normal", "Low"];

const PRIORITY_COLORS: Record<WorkPriority, { bg: string; border: string; text: string; dot: string }> = {
  Urgent: { bg: "rgba(239, 68, 68, 0.12)", border: "rgba(239, 68, 68, 0.35)", text: "#ef4444", dot: "#dc2626" },
  High: { bg: "rgba(249, 115, 22, 0.12)", border: "rgba(249, 115, 22, 0.35)", text: "#f97316", dot: "#ea580c" },
  Normal: { bg: "rgba(59, 130, 246, 0.12)", border: "rgba(59, 130, 246, 0.35)", text: "#3b82f6", dot: "#2563eb" },
  Low: { bg: "rgba(148, 163, 184, 0.12)", border: "rgba(148, 163, 184, 0.3)", text: "#64748b", dot: "#94a3b8" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Published": { bg: "rgba(16, 185, 129, 0.12)", text: "#10b981", border: "rgba(16, 185, 129, 0.3)" },
  "Completed": { bg: "rgba(16, 185, 129, 0.12)", text: "#10b981", border: "rgba(16, 185, 129, 0.3)" },
  "Approved": { bg: "rgba(16, 185, 129, 0.12)", text: "#10b981", border: "rgba(16, 185, 129, 0.3)" },
  "In Review": { bg: "rgba(245, 158, 11, 0.12)", text: "#f59e0b", border: "rgba(245, 158, 11, 0.3)" },
  "In Progress": { bg: "rgba(59, 130, 246, 0.12)", text: "#3b82f6", border: "rgba(59, 130, 246, 0.3)" },
  "Ongoing": { bg: "rgba(59, 130, 246, 0.12)", text: "#3b82f6", border: "rgba(59, 130, 246, 0.3)" },
  "Changes Requested": { bg: "rgba(239, 68, 68, 0.12)", text: "#ef4444", border: "rgba(239, 68, 68, 0.3)" },
  "Rejected": { bg: "rgba(239, 68, 68, 0.12)", text: "#ef4444", border: "rgba(239, 68, 68, 0.3)" },
  "Blocked": { bg: "rgba(239, 68, 68, 0.12)", text: "#ef4444", border: "rgba(239, 68, 68, 0.3)" },
  "Assigned": { bg: "rgba(148, 163, 184, 0.12)", text: "#94a3b8", border: "rgba(148, 163, 184, 0.25)" },
  "Backlog": { bg: "rgba(148, 163, 184, 0.12)", text: "#94a3b8", border: "rgba(148, 163, 184, 0.25)" },
};

export function ClientTasksPage({ role = "admin" }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [tasks, setTasks] = useState<WorkAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("matrix");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");

  // Calendar State
  const [calendarDate, setCalendarDate] = useState(() => new Date());

  // Task Details / Upload Modal
  const [detailTask, setDetailTask] = useState<WorkAssignment | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [attachmentName, setAttachmentName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Status updating state
  const [updatingTaskId, setUpdatingTaskId] = useState<string | number | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [clientsData, tasksData] = await Promise.all([
        api<any>("/clients/").catch(() => []),
        api<any>("/work-assignments/?is_master_client_task=all").catch(() => []),
      ]);

      const clientList = Array.isArray(clientsData) ? clientsData : clientsData?.results || [];
      const taskList = Array.isArray(tasksData) ? tasksData : tasksData?.results || [];

      setClients(clientList);
      setTasks(taskList);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load client tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchSearch =
        !searchQuery ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.employee_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.unit?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchClient =
        selectedClientId === "all" ||
        String(t.client) === String(selectedClientId) ||
        String((t as any).client_id) === String(selectedClientId);

      const matchPriority = selectedPriority === "all" || t.priority === selectedPriority;
      const matchStatus = selectedStatus === "all" || t.status === selectedStatus;
      const matchDept = selectedDepartment === "all" || t.department_category === selectedDepartment;

      return matchSearch && matchClient && matchPriority && matchStatus && matchDept;
    });
  }, [tasks, searchQuery, selectedClientId, selectedPriority, selectedStatus, selectedDepartment]);

  // Statistics
  const stats = useMemo(() => {
    const total = filteredTasks.length;
    const urgent = filteredTasks.filter((t) => t.priority === "Urgent").length;
    const high = filteredTasks.filter((t) => t.priority === "High").length;
    const inReview = filteredTasks.filter((t) => t.status === "In Review" || t.review_status === "PENDING_REVIEW").length;
    const completed = filteredTasks.filter((t) => t.status === "Completed" || t.status === "Published").length;
    const totalAssignedQty = filteredTasks.reduce((s, t) => s + (t.assigned_quantity || 0), 0);
    const totalCompletedQty = filteredTasks.reduce((s, t) => s + (t.completed_quantity || 0), 0);
    const progress = totalAssignedQty > 0 ? Math.round((totalCompletedQty / totalAssignedQty) * 100) : 0;

    return { total, urgent, high, inReview, completed, totalAssignedQty, totalCompletedQty, progress };
  }, [filteredTasks]);

  // Handle Quick Status Change
  const handleQuickStatusChange = async (taskId: string | number, newStatus: WorkStatus) => {
    setUpdatingTaskId(taskId);
    try {
      const updated = await api<WorkAssignment>(`/work-assignments/${taskId}/`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updated, status: newStatus } : t)));
      if (detailTask && detailTask.id === taskId) {
        setDetailTask((prev) => (prev ? { ...prev, ...updated, status: newStatus } : null));
      }
      toast.success(`Status updated to ${newStatus}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update status");
    } finally {
      setUpdatingTaskId(null);
    }
  };

  // Handle Quick Priority Change
  const handleQuickPriorityChange = async (taskId: string | number, newPriority: WorkPriority) => {
    try {
      const updated = await api<WorkAssignment>(`/work-assignments/${taskId}/`, {
        method: "PATCH",
        body: JSON.stringify({ priority: newPriority }),
      });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updated, priority: newPriority } : t)));
      if (detailTask && detailTask.id === taskId) {
        setDetailTask((prev) => (prev ? { ...prev, ...updated, priority: newPriority } : null));
      }
      toast.success(`Priority updated to ${newPriority}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update priority");
    }
  };

  // Handle Quick Deliverable Increment
  const handleIncrement = async (taskId: string | number, delta: number = 1) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const nextQty = Math.max(0, Math.min(task.assigned_quantity || 100, (task.completed_quantity || 0) + delta));
    const targetStatus = nextQty >= (task.assigned_quantity || 100) ? "In Review" : task.status === "Assigned" ? "In Progress" : task.status;

    try {
      const updated = await api<WorkAssignment>(`/work-assignments/${taskId}/`, {
        method: "PATCH",
        body: JSON.stringify({ completed_quantity: nextQty, status: targetStatus }),
      });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updated, completed_quantity: nextQty, status: targetStatus } : t)));
      toast.success(`Progress updated: ${nextQty}/${task.assigned_quantity} ${task.unit}`);
    } catch (err: any) {
      toast.error(err?.message || "Could not update item progress");
    }
  };

  // Handle Upload Attachment to Task
  const handleUploadAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailTask || !selectedFile) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (attachmentName.trim()) {
        formData.append("name", attachmentName.trim());
      }

      const res = await api<any>(`/work-assignments/${detailTask.id}/attachments/`, {
        method: "POST",
        body: formData,
      });

      // Update local state
      setTasks((prev) => prev.map((t) => (t.id === detailTask.id ? { ...t, attachments: res.attachments || [...(t.attachments || []), { name: selectedFile.name, url: res.url || "#" }] } : t)));
      setDetailTask((prev) => prev ? { ...prev, attachments: res.attachments || [...(prev.attachments || []), { name: selectedFile.name, url: res.url || "#" }] } : null);

      toast.success("Asset document uploaded successfully!");
      setUploadModalOpen(false);
      setSelectedFile(null);
      setAttachmentName("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload file");
    } finally {
      setUploadingFile(false);
    }
  };

  // Calendar Days Calculation
  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 = Sun, 1 = Mon ...

    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const days: { date: Date; isCurrentMonth: boolean; dateStr: string }[] = [];

    // Prev month padding
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({ date: d, isCurrentMonth: false, dateStr: d.toISOString().slice(0, 10) });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, isCurrentMonth: true, dateStr: d.toISOString().slice(0, 10) });
    }

    // Next month padding to reach 35 or 42 cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isCurrentMonth: false, dateStr: d.toISOString().slice(0, 10) });
    }

    return days;
  }, [calendarDate]);

  // Tasks mapped by date
  const tasksByDate = useMemo(() => {
    const map: Record<string, WorkAssignment[]> = {};
    filteredTasks.forEach((t) => {
      const dateKey = t.due_date ? t.due_date.slice(0, 10) : t.assigned_date ? t.assigned_date.slice(0, 10) : "";
      if (dateKey) {
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(t);
      }
    });
    return map;
  }, [filteredTasks]);

  // Tasks grouped by Client
  const tasksByClient = useMemo(() => {
    const map: Record<string, { client: Client | null; tasks: WorkAssignment[] }> = {};
    filteredTasks.forEach((t) => {
      const cId = String(t.client || "general");
      const cName = t.client_name || "General Client";
      if (!map[cId]) {
        const foundClient = clients.find((c) => String(c.id) === cId) || null;
        map[cId] = { client: foundClient, tasks: [] };
      }
      map[cId].tasks.push(t);
    });
    return map;
  }, [filteredTasks, clients]);

  return (
    <Shell role={role}>
      <div style={{ maxWidth: "1500px", margin: "0 auto", paddingBottom: "3rem" }}>
        {/* Header Bar */}
        <PageHeader
          title="Client Tasks & Calendar Command Center"
          subtitle="Unified matrix of all client deliverable pipelines, priority queues, task attachments, and deliverable deadlines."
          action={
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button
                onClick={loadData}
                disabled={loading}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--border2, #333)",
                  background: "var(--panel, #1e1e24)",
                  color: "var(--text, #fff)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <RefreshCw size={14} className={loading ? "spin" : ""} />
                Refresh
              </button>
            </div>
          }
        />

        {/* Top Metric Bar */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
          <div style={{ background: "var(--panel, #1e1e24)", border: "1px solid var(--border2, #333)", borderRadius: "12px", padding: "14px 16px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted, #8e8e93)", textTransform: "uppercase" }}>Total Client Tasks</span>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "#fff", marginTop: "4px" }}>{stats.total}</div>
            <div style={{ fontSize: "11.5px", color: "#34d399", marginTop: "2px" }}>Across {clients.length} Active Clients</div>
          </div>

          <div style={{ background: "var(--panel, #1e1e24)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "12px", padding: "14px 16px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#f87171", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "4px" }}>
              <Flame size={13} /> Urgent Priority Tasks
            </span>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "#ef4444", marginTop: "4px" }}>{stats.urgent}</div>
            <div style={{ fontSize: "11.5px", color: "#94a3b8", marginTop: "2px" }}>+{stats.high} High Priority</div>
          </div>

          <div style={{ background: "var(--panel, #1e1e24)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: "12px", padding: "14px 16px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#fbbf24", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "4px" }}>
              <Clock size={13} /> Pending Review / Q.A.
            </span>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "#f59e0b", marginTop: "4px" }}>{stats.inReview}</div>
            <div style={{ fontSize: "11.5px", color: "#94a3b8", marginTop: "2px" }}>Ready for client sign-off</div>
          </div>

          <div style={{ background: "var(--panel, #1e1e24)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "12px", padding: "14px 16px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#34d399", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "4px" }}>
              <CheckCircle2 size={13} /> Deliverable Volume
            </span>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "#10b981", marginTop: "4px" }}>
              {stats.totalCompletedQty} <span style={{ fontSize: "14px", fontWeight: 600, color: "#94a3b8" }}>/ {stats.totalAssignedQty} Units</span>
            </div>
            <div style={{ fontSize: "11.5px", color: "#34d399", marginTop: "2px" }}>{stats.progress}% Overall Quota Delivered</div>
          </div>
        </div>

        {/* Filter Toolbar & View Switcher */}
        <div
          style={{
            background: "var(--panel, #1e1e24)",
            border: "1px solid var(--border2, #333)",
            borderRadius: "14px",
            padding: "14px 18px",
            marginBottom: "20px",
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Left: Filters */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", flex: 1 }}>
            {/* Search Input */}
            <div style={{ position: "relative", minWidth: "220px" }}>
              <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--muted, #888)" }} />
              <input
                type="text"
                placeholder="Search tasks, clients, units..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px 8px 32px",
                  borderRadius: "8px",
                  border: "1px solid var(--border2, #333)",
                  background: "rgba(0,0,0,0.25)",
                  color: "#fff",
                  fontSize: "13px",
                  outline: "none",
                }}
              />
            </div>

            {/* Client Filter */}
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border2, #333)",
                background: "var(--panel, #1e1e24)",
                color: "#fff",
                fontSize: "13px",
                cursor: "pointer",
                maxWidth: "200px",
              }}
            >
              <option value="all">🏢 All Clients ({clients.length})</option>
              {clients.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Priority Filter */}
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border2, #333)",
                background: "var(--panel, #1e1e24)",
                color: "#fff",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              <option value="all">🔥 All Priorities</option>
              <option value="Urgent">🚨 Urgent</option>
              <option value="High">⚡ High</option>
              <option value="Normal">🔷 Normal</option>
              <option value="Low">⚪ Low</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border2, #333)",
                background: "var(--panel, #1e1e24)",
                color: "#fff",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              <option value="all">📊 All Statuses</option>
              <option value="Assigned">Assigned</option>
              <option value="In Progress">In Progress</option>
              <option value="In Review">In Review</option>
              <option value="Changes Requested">Changes Requested</option>
              <option value="Approved">Approved</option>
              <option value="Completed">Completed</option>
              <option value="Published">Published</option>
            </select>

            {/* Department Filter */}
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border2, #333)",
                background: "var(--panel, #1e1e24)",
                color: "#fff",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              <option value="all">🎯 All Departments</option>
              <option value="Design">Design</option>
              <option value="Video Editing">Video Editing</option>
              <option value="Digital Marketing">Digital Marketing</option>
              <option value="Development">Development</option>
              <option value="General">General</option>
            </select>
          </div>

          {/* Right: View Switcher */}
          <div style={{ display: "flex", background: "rgba(0,0,0,0.35)", padding: "3px", borderRadius: "10px", border: "1px solid var(--border2, #333)" }}>
            <button
              onClick={() => setViewMode("matrix")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 12px",
                borderRadius: "7px",
                border: 0,
                background: viewMode === "matrix" ? "linear-gradient(135deg, #059669 0%, #10b981 100%)" : "transparent",
                color: viewMode === "matrix" ? "#fff" : "var(--muted, #888)",
                fontSize: "12.5px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <LayoutGrid size={14} />
              Priority Matrix
            </button>

            <button
              onClick={() => setViewMode("calendar")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 12px",
                borderRadius: "7px",
                border: 0,
                background: viewMode === "calendar" ? "linear-gradient(135deg, #059669 0%, #10b981 100%)" : "transparent",
                color: viewMode === "calendar" ? "#fff" : "var(--muted, #888)",
                fontSize: "12.5px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <Calendar size={14} />
              Client Calendar
            </button>

            <button
              onClick={() => setViewMode("grouped")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 12px",
                borderRadius: "7px",
                border: 0,
                background: viewMode === "grouped" ? "linear-gradient(135deg, #059669 0%, #10b981 100%)" : "transparent",
                color: viewMode === "grouped" ? "#fff" : "var(--muted, #888)",
                fontSize: "12.5px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <Briefcase size={14} />
              By Client
            </button>

            <button
              onClick={() => setViewMode("table")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 12px",
                borderRadius: "7px",
                border: 0,
                background: viewMode === "table" ? "linear-gradient(135deg, #059669 0%, #10b981 100%)" : "transparent",
                color: viewMode === "table" ? "#fff" : "var(--muted, #888)",
                fontSize: "12.5px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <List size={14} />
              Table
            </button>
          </div>
        </div>

        {/* VIEW 1: PRIORITY MATRIX (KANBAN) */}
        {viewMode === "matrix" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px", alignItems: "start" }}>
            {PRIORITY_ORDER.map((priority) => {
              const colTasks = filteredTasks.filter((t) => (t.priority || "Normal") === priority);
              const pStyle = PRIORITY_COLORS[priority];

              return (
                <div
                  key={priority}
                  style={{
                    background: "var(--panel, #1e1e24)",
                    border: `1px solid ${pStyle.border}`,
                    borderRadius: "14px",
                    padding: "16px",
                    minHeight: "480px",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {/* Column Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", paddingBottom: "10px", borderBottom: `1px solid ${pStyle.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: pStyle.dot }} />
                      <h3 style={{ fontSize: "15px", fontWeight: 800, margin: 0, color: pStyle.text }}>
                        {priority} Priority
                      </h3>
                    </div>
                    <span style={{ fontSize: "12px", fontWeight: 700, padding: "3px 9px", borderRadius: "12px", background: pStyle.bg, color: pStyle.text, border: `1px solid ${pStyle.border}` }}>
                      {colTasks.length} tasks
                    </span>
                  </div>

                  {/* Task Cards */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
                    {colTasks.length === 0 ? (
                      <div style={{ padding: "30px 10px", textAlign: "center", color: "var(--muted, #888)", fontSize: "12.5px" }}>
                        No {priority.toLowerCase()} priority client tasks
                      </div>
                    ) : (
                      colTasks.map((task) => (
                        <div
                          key={task.id}
                          style={{
                            background: "rgba(0,0,0,0.3)",
                            border: "1px solid var(--border2, #333)",
                            borderRadius: "10px",
                            padding: "14px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "10px",
                            transition: "all 0.2s ease",
                            cursor: "pointer",
                          }}
                          onClick={() => setDetailTask(task)}
                        >
                          {/* Top Row: Client Badge & Status */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "11px", fontWeight: 800, color: "#34d399", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.25)", padding: "2px 8px", borderRadius: "6px" }}>
                              {task.client_name || "General Client"}
                            </span>

                            <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "6px", background: STATUS_COLORS[task.status]?.bg || "rgba(255,255,255,0.05)", color: STATUS_COLORS[task.status]?.text || "#fff", border: `1px solid ${STATUS_COLORS[task.status]?.border || "#333"}` }}>
                              {task.status}
                            </span>
                          </div>

                          {/* Title */}
                          <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#fff", lineHeight: "1.4" }}>
                            {task.title}
                          </div>

                          {/* Assigned Employee & Due Date */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "var(--muted, #888)" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              <User size={13} /> {task.employee_name || "Unassigned"}
                            </span>
                            {task.due_date && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: new Date(task.due_date).getTime() < Date.now() && task.status !== "Completed" ? "#ef4444" : "var(--muted, #888)" }}>
                                <Clock size={13} /> {task.due_date.slice(0, 10)}
                              </span>
                            )}
                          </div>

                          {/* Progress bar & Deliverable Count */}
                          <div style={{ background: "rgba(255,255,255,0.04)", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border2, #2a2a30)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11.5px", marginBottom: "6px" }}>
                              <span style={{ color: "var(--muted, #888)", fontWeight: 600 }}>Deliverable Progress</span>
                              <strong style={{ color: "#34d399" }}>
                                {task.completed_quantity || 0} / {task.assigned_quantity || 1} {task.unit || "units"}
                              </strong>
                            </div>
                            <div style={{ width: "100%", height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "3px", overflow: "hidden" }}>
                              <div
                                style={{
                                  width: `${Math.min(100, Math.round(((task.completed_quantity || 0) / (task.assigned_quantity || 1)) * 100))}%`,
                                  height: "100%",
                                  background: "linear-gradient(90deg, #10b981 0%, #34d399 100%)",
                                  borderRadius: "3px",
                                }}
                              />
                            </div>
                          </div>

                          {/* Footer Action buttons */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", paddingTop: "4px" }}>
                            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                              {task.attachments && task.attachments.length > 0 && (
                                <span style={{ fontSize: "11px", color: "#60a5fa", display: "inline-flex", alignItems: "center", gap: "3px", background: "rgba(59, 130, 246, 0.1)", padding: "2px 6px", borderRadius: "4px" }}>
                                  <Paperclip size={11} /> {task.attachments.length} files
                                </span>
                              )}
                            </div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleIncrement(task.id, 1);
                              }}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "4px 10px",
                                borderRadius: "6px",
                                background: "rgba(16, 185, 129, 0.15)",
                                border: "1px solid rgba(16, 185, 129, 0.35)",
                                color: "#34d399",
                                fontSize: "11.5px",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              <Plus size={12} /> +1 Done
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* VIEW 2: CLIENT CALENDAR */}
        {viewMode === "calendar" && (
          <div style={{ background: "var(--panel, #1e1e24)", border: "1px solid var(--border2, #333)", borderRadius: "14px", padding: "20px" }}>
            {/* Calendar Controls */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <h2 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: "#fff" }}>
                  {calendarDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </h2>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted, #888)" }}>
                  ({filteredTasks.length} tasks scheduled)
                </span>
              </div>

              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  onClick={() => setCalendarDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border2, #333)", color: "#fff", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", display: "grid", placeItems: "center" }}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setCalendarDate(new Date())}
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border2, #333)", color: "#fff", padding: "6px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                >
                  Today
                </button>
                <button
                  onClick={() => setCalendarDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border2, #333)", color: "#fff", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", display: "grid", placeItems: "center" }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Days of Week Header */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "6px", marginBottom: "6px", textAlign: "center" }}>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} style={{ fontSize: "11px", fontWeight: 800, color: "var(--muted, #888)", textTransform: "uppercase", padding: "6px" }}>
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "6px" }}>
              {calendarDays.map((item, idx) => {
                const dayTasks = tasksByDate[item.dateStr] || [];
                const isToday = item.dateStr === new Date().toISOString().slice(0, 10);

                return (
                  <div
                    key={idx}
                    style={{
                      minHeight: "110px",
                      background: item.isCurrentMonth ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.05)",
                      border: isToday ? "2px solid #10b981" : "1px solid var(--border2, #2a2a32)",
                      borderRadius: "10px",
                      padding: "8px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                      opacity: item.isCurrentMonth ? 1 : 0.4,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "12px", fontWeight: isToday ? 800 : 600, color: isToday ? "#34d399" : "#fff" }}>
                        {item.date.getDate()}
                      </span>
                      {dayTasks.length > 0 && (
                        <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--neon, #00e889)" }}>
                          {dayTasks.length} {dayTasks.length === 1 ? "task" : "tasks"}
                        </span>
                      )}
                    </div>

                    {/* Task chips */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", overflowY: "auto", maxHeight: "120px" }}>
                      {dayTasks.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => setDetailTask(t)}
                          style={{
                            background: PRIORITY_COLORS[t.priority || "Normal"].bg,
                            border: `1px solid ${PRIORITY_COLORS[t.priority || "Normal"].border}`,
                            borderRadius: "6px",
                            padding: "4px 6px",
                            fontSize: "11px",
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            gap: "2px",
                          }}
                          title={`${t.client_name}: ${t.title} (${t.status})`}
                        >
                          <div style={{ fontWeight: 700, color: PRIORITY_COLORS[t.priority || "Normal"].text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {t.client_name}: {t.title}
                          </div>
                          <div style={{ fontSize: "10px", color: "var(--muted, #aaa)", display: "flex", justifyContent: "space-between" }}>
                            <span>{t.completed_quantity || 0}/{t.assigned_quantity || 1} {t.unit}</span>
                            <span style={{ fontWeight: 600, color: STATUS_COLORS[t.status]?.text || "#fff" }}>{t.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW 3: BY CLIENT (GROUPED ACCORDION) */}
        {viewMode === "grouped" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {Object.entries(tasksByClient).map(([clientId, group]) => {
              const cName = group.client?.name || group.tasks[0]?.client_name || "Client";
              const cTasks = group.tasks;
              const completedCount = cTasks.filter((t) => t.status === "Completed" || t.status === "Published").length;
              const urgentCount = cTasks.filter((t) => t.priority === "Urgent").length;

              return (
                <div
                  key={clientId}
                  style={{
                    background: "var(--panel, #1e1e24)",
                    border: "1px solid var(--border2, #333)",
                    borderRadius: "14px",
                    overflow: "hidden",
                  }}
                >
                  {/* Client Header Bar */}
                  <div style={{ padding: "16px 20px", background: "rgba(0,0,0,0.2)", borderBottom: "1px solid var(--border2, #333)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "linear-gradient(135deg, #059669 0%, #10b981 100%)", display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: "16px" }}>
                        {cName.charAt(0)}
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#fff" }}>{cName}</h3>
                        <div style={{ fontSize: "12px", color: "var(--muted, #888)", display: "flex", gap: "12px", marginTop: "2px" }}>
                          <span>Industry: {group.client?.industry || "General"}</span>
                          {group.client?.contact_person?.name && <span>Contact: {group.client.contact_person.name} ({group.client.contact_person.phone || group.client.contact_person.email})</span>}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      {urgentCount > 0 && (
                        <span style={{ fontSize: "11.5px", fontWeight: 700, padding: "3px 8px", borderRadius: "6px", background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
                          {urgentCount} Urgent
                        </span>
                      )}
                      <span style={{ fontSize: "12px", fontWeight: 700, padding: "4px 10px", borderRadius: "8px", background: "rgba(16, 185, 129, 0.15)", color: "#34d399", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                        {completedCount} / {cTasks.length} Done
                      </span>
                    </div>
                  </div>

                  {/* Client Tasks List */}
                  <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "12px" }}>
                    {cTasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => setDetailTask(t)}
                        style={{
                          background: "rgba(0,0,0,0.25)",
                          border: `1px solid ${PRIORITY_COLORS[t.priority || "Normal"].border}`,
                          borderRadius: "10px",
                          padding: "14px",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: PRIORITY_COLORS[t.priority || "Normal"].text, background: PRIORITY_COLORS[t.priority || "Normal"].bg, padding: "2px 6px", borderRadius: "4px" }}>
                            {t.priority}
                          </span>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: STATUS_COLORS[t.status]?.text || "#fff" }}>
                            {t.status}
                          </span>
                        </div>
                        <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#fff" }}>{t.title}</div>
                        <div style={{ fontSize: "12px", color: "var(--muted, #888)", display: "flex", justifyContent: "space-between" }}>
                          <span>Assignee: {t.employee_name || "Unassigned"}</span>
                          <span>{t.completed_quantity || 0}/{t.assigned_quantity || 1} {t.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* VIEW 4: COMPACT TABLE */}
        {viewMode === "table" && (
          <div style={{ background: "var(--panel, #1e1e24)", border: "1px solid var(--border2, #333)", borderRadius: "14px", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "rgba(0,0,0,0.3)", borderBottom: "1px solid var(--border2, #333)", textAlign: "left" }}>
                    <th style={{ padding: "12px 16px", color: "var(--muted, #888)", fontWeight: 700 }}>Client</th>
                    <th style={{ padding: "12px 16px", color: "var(--muted, #888)", fontWeight: 700 }}>Task / Deliverable</th>
                    <th style={{ padding: "12px 16px", color: "var(--muted, #888)", fontWeight: 700 }}>Priority</th>
                    <th style={{ padding: "12px 16px", color: "var(--muted, #888)", fontWeight: 700 }}>Status</th>
                    <th style={{ padding: "12px 16px", color: "var(--muted, #888)", fontWeight: 700 }}>Assignee</th>
                    <th style={{ padding: "12px 16px", color: "var(--muted, #888)", fontWeight: 700 }}>Progress</th>
                    <th style={{ padding: "12px 16px", color: "var(--muted, #888)", fontWeight: 700 }}>Due Date</th>
                    <th style={{ padding: "12px 16px", color: "var(--muted, #888)", fontWeight: 700, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => setDetailTask(t)}
                      style={{ borderBottom: "1px solid var(--border2, #2a2a30)", cursor: "pointer" }}
                    >
                      <td style={{ padding: "12px 16px", fontWeight: 700, color: "#34d399" }}>{t.client_name}</td>
                      <td style={{ padding: "12px 16px", fontWeight: 700, color: "#fff" }}>
                        {t.title}
                        {t.attachments && t.attachments.length > 0 && (
                          <span style={{ marginLeft: "8px", fontSize: "11px", color: "#60a5fa" }}>
                            📎 {t.attachments.length}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: "11.5px", fontWeight: 700, color: PRIORITY_COLORS[t.priority || "Normal"].text, background: PRIORITY_COLORS[t.priority || "Normal"].bg, border: `1px solid ${PRIORITY_COLORS[t.priority || "Normal"].border}`, padding: "2px 8px", borderRadius: "6px" }}>
                          {t.priority}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: "11.5px", fontWeight: 700, color: STATUS_COLORS[t.status]?.text || "#fff" }}>
                          {t.status}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--muted, #aaa)" }}>{t.employee_name || "Unassigned"}</td>
                      <td style={{ padding: "12px 16px", fontWeight: 700, color: "#34d399" }}>
                        {t.completed_quantity || 0} / {t.assigned_quantity || 1} {t.unit}
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--muted, #aaa)" }}>{t.due_date ? t.due_date.slice(0, 10) : "-"}</td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleIncrement(t.id, 1);
                          }}
                          style={{
                            padding: "4px 8px",
                            borderRadius: "6px",
                            background: "rgba(16, 185, 129, 0.15)",
                            border: "1px solid rgba(16, 185, 129, 0.3)",
                            color: "#34d399",
                            fontSize: "11.5px",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          +1 Done
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Task Detail & Asset Upload Modal */}
        {detailTask && (
          <Modal title={`Task Details: ${detailTask.title}`} onClose={() => setDetailTask(null)}>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Top metadata tags */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: 800, color: "#34d399", background: "rgba(16, 185, 129, 0.15)", padding: "4px 10px", borderRadius: "8px", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                  🏢 {detailTask.client_name}
                </span>

                <div style={{ display: "flex", gap: "8px" }}>
                  {/* Quick Priority Dropdown */}
                  <select
                    value={detailTask.priority || "Normal"}
                    onChange={(e) => handleQuickPriorityChange(detailTask.id, e.target.value as WorkPriority)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "6px",
                      background: PRIORITY_COLORS[detailTask.priority || "Normal"].bg,
                      color: PRIORITY_COLORS[detailTask.priority || "Normal"].text,
                      border: `1px solid ${PRIORITY_COLORS[detailTask.priority || "Normal"].border}`,
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <option value="Urgent">🚨 Urgent</option>
                    <option value="High">⚡ High</option>
                    <option value="Normal">🔷 Normal</option>
                    <option value="Low">⚪ Low</option>
                  </select>

                  {/* Quick Status Dropdown */}
                  <select
                    value={detailTask.status}
                    onChange={(e) => handleQuickStatusChange(detailTask.id, e.target.value as WorkStatus)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "6px",
                      background: STATUS_COLORS[detailTask.status]?.bg || "#333",
                      color: STATUS_COLORS[detailTask.status]?.text || "#fff",
                      border: `1px solid ${STATUS_COLORS[detailTask.status]?.border || "#444"}`,
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <option value="Assigned">Assigned</option>
                    <option value="In Progress">In Progress</option>
                    <option value="In Review">In Review</option>
                    <option value="Changes Requested">Changes Requested</option>
                    <option value="Approved">Approved</option>
                    <option value="Completed">Completed</option>
                    <option value="Published">Published</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              {detailTask.description && (
                <div style={{ background: "rgba(0,0,0,0.25)", padding: "12px", borderRadius: "8px", fontSize: "13px", color: "var(--text, #ddd)", lineHeight: "1.5" }}>
                  {detailTask.description}
                </div>
              )}

              {/* Progress Bar & Increment */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border2, #333)", borderRadius: "10px", padding: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>Deliverable Units</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                      onClick={() => handleIncrement(detailTask.id, -1)}
                      style={{ padding: "4px 8px", borderRadius: "6px", background: "rgba(255,255,255,0.1)", border: "1px solid var(--border2, #444)", color: "#fff", cursor: "pointer", fontWeight: 700 }}
                    >
                      -1
                    </button>
                    <strong style={{ fontSize: "15px", color: "#34d399" }}>
                      {detailTask.completed_quantity || 0} / {detailTask.assigned_quantity || 1} {detailTask.unit}
                    </strong>
                    <button
                      onClick={() => handleIncrement(detailTask.id, 1)}
                      style={{ padding: "4px 8px", borderRadius: "6px", background: "rgba(16, 185, 129, 0.2)", border: "1px solid rgba(16, 185, 129, 0.4)", color: "#34d399", cursor: "pointer", fontWeight: 700 }}
                    >
                      +1
                    </button>
                  </div>
                </div>
              </div>

              {/* Attachments & Asset Files */}
              <div style={{ borderTop: "1px solid var(--border2, #333)", paddingTop: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Paperclip size={15} color="#60a5fa" />
                    Task Assets & Documents ({detailTask.attachments?.length || 0})
                  </h4>
                  <button
                    onClick={() => setUploadModalOpen(true)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "5px 10px",
                      borderRadius: "6px",
                      background: "rgba(59, 130, 246, 0.15)",
                      border: "1px solid rgba(59, 130, 246, 0.35)",
                      color: "#60a5fa",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Upload size={13} /> + Upload Asset
                  </button>
                </div>

                {(!detailTask.attachments || detailTask.attachments.length === 0) ? (
                  <p style={{ fontSize: "12px", color: "var(--muted, #888)", margin: 0 }}>
                    No asset files or documents attached yet. Click upload to attach project assets.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {detailTask.attachments.map((att, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          background: "rgba(0,0,0,0.3)",
                          border: "1px solid var(--border2, #333)",
                        }}
                      >
                        <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#fff" }}>
                          📄 {att.name}
                        </span>
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: "11.5px",
                            fontWeight: 700,
                            color: "#34d399",
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          View / Download <ExternalLink size={12} />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Modal>
        )}

        {/* Upload File Modal */}
        {uploadModalOpen && detailTask && (
          <Modal title="Upload Task Asset / Document" onClose={() => setUploadModalOpen(false)}>
            <form onSubmit={handleUploadAttachment} className="modal-form">
              <label>
                Document / Asset Name (Optional)
                <input
                  type="text"
                  placeholder="e.g. Final Video Render, Brand Banner Concept"
                  value={attachmentName}
                  onChange={(e) => setAttachmentName(e.target.value)}
                />
              </label>

              <label>
                Select File (PDF, Image, Video, Doc, Zip)
                <input
                  type="file"
                  required
                  onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                  style={{ padding: "8px", borderRadius: "8px", border: "1px solid var(--border2, #444)", background: "rgba(0,0,0,0.2)" }}
                />
              </label>

              <PrimaryButton type="submit" disabled={uploadingFile || !selectedFile}>
                {uploadingFile ? "Uploading..." : "Upload Asset to Task"}
              </PrimaryButton>
            </form>
          </Modal>
        )}
      </div>
    </Shell>
  );
}
