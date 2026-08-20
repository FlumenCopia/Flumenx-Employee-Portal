"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  AlertCircle,
  AlertTriangle,
  BriefcaseBusiness,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  RotateCcw,
  Search,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/icons";
import { EmptyState } from "@/components/ui";
import { useShellUser } from "@/components/shell";
import { api } from "@/lib/api";
import type { WorkAssignment, Paginated, Client, WorkEmployeeOption } from "@/lib/types";

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
  if (p === "urgent" || p === "high" || p === "p0") {
    return { background: "rgba(255, 89, 77, 0.15)", color: "var(--red)", border: "1px solid rgba(255, 89, 77, 0.35)" };
  }
  if (p === "normal" || p === "p1") {
    return { background: "rgba(74, 158, 255, 0.15)", color: "#4A9EFF", border: "1px solid rgba(74, 158, 255, 0.35)" };
  }
  return { background: "rgba(156, 184, 168, 0.12)", color: "var(--muted)", border: "1px solid var(--border)" };
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

async function fetchAllWorkAssignments(): Promise<WorkAssignment[]> {
  const allItems: WorkAssignment[] = [];
  const seenIds = new Set<number>();
  let page = 1;
  const pageSize = 200;
  let hasMore = true;
  const maxPages = 20; // Hard safety limit to prevent infinite loops (max 4000 items)

  while (hasMore && page <= maxPages) {
    try {
      const res = await api<Paginated<WorkAssignment> | WorkAssignment[]>(
        `/work-assignments/?page_size=${pageSize}&page=${page}`
      );

      if (Array.isArray(res)) {
        for (const item of res) {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            allItems.push(item);
          }
        }
        hasMore = false;
      } else if (res && Array.isArray(res.results)) {
        for (const item of res.results) {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            allItems.push(item);
          }
        }
        if (res.next && res.results.length > 0) {
          page += 1;
        } else {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    } catch {
      hasMore = false;
    }
  }

  return allItems;
}

