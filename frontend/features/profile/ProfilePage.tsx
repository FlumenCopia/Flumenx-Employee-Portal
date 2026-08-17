"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  User,
  Building2,
  MapPin,
  Mail,
  Layers,
  TrendingUp,
  Filter,
  CheckCheck,
  Award,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { Avatar } from "@/components/icons";
import { PageHeader, EmptyState } from "@/components/ui";
import { useShellUser } from "@/components/shell";
import { api } from "@/lib/api";
import type { WorkAssignment, Paginated, KPIEmployeeData, Client } from "@/lib/types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function getStatusBadgeClass(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "published" || s === "completed" || s === "approved") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  if (s === "in review") return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  if (s === "in progress") return "bg-blue-500/10 text-blue-400 border-blue-500/20";
  return "bg-slate-500/10 text-slate-400 border-slate-500/20";
}

function getPriorityBadgeClass(priority: string) {
  const p = (priority || "").toLowerCase();
  if (p === "urgent" || p === "high") return "bg-rose-500/10 text-rose-400 border-rose-500/20";
  if (p === "normal") return "bg-sky-500/10 text-sky-400 border-sky-500/20";
  return "bg-slate-500/10 text-slate-400 border-slate-500/20";
}

function getStatusProgressPct(status: string, assignedQty: number, completedQty: number): number {
  if (assignedQty > 0) {
    return Math.min(100, Math.max(0, Math.round((completedQty / assignedQty) * 100)));
  }
  const s = (status || "").toLowerCase();
  if (s === "published" || s === "completed") return 100;
  if (s === "approved") return 75;
  if (s === "in review") return 50;
  if (s === "in progress") return 25;
  return 0;
}

