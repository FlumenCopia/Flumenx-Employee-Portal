"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  Briefcase,
  Building2,
  Layers,
  TrendingUp,
  Filter,
  CheckCheck,
  AlertCircle,
  Clock,
  RotateCcw,
  AlertTriangle,
  FileText,
  KeyRound,
  Camera,
} from "lucide-react";
import { Avatar } from "@/components/icons";
import { EmptyState } from "@/components/ui";
import { useShellUser } from "@/components/shell";
import { api } from "@/lib/api";
import { toast } from "@/components/ToastContext";
import type { WorkAssignment, Paginated, KPIEmployeeData, Client } from "@/lib/types";
import { EmployeeDocumentsModal } from "@/features/employees/EmployeeDocumentsModal";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";


const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function getStatusBadgeStyle(status: string) {
  const s = (status || "").toLowerCase().trim();
  if (s === "published" || s === "completed" || s === "approved") {
    return { background: "rgba(0, 232, 137, 0.12)", color: "var(--neon)", border: "1px solid rgba(0, 232, 137, 0.3)" };
  }
  if (
    s === "changes requested" ||
    s === "revisions" ||
    s === "revision" ||
    s === "rejected" ||
    s === "blocked" ||
    s === "needs correction" ||
    s === "correction"
  ) {
    return { background: "rgba(255, 89, 77, 0.15)", color: "var(--red)", border: "1px solid rgba(255, 89, 77, 0.35)" };
  }
  if (s === "in review") {
    return { background: "rgba(245, 158, 11, 0.15)", color: "#F59E0B", border: "1px solid rgba(245, 158, 11, 0.35)" };
  }
  if (s === "in progress" || s === "ongoing") {
    return { background: "rgba(74, 158, 255, 0.15)", color: "#4A9EFF", border: "1px solid rgba(74, 158, 255, 0.35)" };
  }
  return { background: "rgba(156, 184, 168, 0.12)", color: "var(--muted)", border: "1px solid var(--border)" };
}

function getPriorityBadgeStyle(priority: string) {
  const p = (priority || "").toLowerCase();
  if (p === "urgent" || p === "high") {
    return { background: "rgba(255, 89, 77, 0.15)", color: "var(--red)", border: "1px solid rgba(255, 89, 77, 0.35)" };
  }
  if (p === "normal") {
    return { background: "rgba(74, 158, 255, 0.15)", color: "#4A9EFF", border: "1px solid rgba(74, 158, 255, 0.35)" };
  }
  return { background: "rgba(156, 184, 168, 0.12)", color: "var(--muted)", border: "1px solid var(--border)" };
}

function getStatusProgressPct(status: string, assignedQty: number, completedQty: number): number {
  if (assignedQty > 0) {
    return Math.min(100, Math.max(0, Math.round((completedQty / assignedQty) * 100)));
  }
  const s = (status || "").toLowerCase();
  if (s === "published" || s === "completed") return 100;
  if (s === "approved") return 75;
  if (s === "in review") return 50;
  if (s === "in progress" || s === "ongoing") return 25;
  return 0;
}

function checkIsCorrection(status: string): boolean {
  const s = (status || "").toLowerCase().trim();
  return (
    s === "changes requested" ||
    s === "revisions" ||
    s === "revision" ||
    s === "rejected" ||
    s === "blocked" ||
    s === "needs correction" ||
    s === "correction"
  );
}