export function TeamWorkPage({ role = "TEAM_LEAD" }: { role?: string }) {
  const user = useShellUser();
  const [assignments, setAssignments] = useState<WorkAssignment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [teamMembers, setTeamMembers] = useState<WorkEmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedEmployee, setSelectedEmployee] = useState("all");
  const [selectedClient, setSelectedClient] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  const [expandedMembers, setExpandedMembers] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [workList, clientsRes, empRes] = await Promise.all([
        fetchAllWorkAssignments(),
        api<Paginated<Client> | Client[]>("/clients/").catch(() => []),
        api<WorkEmployeeOption[]>("/work-employee-options/").catch(() => []),
      ]);

      setAssignments(workList);

      const clientList = Array.isArray(clientsRes)
        ? clientsRes
        : (clientsRes && Array.isArray((clientsRes as Paginated<Client>).results)
            ? (clientsRes as Paginated<Client>).results
            : []);
      setClients(clientList);

      const empList = Array.isArray(empRes) ? empRes : [];
      setTeamMembers(empList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load team work data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    teamMembers.forEach((m) => {
      if (m.department) set.add(m.department);
    });
    assignments.forEach((a) => {
      if (a.employee_department) set.add(a.employee_department);
    });
    return Array.from(set).sort();
  }, [teamMembers, assignments]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = a.title.toLowerCase().includes(q);
        const matchEmp = a.employee_name.toLowerCase().includes(q);
        const matchClient = (a.client_name || "").toLowerCase().includes(q);
        if (!matchTitle && !matchEmp && !matchClient) return false;
      }
      if (selectedDepartment !== "all") {
        if ((a.employee_department || "").toLowerCase() !== selectedDepartment.toLowerCase()) return false;
      }
      if (selectedEmployee !== "all") {
        if (String(a.employee) !== selectedEmployee) return false;
      }
      if (selectedClient !== "all") {
        if (a.client_name !== selectedClient && String(a.client) !== selectedClient) return false;
      }
      if (selectedStatus !== "all") {
        if (a.status !== selectedStatus) return false;
      }
      return true;
    });
  }, [assignments, searchQuery, selectedDepartment, selectedEmployee, selectedClient, selectedStatus]);

  const employeeGroupedWork = useMemo(() => {
    const map: Record<
      string,
      {
        employeeId: string;
        name: string;
        department: string;
        designation: string;
        tasks: WorkAssignment[];
        activeCount: number;
        pendingCount: number;
        inProgressCount: number;
        inReviewCount: number;
        correctionCount: number;
        approvedCount: number;
        completedCount: number;
        overdueCount: number;
      }
    > = {};

    teamMembers.forEach((m) => {
      const idStr = String(m.id);
      if (selectedDepartment !== "all" && (m.department || "").toLowerCase() !== selectedDepartment.toLowerCase()) {
        return;
      }
      if (selectedEmployee !== "all" && idStr !== selectedEmployee) {
        return;
      }
      map[idStr] = {
        employeeId: idStr,
        name: m.display_name,
        department: m.department || "General",
        designation: "Team Member",
        tasks: [],
        activeCount: 0,
        pendingCount: 0,
        inProgressCount: 0,
        inReviewCount: 0,
        correctionCount: 0,
        approvedCount: 0,
        completedCount: 0,
        overdueCount: 0,
      };
    });

    filteredAssignments.forEach((a) => {
      const empIdStr = String(a.employee);
      if (!map[empIdStr]) {
        if (selectedEmployee !== "all" && empIdStr !== selectedEmployee) return;
        if (selectedDepartment !== "all" && (a.employee_department || "").toLowerCase() !== selectedDepartment.toLowerCase()) return;

        map[empIdStr] = {
          employeeId: empIdStr,
          name: a.employee_name || `Employee #${empIdStr}`,
          department: a.employee_department || "General",
          designation: "Team Member",
          tasks: [],
          activeCount: 0,
          pendingCount: 0,
          inProgressCount: 0,
          inReviewCount: 0,
          correctionCount: 0,
          approvedCount: 0,
          completedCount: 0,
          overdueCount: 0,
        };
      }

      const g = map[empIdStr];
      g.tasks.push(a);

      const s = (a.status || "").toLowerCase().trim();
      const isDone = s === "published" || s === "completed";
      const isCorr = checkIsCorrection(s);
      const isOver = checkIsOverdue(a);

      if (isDone) {
        g.completedCount++;
      } else {
        g.activeCount++;
        g.pendingCount++;
        if (isCorr) g.correctionCount++;
        if (s === "in progress" || s === "ongoing") g.inProgressCount++;
        else if (s === "in review") g.inReviewCount++;
        else if (s === "approved") g.approvedCount++;
        if (isOver) g.overdueCount++;
      }
    });

    return Object.values(map).sort((a, b) => b.pendingCount - a.pendingCount || b.tasks.length - a.tasks.length);
  }, [teamMembers, filteredAssignments, selectedDepartment, selectedEmployee]);

  const teamSummary = useMemo(() => {
    let totalPending = 0;
    let totalInProgress = 0;
    let totalInReview = 0;
    let totalCorrections = 0;
    let totalOverdue = 0;

    employeeGroupedWork.forEach((g) => {
      totalPending += g.pendingCount;
      totalInProgress += g.inProgressCount;
      totalInReview += g.inReviewCount;
      totalCorrections += g.correctionCount;
      totalOverdue += g.overdueCount;
    });

    return {
      totalMembers: employeeGroupedWork.length,
      totalPending,
      totalInProgress,
      totalInReview,
      totalCorrections,
      totalOverdue,
    };
  }, [employeeGroupedWork]);

  const toggleExpand = (empId: string) => {
    setExpandedMembers((prev) => ({ ...prev, [empId]: !prev[empId] }));
  };

  const hasActiveFilters =
    searchQuery !== "" || selectedDepartment !== "all" || selectedEmployee !== "all" || selectedClient !== "all" || selectedStatus !== "all";

  const currentUserName = user?.first_name || user?.username || "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px", paddingBottom: "32px" }}>
      {/* 1. SIMPLIFIED PAGE HEADER (NO DUPLICATE NEW TASK BUTTON) */}
      <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text)", margin: 0 }}>Team Work</h1>
        <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px", margin: 0 }}>
          Track team workload, pending tasks and progress.
        </p>
      </div>

      {/* 2. COMPACT 4 SUMMARY CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px" }}>
        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--muted)" }}>Team Members</span>
            <strong style={{ display: "block", fontSize: "22px", fontWeight: 800, color: "var(--text)", fontFamily: "monospace", marginTop: "2px" }}>{teamSummary.totalMembers}</strong>
          </div>
          <Users size={18} style={{ color: "var(--neon)", opacity: 0.8 }} />
        </div>

        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#F59E0B" }}>Pending</span>
            <strong style={{ display: "block", fontSize: "22px", fontWeight: 800, color: "var(--text)", fontFamily: "monospace", marginTop: "2px" }}>{teamSummary.totalPending}</strong>
          </div>
          <Clock size={18} style={{ color: "#F59E0B", opacity: 0.8 }} />
        </div>

        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#4A9EFF" }}>In Progress</span>
            <strong style={{ display: "block", fontSize: "22px", fontWeight: 800, color: "var(--text)", fontFamily: "monospace", marginTop: "2px" }}>{teamSummary.totalInProgress}</strong>
          </div>
          <BriefcaseBusiness size={18} style={{ color: "#4A9EFF", opacity: 0.8 }} />
        </div>

        <div style={{ background: teamSummary.totalOverdue > 0 ? "rgba(255, 89, 77, 0.1)" : "var(--panel)", border: teamSummary.totalOverdue > 0 ? "1px solid var(--red)" : "1px solid var(--border)", borderRadius: "var(--r)", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: teamSummary.totalOverdue > 0 ? "var(--red)" : "var(--muted)" }}>Overdue</span>
            <strong style={{ display: "block", fontSize: "22px", fontWeight: 800, color: teamSummary.totalOverdue > 0 ? "var(--red)" : "var(--text)", fontFamily: "monospace", marginTop: "2px" }}>{teamSummary.totalOverdue}</strong>
          </div>
          <AlertTriangle size={18} style={{ color: teamSummary.totalOverdue > 0 ? "var(--red)" : "var(--muted)", opacity: 0.8 }} />
        </div>
      </div>

      {/* 3. COMPACT TOOLBAR (PREFERRED ORDER: SEARCH, EMPLOYEE, STATUS, DEPT, CLIENT) */}
      <div style={{ background: "#ffffff", border: "1px solid #e8e6e1", borderRadius: "16px", padding: "10px 14px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#ffffff", border: "1px solid #dad7ce", borderRadius: "10px", padding: "0 12px", minWidth: "220px", flex: 1 }}>
          <Search size={15} style={{ color: "#cba86e" }} />
          <input
            type="text"
            placeholder="Search employee or task..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ background: "transparent", border: 0, outline: 0, color: "#1a1b1e", fontSize: "12.5px", width: "100%", padding: "8px 0", fontWeight: 500 }}
          />
        </div>

        <select
          aria-label="Filter by employee"
          value={selectedEmployee}
          onChange={(e) => setSelectedEmployee(e.target.value)}
          style={{ background: "#ffffff", border: "1px solid #dad7ce", color: "#1a1b1e", borderRadius: "10px", padding: "8px 12px", fontSize: "12px", fontWeight: 600, outline: "none", cursor: "pointer" }}
        >
          <option value="all" style={{ background: "#ffffff", color: "#1a1b1e" }}>All Team Members</option>
          {teamMembers.map((m) => (
            <option key={m.id} value={String(m.id)} style={{ background: "#ffffff", color: "#1a1b1e" }}>{m.display_name} — {m.department}</option>
          ))}
        </select>

        <select
          aria-label="Filter by status"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          style={{ background: "#ffffff", border: "1px solid #dad7ce", color: "#1a1b1e", borderRadius: "10px", padding: "8px 12px", fontSize: "12px", fontWeight: 600, outline: "none", cursor: "pointer" }}
        >
          <option value="all" style={{ background: "#ffffff", color: "#1a1b1e" }}>All Statuses</option>
          <option value="Assigned" style={{ background: "#ffffff", color: "#1a1b1e" }}>Assigned</option>
          <option value="In Progress" style={{ background: "#ffffff", color: "#1a1b1e" }}>In Progress</option>
          <option value="In Review" style={{ background: "#ffffff", color: "#1a1b1e" }}>In Review</option>
          <option value="Approved" style={{ background: "#ffffff", color: "#1a1b1e" }}>Approved</option>
          <option value="Published" style={{ background: "#ffffff", color: "#1a1b1e" }}>Published</option>
        </select>

        <select
          aria-label="Filter by department"
          value={selectedDepartment}
          onChange={(e) => setSelectedDepartment(e.target.value)}
          style={{ background: "#ffffff", border: "1px solid #dad7ce", color: "#1a1b1e", borderRadius: "10px", padding: "8px 12px", fontSize: "12px", fontWeight: 600, outline: "none", cursor: "pointer" }}
        >
          <option value="all" style={{ background: "#ffffff", color: "#1a1b1e" }}>All Departments</option>
          {departmentOptions.map((d) => (
            <option key={d} value={d} style={{ background: "#ffffff", color: "#1a1b1e" }}>{d}</option>
          ))}
        </select>

        <select
          aria-label="Filter by client"
          value={selectedClient}
          onChange={(e) => setSelectedClient(e.target.value)}
          style={{ background: "#ffffff", border: "1px solid #dad7ce", color: "#1a1b1e", borderRadius: "10px", padding: "8px 12px", fontSize: "12px", fontWeight: 600, outline: "none", cursor: "pointer" }}
        >
          <option value="all" style={{ background: "#ffffff", color: "#1a1b1e" }}>All Clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.name} style={{ background: "#ffffff", color: "#1a1b1e" }}>{c.name}</option>
          ))}
        </select>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setSelectedDepartment("all");
              setSelectedEmployee("all");
              setSelectedClient("all");
              setSelectedStatus("all");
            }}
            style={{ display: "flex", alignItems: "center", gap: "4px", padding: "6px 10px", borderRadius: "var(--r-sm)", background: "var(--panel2)", border: "1px solid var(--border)", fontSize: "12px", fontWeight: 600, color: "var(--muted)", cursor: "pointer" }}
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* 4. MAIN CONTENT: EMPLOYEE ROWS */}
      {loading && (
        <div style={{ padding: "24px", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
          Loading team work...
        </div>
      )}

      {error && (
        <div style={{ padding: "12px", borderRadius: "var(--r)", background: "rgba(255, 89, 77, 0.15)", border: "1px solid var(--red)", color: "var(--red)", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && employeeGroupedWork.length === 0 && (
        <EmptyState
          title="No team members found"
          text="No team workload matches the selected filters."
        />
      )}

      {!loading && !error && employeeGroupedWork.map((group) => {
        const isExpanded = Boolean(expandedMembers[group.employeeId]);
        const isSelf = currentUserName && group.name.toLowerCase().includes(currentUserName.toLowerCase());
        const deptLabel = isSelf ? `${group.department} · You` : group.department;

        return (
          <div
            key={group.employeeId}
            style={{
              background: "var(--panel)",
              border: group.correctionCount > 0
                ? "1px solid var(--red)"
                : "1px solid var(--border)",
              borderRadius: "var(--r)",
              padding: "12px 16px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {/* Employee Summary Header Row */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Avatar name={group.name} size={36} />
                <div>
                  <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)", margin: 0 }}>
                    {group.name}
                  </h3>
                  <span style={{ fontSize: "11px", color: "var(--muted)", display: "block", marginTop: "1px" }}>
                    {group.designation} &bull; <b style={{ color: isSelf ? "var(--neon)" : "var(--muted)", fontWeight: 600 }}>{deptLabel}</b>
                  </span>
                </div>
              </div>

              {/* Workload Metrics & View Tasks */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ padding: "3px 8px", borderRadius: "var(--r-sm)", fontSize: "11px", fontWeight: 600, background: group.pendingCount > 0 ? "rgba(245, 158, 11, 0.15)" : "var(--panel2)", color: group.pendingCount > 0 ? "#F59E0B" : "var(--muted)", border: "1px solid var(--border)" }}>
                  Pending {group.pendingCount}
                </span>

                <span style={{ padding: "3px 8px", borderRadius: "var(--r-sm)", fontSize: "11px", fontWeight: 600, background: "var(--panel2)", color: group.inProgressCount > 0 ? "#4A9EFF" : "var(--muted)", border: "1px solid var(--border)" }}>
                  In Progress {group.inProgressCount}
                </span>

                <span style={{ padding: "3px 8px", borderRadius: "var(--r-sm)", fontSize: "11px", fontWeight: 600, background: "var(--panel2)", color: group.inReviewCount > 0 ? "#F59E0B" : "var(--muted)", border: "1px solid var(--border)" }}>
                  Review {group.inReviewCount}
                </span>

                {group.correctionCount > 0 && (
                  <span style={{ padding: "3px 8px", borderRadius: "var(--r-sm)", fontSize: "11px", fontWeight: 700, background: "rgba(255, 89, 77, 0.2)", color: "var(--red)", border: "1px solid var(--red)" }}>
                    Correction {group.correctionCount}
                  </span>
                )}

                <span style={{ padding: "3px 8px", borderRadius: "var(--r-sm)", fontSize: "11px", fontWeight: 600, background: "var(--panel2)", color: group.completedCount > 0 ? "var(--neon)" : "var(--muted)", border: "1px solid var(--border)" }}>
                  Done {group.completedCount}
                </span>

                {group.overdueCount > 0 && (
                  <span style={{ padding: "3px 8px", borderRadius: "var(--r-sm)", fontSize: "11px", fontWeight: 700, background: "var(--red)", color: "#000" }}>
                    Overdue {group.overdueCount}
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => toggleExpand(group.employeeId)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "4px 10px",
                    borderRadius: "var(--r-sm)",
                    background: "var(--panel2)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                    marginLeft: "4px",
                  }}
                >
                  {isExpanded ? (
                    <><span>Hide Tasks</span> <ChevronUp size={13} /></>
                  ) : (
                    <><span>View Tasks ({group.tasks.length})</span> <ChevronDown size={13} /></>
                  )}
                </button>
              </div>
            </div>

            {/* Expanded Detailed Tasks Panel */}
            {isExpanded && (
              <div style={{ paddingTop: "10px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "6px" }}>
                {group.tasks.length === 0 ? (
                  <div style={{ fontSize: "11px", color: "var(--muted)", padding: "6px 0" }}>
                    No assigned tasks under current selection.
                  </div>
                ) : (
                  group.tasks.map((task) => {
                    const progressPct = getStatusProgressPct(task.status, task.assigned_quantity, task.completed_quantity);
                    const isCorrection = checkIsCorrection(task.status);
                    const isOverdue = checkIsOverdue(task);
                    const statusStyle = getStatusBadgeStyle(task.status);
                    const priorityStyle = getPriorityBadgeStyle(task.priority);

                    return (
                      <div
                        key={task.id}
                        style={{
                          background: isCorrection
                            ? "rgba(255, 89, 77, 0.08)"
                            : isOverdue
                            ? "rgba(255, 89, 77, 0.05)"
                            : "var(--panel2)",
                          border: isCorrection || isOverdue
                            ? "1px solid var(--red)"
                            : "1px solid var(--border)",
                          borderRadius: "var(--r-sm)",
                          padding: "8px 12px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text)" }}>{task.title}</span>

                            <span style={{ padding: "2px 6px", borderRadius: "var(--r-sm)", fontSize: "10px", fontWeight: 700, ...statusStyle }}>
                              {task.status}
                            </span>

                            {isCorrection && (
                              <span style={{ padding: "2px 6px", borderRadius: "var(--r-sm)", fontSize: "10px", fontWeight: 700, background: "rgba(255, 89, 77, 0.2)", color: "var(--red)", border: "1px solid var(--red)", display: "flex", alignItems: "center", gap: "3px" }}>
                                <AlertCircle size={10} /> Correction
                              </span>
                            )}

                            {isOverdue && (
                              <span style={{ padding: "2px 6px", borderRadius: "var(--r-sm)", fontSize: "10px", fontWeight: 700, background: "var(--red)", color: "#000", display: "flex", alignItems: "center", gap: "3px" }}>
                                <AlertTriangle size={10} /> Overdue
                              </span>
                            )}

                            {task.priority && (
                              <span style={{ padding: "2px 6px", borderRadius: "var(--r-sm)", fontSize: "10px", fontWeight: 700, ...priorityStyle }}>
                                {task.priority}
                              </span>
                            )}
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "11px" }}>
                            <span style={{ color: "var(--muted)" }}>
                              Client: <b style={{ color: "var(--text)" }}>{task.client_name || `Client #${task.client}`}</b>
                            </span>
                            <span style={{ color: isOverdue ? "var(--red)" : "var(--muted)" }}>
                              Due: <b style={{ color: isOverdue ? "var(--red)" : "var(--text)" }}>{task.due_date || "N/A"}</b>
                            </span>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", fontSize: "11px", paddingTop: "4px", borderTop: "1px solid rgba(70,150,105,0.15)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "var(--muted)" }}>
                            <span>Reviewer: <b style={{ color: "var(--text)" }}>{task.reviewer_name || "Unassigned"}</b></span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: "120px" }}>
                            <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--neon)", fontFamily: "monospace" }}>{progressPct}%</span>
                            <div className="pbar" style={{ flex: 1, margin: 0 }}><div className="pfill g" style={{ width: `${progressPct}%` }} /></div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