export function ProfilePage() {
  const user = useShellUser();
  const [assignments, setAssignments] = useState<WorkAssignment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [kpiData, setKpiData] = useState<KPIEmployeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>((currentDate.getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState<string>(currentDate.getFullYear().toString());
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"current" | "published" | "all">("current");

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

  const currentAssignments = useMemo(() => {
    return filteredAssignments.filter((a) => a.status !== "Published" && a.status !== "Completed");
  }, [filteredAssignments]);

  const publishedAssignments = useMemo(() => {
    return filteredAssignments.filter((a) => a.status === "Published" || a.status === "Completed");
  }, [filteredAssignments]);

  const displayedAssignments = useMemo(() => {
    if (activeTab === "current") return currentAssignments;
    if (activeTab === "published") return publishedAssignments;
    return filteredAssignments;
  }, [activeTab, currentAssignments, publishedAssignments, filteredAssignments]);

  const summaryStats = useMemo(() => {
    let totalAssignedQty = 0;
    let totalCompletedQty = 0;

    let assignedCount = 0;
    let inProgressCount = 0;
    let inReviewCount = 0;
    let approvedCount = 0;
    let publishedCount = 0;

    filteredAssignments.forEach((a) => {
      totalAssignedQty += a.assigned_quantity || 0;
      totalCompletedQty += a.completed_quantity || 0;

      const s = (a.status || "").toLowerCase();
      if (s === "assigned") assignedCount++;
      else if (s === "in progress") inProgressCount++;
      else if (s === "in review") inReviewCount++;
      else if (s === "approved") approvedCount++;
      else if (s === "published" || s === "completed") publishedCount++;
    });

    const overallProgress = totalAssignedQty > 0
      ? Math.min(100, Math.round((totalCompletedQty / totalAssignedQty) * 100))
      : 0;

    return {
      totalTasks: filteredAssignments.length,
      totalAssignedQty,
      totalCompletedQty,
      overallProgress,
      assignedCount,
      inProgressCount,
      inReviewCount,
      approvedCount,
      publishedCount,
    };
  }, [filteredAssignments]);

  const clientGroupedWork = useMemo(() => {
    const groups: Record<
      string,
      {
        clientName: string;
        tasks: WorkAssignment[];
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
          assignedQty: 0,
          completedQty: 0,
          progressPct: 0,
        };
      }
      groups[cName].tasks.push(task);
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

    return Object.values(groups).sort((a, b) => b.tasks.length - a.tasks.length);
  }, [displayedAssignments]);

  if (!user) {
    return <EmptyState title="No profile found" text="Your account profile is not available." />;
  }

  const e = user.employee;
  const name = e?.name || user.first_name || user.email || user.username;
  const code = e?.employee_code || "FLX-EMP";
  const designation = e?.designation || user.portal_role;
  const department = e?.department || "General";
  const location = e?.location || "India HQ";
  const joined = e?.joining_date
    ? new Date(e.joining_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "Active";
  const status = e?.status || "Active";
  const email = e?.email || user.email || user.username;
  const phone = e?.phone || "Not specified";

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        eyebrow="WORK & PERFORMANCE"
        title="Employee Work Profile"
        subtitle="Personal dashboard for assigned tasks, work completion progress, and client deliverables."
      />

      {/* 1. COMPACT PROFESSIONAL PROFILE HEADER CARD */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 left-0 h-2 bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-500" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <Avatar name={name} size={72} />
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-[rgba(77,255,160,0.12)] text-[var(--neon)] border border-[rgba(77,255,160,0.2)]">
                  {code}
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {status}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-[var(--text)] mt-1">{name}</h2>
              <p className="text-sm font-medium text-sky-400">{designation}</p>
            </div>
          </div>

          {/* Quick Facts Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full md:w-auto text-xs">
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400 block flex items-center gap-1.5 mb-1">
                <Building2 size={13} className="text-emerald-400" /> Department
              </span>
              <strong className="text-slate-200 block truncate">{department}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400 block flex items-center gap-1.5 mb-1">
                <Mail size={13} className="text-sky-400" /> Email
              </span>
              <strong className="text-slate-200 block truncate" title={email}>{email}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400 block flex items-center gap-1.5 mb-1">
                <MapPin size={13} className="text-rose-400" /> Location
              </span>
              <strong className="text-slate-200 block truncate">{location}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400 block flex items-center gap-1.5 mb-1">
                <Calendar size={13} className="text-amber-400" /> Joined
              </span>
              <strong className="text-slate-200 block truncate">{joined}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400 block flex items-center gap-1.5 mb-1">
                <User size={13} className="text-indigo-400" /> Phone
              </span>
              <strong className="text-slate-200 block truncate">{phone}</strong>
            </div>
            {kpiData && (
              <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50">
                <span className="text-emerald-400 block flex items-center gap-1.5 mb-1">
                  <Award size={13} /> Monthly KPI
                </span>
                <strong className="text-emerald-200 block">
                  {kpiData.score_out_of_10} / 10 &bull; {kpiData.grade}
                </strong>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. FILTERS CONTROL BAR */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
          <Filter size={16} className="text-[var(--neon)]" />
          <span>Work Filters</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs flex-1 max-w-3xl">
          {/* Month Filter */}
          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[var(--neon)]"
            >
              <option value="all">All Months</option>
              {MONTH_NAMES.map((m, idx) => (
                <option key={m} value={(idx + 1).toString()}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[var(--neon)]"
            >
              <option value="all">All Years</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Client Filter */}
          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Client</label>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[var(--neon)]"
            >
              <option value="all">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[var(--neon)]"
            >
              <option value="all">All Statuses</option>
              <option value="Assigned">Assigned</option>
              <option value="In Progress">In Progress</option>
              <option value="In Review">In Review</option>
              <option value="Approved">Approved</option>
              <option value="Published">Published</option>
            </select>
          </div>
        </div>

        {/* Quick Reset Shortcut */}
        {(selectedMonth !== "all" || selectedYear !== "all" || selectedClient !== "all" || selectedStatus !== "all") && (
          <button
            type="button"
            onClick={() => {
              setSelectedMonth("all");
              setSelectedYear("all");
              setSelectedClient("all");
              setSelectedStatus("all");
            }}
            className="text-xs font-medium text-emerald-400 hover:underline self-end md:self-center"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* 3. WORK PROGRESS SUMMARY CARDS & MAIN OVERALL BAR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Main Progress Card */}
        <div className="md:col-span-2 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <TrendingUp size={15} className="text-[var(--neon)]" /> Overall Work Progress
              </span>
              <span className="text-2xl font-black text-[var(--neon)]">
                {summaryStats.overallProgress}%
              </span>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden p-0.5 border border-slate-800 mb-3">
              <div
                className="bg-gradient-to-r from-emerald-500 via-sky-400 to-teal-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${summaryStats.overallProgress}%` }}
              />
            </div>
            <p className="text-xs text-slate-400">
              Formula: Total Completed Qty ({summaryStats.totalCompletedQty}) / Total Assigned Qty ({summaryStats.totalAssignedQty || summaryStats.totalTasks * 100}) &times; 100
            </p>
          </div>

          <div className="grid grid-cols-5 gap-2 mt-4 pt-3 border-t border-slate-800 text-center">
            <div className="p-1.5 rounded-lg bg-slate-900/50">
              <span className="text-[10px] text-slate-400 block">Assigned</span>
              <strong className="text-sm font-bold text-slate-300">{summaryStats.assignedCount}</strong>
            </div>
            <div className="p-1.5 rounded-lg bg-blue-950/30">
              <span className="text-[10px] text-blue-400 block">In Progress</span>
              <strong className="text-sm font-bold text-blue-300">{summaryStats.inProgressCount}</strong>
            </div>
            <div className="p-1.5 rounded-lg bg-amber-950/30">
              <span className="text-[10px] text-amber-400 block">In Review</span>
              <strong className="text-sm font-bold text-amber-300">{summaryStats.inReviewCount}</strong>
            </div>
            <div className="p-1.5 rounded-lg bg-sky-950/30">
              <span className="text-[10px] text-sky-400 block">Approved</span>
              <strong className="text-sm font-bold text-sky-300">{summaryStats.approvedCount}</strong>
            </div>
            <div className="p-1.5 rounded-lg bg-emerald-950/30">
              <span className="text-[10px] text-emerald-400 block">Published</span>
              <strong className="text-sm font-bold text-emerald-300">{summaryStats.publishedCount}</strong>
            </div>
          </div>
        </div>

        {/* Task Volume Stat Card */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Briefcase size={15} className="text-sky-400" /> Total Tasks
            </span>
            <span className="text-3xl font-black text-white">{summaryStats.totalTasks}</span>
          </div>
          <div className="space-y-2 my-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1">
                <Clock size={13} className="text-blue-400" /> Current Work
              </span>
              <strong className="text-blue-300">{currentAssignments.length}</strong>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1">
                <CheckCheck size={13} className="text-emerald-400" /> Published History
              </span>
              <strong className="text-emerald-300">{publishedAssignments.length}</strong>
            </div>
          </div>
          {kpiData ? (
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
              <span className="text-slate-400 block">Current KPI Status</span>
              <span className="font-bold text-emerald-400">
                {kpiData.score_out_of_10} / 10 ({kpiData.grade})
              </span>
            </div>
          ) : (
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400">
              Select specific Month &amp; Year for KPI score
            </div>
          )}
        </div>
      </div>

      {/* 4. WORK SECTION WITH TABS (CURRENT VS PUBLISHED) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          {/* Tab Switcher */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("current")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
                activeTab === "current"
                  ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              <Clock size={14} />
              Current Work ({currentAssignments.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("published")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
                activeTab === "published"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              <CheckCheck size={14} />
              Published History ({publishedAssignments.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
                activeTab === "all"
                  ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              <Layers size={14} />
              All Assigned ({filteredAssignments.length})
            </button>
          </div>
        </div>

        {/* Loading & Error States */}
        {loading && (
          <div className="p-8 text-center text-slate-400 text-sm">
            Loading employee work profile data...
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Empty States */}
        {!loading && !error && clientGroupedWork.length === 0 && (
          <EmptyState
            title={
              activeTab === "published"
                ? "No published work found"
                : activeTab === "current"
                ? "No current active work"
                : "No work assigned"
            }
            text={
              filteredAssignments.length === 0
                ? "No tasks match the selected month, year, client, or status filter criteria."
                : activeTab === "published"
                ? "You have no completed or published work records in this selection."
                : "All assigned work for this selection has been published or completed."
            }
          />
        )}

        {/* 5. CLIENT-WISE WORK GROUPS */}
        {!loading && !error && clientGroupedWork.map((clientGroup) => (
          <div
            key={clientGroup.clientName}
            className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5 space-y-4"
          >
            {/* Client Header & Progress */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/60 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Client</span>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Building2 size={18} className="text-sky-400" />
                  {clientGroup.clientName}
                  <span className="text-xs font-semibold text-slate-400">
                    ({clientGroup.tasks.length} {clientGroup.tasks.length === 1 ? "task" : "tasks"})
                  </span>
                </h3>
              </div>

              {/* Client Progress Formula */}
              <div className="sm:text-right min-w-[200px]">
                <div className="flex items-center justify-between sm:justify-end gap-2 text-xs font-bold mb-1">
                  <span className="text-slate-400">Client Progress</span>
                  <span className="text-emerald-400">{clientGroup.progressPct}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${clientGroup.progressPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Task List under this Client */}
            <div className="grid grid-cols-1 gap-3">
              {clientGroup.tasks.map((task) => {
                const progressPct = getStatusProgressPct(
                  task.status,
                  task.assigned_quantity,
                  task.completed_quantity
                );
                return (
                  <div
                    key={task.id}
                    className="rounded-lg bg-slate-900/60 border border-slate-800/80 p-3.5 hover:border-slate-700 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs"
                  >
                    {/* Left: Task Info */}
                    <div className="space-y-1 max-w-xl">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-100 text-sm">{task.title}</span>
                        <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${getStatusBadgeClass(task.status)}`}>
                          {task.status}
                        </span>
                        <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${getPriorityBadgeClass(task.priority)}`}>
                          {task.priority} Priority
                        </span>
                        {task.employee_department && (
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                            {task.employee_department}
                          </span>
                        )}
                      </div>

                      {task.description && (
                        <p className="text-slate-400 line-clamp-1">{task.description}</p>
                      )}

                      <div className="flex items-center gap-4 text-[11px] text-slate-400 flex-wrap pt-1">
                        <span>Assigned: <strong className="text-slate-300">{task.assigned_date || "N/A"}</strong></span>
                        <span>Due: <strong className="text-slate-300">{task.due_date || "N/A"}</strong></span>
                        {task.reviewer_name && (
                          <span>Reviewer: <strong className="text-slate-300">{task.reviewer_name}</strong></span>
                        )}
                        {task.unit && (
                          <span>Qty: <strong className="text-emerald-400">{task.completed_quantity || 0} / {task.assigned_quantity || 0} {task.unit}</strong></span>
                        )}
                      </div>
                    </div>

                    {/* Right: Progress Meter */}
                    <div className="w-full md:w-48 space-y-1 self-stretch md:self-center">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Progress</span>
                        <span className="font-bold text-sky-400">{progressPct}%</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800 p-0.5">
                        <div
                          className="bg-sky-400 h-full rounded-full transition-all duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
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