function checkIsOverdue(task: WorkAssignment): boolean {
  if ((task as any).is_overdue) return true;
  const s = (task.status || "").toLowerCase().trim();
  if (s === "published" || s === "completed") return false;
  if (task.due_date) {
    const due = new Date(task.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  }
  return false;
}

function getTaskSortPriority(task: WorkAssignment): number {
  const s = (task.status || "").toLowerCase().trim();
  if (s === "published" || s === "completed") return 7;
  if (checkIsCorrection(task.status)) return 1;
  if (checkIsOverdue(task)) return 2;
  if (s === "in progress" || s === "ongoing") return 3;
  if (s === "in review") return 4;
  if (s === "assigned") return 5;
  if (s === "approved") return 6;
  return 6.5;
}

function sortTasks(tasks: WorkAssignment[]): WorkAssignment[] {
  return [...tasks].sort((a, b) => {
    const prioA = getTaskSortPriority(a);
    const prioB = getTaskSortPriority(b);
    if (prioA !== prioB) return prioA - prioB;

    const dateA = a.due_date ? new Date(a.due_date).getTime() : Infinity;
    const dateB = b.due_date ? new Date(b.due_date).getTime() : Infinity;
    return dateA - dateB;
  });
}

export function ProfilePage() {
  const user = useShellUser();
  const [assignments, setAssignments] = useState<WorkAssignment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [, setKpiData] = useState<KPIEmployeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>((currentDate.getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState<string>(currentDate.getFullYear().toString());
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [documentsModalOpen, setDocumentsModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"pending" | "current" | "corrections" | "completed" | "all">("pending");

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarSuccess, setAvatarSuccess] = useState("");

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selected file is not an image. Please select a valid JPEG, PNG, or WebP image.");
      return;
    }

    setUploadingAvatar(true);
    setAvatarSuccess("");
    try {
      const formData = new FormData();
      formData.append("avatar", file);

      await api<{ detail: string; avatar: string }>("/auth/upload-avatar/", {
        method: "POST",
        body: formData,
      });

      setAvatarSuccess("Profile picture updated!");
      toast.success("Profile picture updated successfully!");
      setTimeout(() => setAvatarSuccess(""), 4000);
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    } catch (err: any) {
      toast.error(err.message || "Could not upload profile picture. Please check the image format and size.", "Upload Failed");
    } finally {
      setUploadingAvatar(false);
    }
  };


  const employeeId = user?.employee?.id;

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const url = employeeId
        ? `/work-assignments/?employee=${employeeId}&page_size=300`
        : "/work-assignments/?page_size=300";

      const [workRes, clientsRes] = await Promise.all([
        api<Paginated<WorkAssignment> | WorkAssignment[]>(url).catch(() => ({ results: [] })),
        api<Paginated<Client> | Client[]>("/clients/").catch(() => []),
      ]);

      const workList = Array.isArray(workRes)
        ? workRes
        : (workRes && Array.isArray((workRes as Paginated<WorkAssignment>).results)
            ? (workRes as Paginated<WorkAssignment>).results
            : []);
      setAssignments(workList);

      const clientList = Array.isArray(clientsRes)
        ? clientsRes
        : (clientsRes && Array.isArray((clientsRes as Paginated<Client>).results)
            ? (clientsRes as Paginated<Client>).results
            : []);
      setClients(clientList);

      if (selectedMonth !== "all" && selectedYear !== "all") {
        try {
          const kpiRes = await api<KPIEmployeeData>(
            `/kpi/my-kpi/?month=${selectedMonth}&year=${selectedYear}`
          );
          setKpiData(kpiRes);
        } catch {
          setKpiData(null);
        }
      } else {
        setKpiData(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile work data.");
    } finally {
      setLoading(false);
    }
  }, [user, employeeId, selectedMonth, selectedYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    years.add(currentDate.getFullYear().toString());
    assignments.forEach((a) => {
      const dateStr = a.assigned_date || a.created_at;
      if (dateStr) {
        const y = new Date(dateStr).getFullYear().toString();
        if (y && !isNaN(Number(y))) years.add(y);
      }
    });
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [assignments, currentDate]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      const dateStr = a.assigned_date || a.created_at;
      if (dateStr) {
        const d = new Date(dateStr);
        if (selectedYear !== "all" && d.getFullYear().toString() !== selectedYear) return false;
        if (selectedMonth !== "all" && (d.getMonth() + 1).toString() !== selectedMonth) return false;
      }
      if (selectedClient !== "all" && a.client_name !== selectedClient && a.client.toString() !== selectedClient) {
        return false;
      }
      if (selectedStatus !== "all" && a.status !== selectedStatus) {
        return false;
      }
      return true;
    });
  }, [assignments, selectedYear, selectedMonth, selectedClient, selectedStatus]);

  const summaryStats = useMemo(() => {
    let totalAssignedQty = 0;
    let totalCompletedQty = 0;

    let pendingCount = 0;
    let inProgressCount = 0;
    let inReviewCount = 0;
    let correctionCount = 0;
    let completedCount = 0;

    filteredAssignments.forEach((a) => {
      totalAssignedQty += a.assigned_quantity || 0;
      totalCompletedQty += a.completed_quantity || 0;

      const s = (a.status || "").toLowerCase().trim();
      const isDone = s === "published" || s === "completed";
      const isCorr = checkIsCorrection(s);

      if (isDone) {
        completedCount++;
      } else {
        pendingCount++;
        if (isCorr) correctionCount++;
        if (s === "in progress" || s === "ongoing") inProgressCount++;
        else if (s === "in review") inReviewCount++;
      }
    });

    const overallProgress = totalAssignedQty > 0
      ? Math.min(100, Math.round((totalCompletedQty / totalAssignedQty) * 100))
      : 0;

    return {
      totalTasks: filteredAssignments.length,
      totalAssignedQty,
      totalCompletedQty,
      overallProgress,
      pendingCount,
      inProgressCount,
      inReviewCount,
      correctionCount,
      completedCount,
    };
  }, [filteredAssignments]);

  const displayedAssignments = useMemo(() => {
    let list: WorkAssignment[] = [];
    if (activeTab === "pending") {
      list = filteredAssignments.filter((a) => {
        const s = (a.status || "").toLowerCase().trim();
        return s !== "published" && s !== "completed";
      });
    } else if (activeTab === "current") {
      list = filteredAssignments.filter((a) => {
        const s = (a.status || "").toLowerCase().trim();
        return s === "in progress" || s === "ongoing" || s === "in review" || s === "approved" || s === "assigned";
      });
    } else if (activeTab === "corrections") {
      list = filteredAssignments.filter((a) => checkIsCorrection(a.status));
    } else if (activeTab === "completed") {
      list = filteredAssignments.filter((a) => {
        const s = (a.status || "").toLowerCase().trim();
        return s === "published" || s === "completed";
      });
    } else {
      list = filteredAssignments;
    }
    return sortTasks(list);
  }, [activeTab, filteredAssignments]);

  const clientGroupedWork = useMemo(() => {
    const groups: Record<
      string,
      {
        clientName: string;
        tasks: WorkAssignment[];
        pendingCount: number;
        completedCount: number;
        assignedQty: number;
        completedQty: number;
        progressPct: number;
      }
    > = {};

    displayedAssignments.forEach((task) => {
      const cName = task.client_name || `Client #${task.client}`;
      if (!groups[cName]) {
        groups[cName] = {
          clientName: cName,
          tasks: [],
          pendingCount: 0,
          completedCount: 0,
          assignedQty: 0,
          completedQty: 0,
          progressPct: 0,
        };
      }
      groups[cName].tasks.push(task);
      const s = (task.status || "").toLowerCase().trim();
      if (s === "published" || s === "completed") {
        groups[cName].completedCount++;
      } else {
        groups[cName].pendingCount++;
      }
      groups[cName].assignedQty += task.assigned_quantity || 0;
      groups[cName].completedQty += task.completed_quantity || 0;
    });

    Object.values(groups).forEach((g) => {
      g.progressPct = g.assignedQty > 0
        ? Math.min(100, Math.round((g.completedQty / g.assignedQty) * 100))
        : (g.tasks.length > 0
            ? Math.round(
                g.tasks.reduce(
                  (acc, t) => acc + getStatusProgressPct(t.status, t.assigned_quantity, t.completed_quantity),
                  0
                ) / g.tasks.length
              )
            : 0);
    });

    return Object.values(groups).sort((a, b) => b.pendingCount - a.pendingCount || b.tasks.length - a.tasks.length);
  }, [displayedAssignments]);

  if (!user) {
    return <EmptyState title="No profile found" text="Your account profile is not available." />;
  }

  const e = user.employee;
  const name = e?.name || user.first_name || user.email || user.username;
  const code = e?.employee_code || "FLX-EMP";
  const designation = e?.designation || user.portal_role || "Team Member";
  const department = e?.department || "General";

  const hasActiveFilters =
    selectedMonth !== "all" || selectedYear !== "all" || selectedClient !== "all" || selectedStatus !== "all";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", paddingBottom: "32px" }}>
      {/* 1. TOP HEADER & COMPACT EMPLOYEE IDENTITY */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px", borderBottom: "1px solid var(--border)", paddingBottom: "14px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text)", margin: 0 }}>My Work Dashboard</h1>
          <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
            Track assigned work, pending tasks, reviews, corrections and completed client work.
          </p>
        </div>

        {/* Identity Chip & Actions */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px" }}>
          {user.employee && (
            <button
              type="button"
              onClick={() => setDocumentsModalOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r)",
                padding: "8px 12px",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text)",
                cursor: "pointer",
              }}
            >
              <FileText size={15} style={{ color: "#a8874e" }} /> My Documents
            </button>
          )}

          <button
            type="button"
            onClick={() => setPasswordModalOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(8, 122, 91, 0.12)",
              border: "1px solid rgba(8, 122, 91, 0.35)",
              borderRadius: "var(--r)",
              padding: "8px 12px",
              fontSize: "12px",
              fontWeight: 700,
              color: "#34D399",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <KeyRound size={15} color="#34D399" /> Change Password
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "8px 12px" }}>
            <input
              type="file"
              ref={avatarInputRef}
              accept="image/*"
              onChange={handleAvatarUpload}
              style={{ display: "none" }}
            />

            <div
              onClick={() => avatarInputRef.current?.click()}
              style={{ position: "relative", cursor: "pointer" }}
              title="Click to Upload or Change Profile Photo"
            >
              <Avatar name={name} avatar={user.avatar || user.employee?.avatar} size={40} />
              <div
                style={{
                  position: "absolute",
                  bottom: "-2px",
                  right: "-2px",
                  background: "#087A5B",
                  borderRadius: "50%",
                  width: "18px",
                  height: "18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1.5px solid #FFFFFF",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.4)",
                }}
              >
                <Camera size={11} color="#FFFFFF" />
              </div>
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text)" }}>{name}</span>
                <span style={{ fontSize: "10px", fontWeight: 700, padding: "1px 6px", background: "var(--neon-dim)", color: "var(--neon)", borderRadius: "var(--r-sm)", border: "1px solid var(--border)" }}>
                  {code}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>{designation} &bull; {department}</span>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#34D399",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: 0,
                    textDecoration: "underline",
                  }}
                >
                  {uploadingAvatar ? "Uploading..." : "Photo"}
                </button>
              </div>
              {avatarSuccess && <span style={{ fontSize: "10px", color: "#34D399", fontWeight: 700, display: "block", marginTop: "2px" }}>{avatarSuccess}</span>}
            </div>
          </div>
        </div>

        {user.employee && (
          <EmployeeDocumentsModal
            isOpen={documentsModalOpen}
            onClose={() => setDocumentsModalOpen(false)}
            employee={user.employee as any}
          />
        )}

        <ChangePasswordModal
          open={passwordModalOpen}
          onClose={() => setPasswordModalOpen(false)}
        />
      </div>


      {/* 2. SUMMARY CARDS GRID (6 Cards) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "12px" }}>
        {/* Card 1: Pending Work (MOST IMPORTANT CARD) */}
        <div style={{ background: "var(--panel)", border: "1px solid #F59E0B", borderRadius: "var(--r)", padding: "14px", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "8px" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "#F59E0B" }} />
          <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#F59E0B", display: "flex", alignItems: "center", gap: "5px" }}>
            <Clock size={13} /> Pending Work
          </span>
          <strong style={{ fontSize: "30px", fontWeight: 900, color: "var(--text)", fontFamily: "monospace" }}>{summaryStats.pendingCount}</strong>
          <span style={{ fontSize: "10px", color: "var(--muted)" }}>Incomplete tasks</span>
        </div>

        {/* Card 2: In Progress */}
        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "14px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "8px" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#4A9EFF", display: "flex", alignItems: "center", gap: "5px" }}>
            <Briefcase size={13} /> In Progress
          </span>
          <strong style={{ fontSize: "30px", fontWeight: 900, color: "var(--text)", fontFamily: "monospace" }}>{summaryStats.inProgressCount}</strong>
          <span style={{ fontSize: "10px", color: "var(--muted)" }}>Active working</span>
        </div>

        {/* Card 3: In Review */}
        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "14px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "8px" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#F59E0B", display: "flex", alignItems: "center", gap: "5px" }}>
            <Layers size={13} /> In Review
          </span>
          <strong style={{ fontSize: "30px", fontWeight: 900, color: "var(--text)", fontFamily: "monospace" }}>{summaryStats.inReviewCount}</strong>
          <span style={{ fontSize: "10px", color: "var(--muted)" }}>Awaiting review</span>
        </div>

        {/* Card 4: Needs Correction */}
        <div style={{ background: summaryStats.correctionCount > 0 ? "rgba(255, 89, 77, 0.1)" : "var(--panel)", border: summaryStats.correctionCount > 0 ? "1px solid var(--red)" : "1px solid var(--border)", borderRadius: "var(--r)", padding: "14px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "8px" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: summaryStats.correctionCount > 0 ? "var(--red)" : "var(--muted)", display: "flex", alignItems: "center", gap: "5px" }}>
            <AlertCircle size={13} /> Corrections
          </span>
          <strong style={{ fontSize: "30px", fontWeight: 900, color: summaryStats.correctionCount > 0 ? "var(--red)" : "var(--text)", fontFamily: "monospace" }}>{summaryStats.correctionCount}</strong>
          <span style={{ fontSize: "10px", color: "var(--muted)" }}>Needs revision</span>
        </div>

        {/* Card 5: Completed */}
        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "14px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "8px" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--neon)", display: "flex", alignItems: "center", gap: "5px" }}>
            <CheckCheck size={13} /> Completed
          </span>
          <strong style={{ fontSize: "30px", fontWeight: 900, color: "var(--text)", fontFamily: "monospace" }}>{summaryStats.completedCount}</strong>
          <span style={{ fontSize: "10px", color: "var(--muted)" }}>Published &amp; done</span>
        </div>

        {/* Card 6: Overall Progress */}
        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "14px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--muted)", display: "flex", alignItems: "center", gap: "5px" }}>
              <TrendingUp size={13} style={{ color: "var(--neon)" }} /> Progress
            </span>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--neon)", fontFamily: "monospace" }}>{summaryStats.overallProgress}%</span>
          </div>
          <div className="pbar"><div className="pfill g" style={{ width: `${summaryStats.overallProgress}%` }} /></div>
          <span style={{ fontSize: "10px", color: "var(--muted)" }}>
            {summaryStats.totalCompletedQty} / {summaryStats.totalAssignedQty} items
          </span>
        </div>
      </div>

      {/* 3. FILTER TOOLBAR */}
      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "12px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--muted)" }}>
          <Filter size={14} style={{ color: "var(--neon)" }} />
          <span>Filters</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "8px", flex: 1 }}>
          <select
            aria-label="Filter by client"
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            style={{ background: "var(--panel2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: "var(--r-sm)", padding: "6px 10px", fontSize: "12px", fontWeight: 600, outline: "none", cursor: "pointer" }}
          >
            <option value="all">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>

          <select
            aria-label="Filter by status"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={{ background: "var(--panel2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: "var(--r-sm)", padding: "6px 10px", fontSize: "12px", fontWeight: 600, outline: "none", cursor: "pointer" }}
          >
            <option value="all">All Statuses</option>
            <option value="Assigned">Assigned</option>
            <option value="In Progress">In Progress</option>
            <option value="In Review">In Review</option>
            <option value="Approved">Approved</option>
            <option value="Published">Published</option>
          </select>

          <select
            aria-label="Filter by month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ background: "var(--panel2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: "var(--r-sm)", padding: "6px 10px", fontSize: "12px", fontWeight: 600, outline: "none", cursor: "pointer" }}
          >
            <option value="all">All Months</option>
            {MONTH_NAMES.map((m, idx) => (
              <option key={m} value={(idx + 1).toString()}>{m}</option>
            ))}
          </select>

          <select
            aria-label="Filter by year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            style={{ background: "var(--panel2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: "var(--r-sm)", padding: "6px 10px", fontSize: "12px", fontWeight: 600, outline: "none", cursor: "pointer" }}
          >
            <option value="all">All Years</option>
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setSelectedMonth("all");
              setSelectedYear("all");
              setSelectedClient("all");
              setSelectedStatus("all");
            }}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "var(--r-sm)", background: "var(--panel2)", border: "1px solid var(--border)", fontSize: "12px", fontWeight: 600, color: "var(--muted)", cursor: "pointer" }}
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* 4. WORK TABS */}
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "var(--r-sm)",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              background: activeTab === "pending" ? "var(--neon-dim)" : "var(--panel2)",
              color: activeTab === "pending" ? "var(--neon)" : "var(--muted)",
              border: activeTab === "pending" ? "1px solid var(--neon)" : "1px solid var(--border)",
              transition: "all 0.15s ease",
            }}
          >
            <Clock size={14} />
            Pending ({summaryStats.pendingCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("current")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "var(--r-sm)",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              background: activeTab === "current" ? "var(--neon-dim)" : "var(--panel2)",
              color: activeTab === "current" ? "var(--neon)" : "var(--muted)",
              border: activeTab === "current" ? "1px solid var(--neon)" : "1px solid var(--border)",
              transition: "all 0.15s ease",
            }}
          >
            <Briefcase size={14} />
            Current Work ({summaryStats.inProgressCount + summaryStats.inReviewCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("corrections")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "var(--r-sm)",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              background: activeTab === "corrections" ? "rgba(255, 89, 77, 0.2)" : summaryStats.correctionCount > 0 ? "rgba(255, 89, 77, 0.1)" : "var(--panel2)",
              color: activeTab === "corrections" ? "var(--red)" : summaryStats.correctionCount > 0 ? "var(--red)" : "var(--muted)",
              border: activeTab === "corrections" ? "1px solid var(--red)" : summaryStats.correctionCount > 0 ? "1px solid rgba(255, 89, 77, 0.4)" : "1px solid var(--border)",
              transition: "all 0.15s ease",
            }}
          >
            <AlertCircle size={14} />
            Needs Correction ({summaryStats.correctionCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("completed")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "var(--r-sm)",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              background: activeTab === "completed" ? "var(--neon-dim)" : "var(--panel2)",
              color: activeTab === "completed" ? "var(--neon)" : "var(--muted)",
              border: activeTab === "completed" ? "1px solid var(--neon)" : "1px solid var(--border)",
              transition: "all 0.15s ease",
            }}
          >
            <CheckCheck size={14} />
            Completed ({summaryStats.completedCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("all")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "var(--r-sm)",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              background: activeTab === "all" ? "var(--neon-dim)" : "var(--panel2)",
              color: activeTab === "all" ? "var(--neon)" : "var(--muted)",
              border: activeTab === "all" ? "1px solid var(--neon)" : "1px solid var(--border)",
              transition: "all 0.15s ease",
            }}
          >
            <Layers size={14} />
            All Work ({summaryStats.totalTasks})
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--muted)", fontSize: "14px" }}>
            Loading your work dashboard...
          </div>
        )}

        {/* Error State */}
        {error && (
          <div style={{ padding: "14px", borderRadius: "var(--r)", background: "rgba(255, 89, 77, 0.15)", border: "1px solid var(--red)", color: "var(--red)", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && clientGroupedWork.length === 0 && (
          <EmptyState
            title={
              activeTab === "pending"
                ? "No pending tasks!"
                : activeTab === "corrections"
                ? "No tasks need correction"
                : activeTab === "completed"
                ? "No completed tasks found"
                : "No work assigned"
            }
            text={
              filteredAssignments.length === 0
                ? "No work items match the selected client, status, month, or year filters."
                : activeTab === "pending"
                ? "You have completed all assigned tasks for the active selection."
                : activeTab === "corrections"
                ? "Great job! None of your tasks are currently marked for corrections or revisions."
                : "No task records available under this tab view."
            }
          />
        )}

        {/* 5. CLIENT-WISE WORK CARDS */}
        {!loading && !error && clientGroupedWork.map((clientGroup) => (
          <div
            key={clientGroup.clientName}
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r)",
              padding: "18px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            {/* Client Card Header */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
              <div>
                <span style={{ fontSize: "10px", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)", display: "block" }}>Client</span>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)", margin: "4px 0 0", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Building2 size={16} style={{ color: "#4A9EFF" }} />
                  {clientGroup.clientName}
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)" }}>
                    ({clientGroup.tasks.length} total &bull; {clientGroup.pendingCount} pending &bull; {clientGroup.completedCount} done)
                  </span>
                </h3>
              </div>

              {/* Client Progress Header */}
              <div style={{ minWidth: "180px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                  <span style={{ color: "var(--muted)" }}>Client Progress:</span>
                  <span style={{ color: "var(--neon)", fontFamily: "monospace" }}>{clientGroup.progressPct}%</span>
                </div>
                <div className="pbar"><div className="pfill g" style={{ width: `${clientGroup.progressPct}%` }} /></div>
              </div>
            </div>

            {/* Task Card List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {clientGroup.tasks.map((task) => {
                const progressPct = getStatusProgressPct(
                  task.status,
                  task.assigned_quantity,
                  task.completed_quantity
                );
                const isCorrectionRequired = checkIsCorrection(task.status);
                const isOverdue = checkIsOverdue(task);
                const statusStyle = getStatusBadgeStyle(task.status);
                const priorityStyle = getPriorityBadgeStyle(task.priority);

                return (
                  <div
                    key={task.id}
                    style={{
                      background: isCorrectionRequired
                        ? "rgba(255, 89, 77, 0.08)"
                        : isOverdue
                        ? "rgba(255, 89, 77, 0.05)"
                        : "var(--panel2)",
                      border: isCorrectionRequired || isOverdue
                        ? "1px solid var(--red)"
                        : "1px solid var(--border)",
                      borderRadius: "var(--r-sm)",
                      padding: "14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    {/* Top Row: Title & Badges */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <h4 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)", margin: 0 }}>{task.title}</h4>

                          {/* Status Badge */}
                          <span style={{ padding: "2px 8px", borderRadius: "var(--r-sm)", fontSize: "10px", fontWeight: 700, ...statusStyle }}>
                            {task.status}
                          </span>

                          {/* Needs Correction Badge */}
                          {isCorrectionRequired && (
                            <span style={{ padding: "2px 8px", borderRadius: "var(--r-sm)", fontSize: "10px", fontWeight: 700, background: "rgba(255, 89, 77, 0.2)", color: "var(--red)", border: "1px solid var(--red)", display: "flex", alignItems: "center", gap: "4px" }}>
                              <AlertCircle size={11} /> Needs Correction
                            </span>
                          )}

                          {/* Overdue Badge */}
                          {isOverdue && (
                            <span style={{ padding: "2px 8px", borderRadius: "var(--r-sm)", fontSize: "10px", fontWeight: 700, background: "var(--red)", color: "#000", display: "flex", alignItems: "center", gap: "4px" }}>
                              <AlertTriangle size={11} /> OVERDUE
                            </span>
                          )}

                          {/* Priority Badge */}
                          {task.priority && (
                            <span style={{ padding: "2px 8px", borderRadius: "var(--r-sm)", fontSize: "10px", fontWeight: 700, ...priorityStyle }}>
                              {task.priority} Priority
                            </span>
                          )}

                          {/* Department / Work Type */}
                          {task.employee_department && (
                            <span style={{ padding: "2px 8px", borderRadius: "var(--r-sm)", fontSize: "10px", background: "var(--bg)", color: "var(--muted)", border: "1px solid var(--border)" }}>
                              {task.employee_department}
                            </span>
                          )}
                        </div>

                        {task.description && (
                          <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 0", lineHeight: 1.4 }}>{task.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Separate Label & Value Grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "10px", paddingTop: "8px", borderTop: "1px solid var(--border)", fontSize: "12px" }}>
                      <div>
                        <span style={{ fontSize: "10px", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)", display: "block" }}>Client</span>
                        <span style={{ fontWeight: 600, color: "var(--text)", display: "block", marginTop: "2px" }}>{clientGroup.clientName}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: "10px", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)", display: "block" }}>Due Date</span>
                        <span style={{ fontWeight: 600, color: isOverdue ? "var(--red)" : "var(--text)", display: "block", marginTop: "2px" }}>
                          {task.due_date || "N/A"}
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: "10px", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)", display: "block" }}>Reviewer</span>
                        <span style={{ fontWeight: 600, color: "var(--text)", display: "block", marginTop: "2px" }}>{task.reviewer_name || "Unassigned"}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: "10px", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)", display: "block" }}>Qty</span>
                        <span style={{ fontWeight: 600, color: "var(--neon)", display: "block", marginTop: "2px" }}>
                          {task.completed_quantity || 0} / {task.assigned_quantity || 0} {task.unit || "items"}
                        </span>
                      </div>
                    </div>

                    {/* Task Progress Bar */}
                    <div style={{ paddingTop: "6px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px" }}>
                        <span style={{ fontSize: "10px", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>Task Progress</span>
                        <span style={{ fontWeight: 700, color: "var(--neon)", fontFamily: "monospace" }}>{progressPct}%</span>
                      </div>
                      <div className="pbar"><div className="pfill g" style={{ width: `${progressPct}%` }} /></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
