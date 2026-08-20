"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Award,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Layers,
  Minus,
  PieChart,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Star,
  Target,
  Trophy,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserRound,
  Users,
  Zap,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Department, KPIDashboardData, KPIEmployeeData, KPIGrade } from "@/lib/types";

const DEPARTMENTS: Department[] = [
  "Web Development",
  "Video Editing",
  "Design",
  "Digital Marketing",
  "Accountant",
  "HR",
  "Operations",
];

const GRADES: KPIGrade[] = [
  "Outstanding",
  "Excellent",
  "Good",
  "Needs Improvement",
  "Critical",
  "Not Evaluated",
];

function getGradeBadgeClass(grade?: KPIGrade) {
  switch (grade) {
    case "Outstanding":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-sm shadow-emerald-500/10";
    case "Excellent":
      return "bg-blue-500/15 text-blue-400 border-blue-500/30 shadow-sm shadow-blue-500/10";
    case "Good":
      return "bg-cyan-500/15 text-cyan-400 border-cyan-500/30 shadow-sm shadow-cyan-500/10";
    case "Needs Improvement":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-sm shadow-amber-500/10";
    case "Critical":
      return "bg-rose-500/15 text-rose-400 border-rose-500/30 shadow-sm shadow-rose-500/10";
    case "Not Evaluated":
      return "bg-slate-500/15 text-slate-300 border-slate-500/30";
    default:
      return "bg-slate-500/15 text-slate-400 border-slate-500/30";
  }
}

function scoreOutOf10(score: number | undefined) {
  return Number(((score ?? 0) / 10).toFixed(1));
}

export function KPIDashboardPage({ basePath = "/admin" }: { basePath?: string }) {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [department, setDepartment] = useState("");
  const [grade, setGrade] = useState("");
  const [search, setSearch] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);

  const getEmployeeKPIHref = (empId: number) => {
    const cleanBase = (basePath || "/admin").replace(/\/+$/, "");
    if (cleanBase.endsWith("/kpi")) {
      return `${cleanBase}/${empId}`;
    }
    return `${cleanBase}/kpi/${empId}`;
  };

  // Table Sorting & Pagination State
  const [sortBy, setSortBy] = useState<"score_desc" | "score_asc" | "name" | "dept">("score_desc");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const [data, setData] = useState<KPIDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Searchable Employee Combobox State
  const [employeeSearchOpen, setEmployeeSearchOpen] = useState(false);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("month", String(selectedMonth));
      params.set("year", String(selectedYear));
      if (department) params.set("department", department);
      if (grade) params.set("grade", grade);
      if (search) params.set("search", search);

      const res = await api<KPIDashboardData>(`/kpi/dashboard/?${params.toString()}`);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load KPI dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [selectedMonth, selectedYear, department, grade, search]);

  // Click outside to close employee dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setEmployeeSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const resetFilters = () => {
    setDepartment("");
    setGrade("");
    setSearch("");
    setSelectedEmployeeId(null);
    setEmployeeSearchQuery("");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    Boolean(department) ||
    Boolean(grade) ||
    Boolean(search) ||
    selectedEmployeeId !== null;

  const selectedEmployeeData = selectedEmployeeId
    ? data?.employees.find((e) => e.employee_id === selectedEmployeeId)
    : null;

  const filteredEmployeesForDropdown = (data?.employees || []).filter((emp) => {
    if (!employeeSearchQuery.trim()) return true;
    const q = employeeSearchQuery.toLowerCase();
    return (
      emp.employee_name.toLowerCase().includes(q) ||
      emp.employee_code.toLowerCase().includes(q) ||
      emp.department.toLowerCase().includes(q)
    );
  });

  const evaluatedEmployees = (data?.employees || []).filter((emp) => emp.is_evaluated);

  // Calculate highest & lowest performers from employees with actual assigned work.
  const sortedByScore = [...evaluatedEmployees].sort((a, b) => b.final_score - a.final_score);
  const highestPerformer = sortedByScore.length > 0 ? sortedByScore[0] : null;
  const lowestPerformer = sortedByScore.length > 0 ? sortedByScore[sortedByScore.length - 1] : null;

  // Grade Distribution Counts
  const gradeDistribution = GRADES.map((g) => {
    const count = (data?.employees || []).filter((e) => e.grade === g).length;
    const pct = data?.total_employees ? Number(((count / data.total_employees) * 100).toFixed(1)) : 0;
    return { grade: g, count, pct };
  });

  const outstandingCount = (data?.employees || []).filter(
    (e) => e.grade === "Outstanding" || e.grade === "Excellent"
  ).length;

  const criticalCount = evaluatedEmployees.filter(
    (e) => e.grade === "Critical" || e.grade === "Needs Improvement" || e.final_score < 75
  ).length;

  const companyComponentAverages = (() => {
    if (evaluatedEmployees.length === 0) return null;
    const count = evaluatedEmployees.length;
    let work = 0, att = 0, onTime = 0, leave = 0, quality = 0;
    for (const emp of evaluatedEmployees) {
      work += emp.components.work_completion?.score || 0;
      att += emp.components.attendance?.score || 0;
      onTime += emp.components.on_time_delivery?.score || 0;
      leave += emp.components.leave_discipline?.score || 0;
      quality += emp.components.work_quality?.score || 0;
    }
    return {
      work_completion: Number((work / count).toFixed(1)),
      attendance: Number((att / count).toFixed(1)),
      on_time_delivery: Number((onTime / count).toFixed(1)),
      leave_discipline: Number((leave / count).toFixed(1)),
      work_quality: Number((quality / count).toFixed(1)),
    };
  })();

  const activeComponents = selectedEmployeeData
    ? {
        work_completion: selectedEmployeeData.components.work_completion?.score || 0,
        attendance: selectedEmployeeData.components.attendance?.score || 0,
        on_time_delivery: selectedEmployeeData.components.on_time_delivery?.score || 0,
        leave_discipline: selectedEmployeeData.components.leave_discipline?.score || 0,
        work_quality: selectedEmployeeData.components.work_quality?.score || 0,
      }
    : companyComponentAverages;

  // Process Employees Table with Sorting & Pagination
  const processedEmployees = [...(data?.employees || [])]
    .filter((emp) => selectedEmployeeId === null || emp.employee_id === selectedEmployeeId)
    .sort((a, b) => {
      if (sortBy === "score_desc") return b.final_score - a.final_score;
      if (sortBy === "score_asc") return a.final_score - b.final_score;
      if (sortBy === "name") return a.employee_name.localeCompare(b.employee_name);
      if (sortBy === "dept") return a.department.localeCompare(b.department);
      return 0;
    });

  const totalPages = Math.ceil(processedEmployees.length / pageSize) || 1;
  const paginatedEmployees = processedEmployees.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const inputControlClasses =
    "w-full text-xs bg-white border border-[#dad7ce] rounded-xl px-3 py-2 text-[#1a1b1e] focus:outline-none focus:border-[#cba86e] focus:ring-1 focus:ring-[#cba86e]/25 transition cursor-pointer font-medium";

  return (
    <div className="kpi-dashboard w-full max-w-7xl mx-auto space-y-6 text-slate-100 font-sans">
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-4 rounded-xl text-xs flex items-center gap-2">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* 6. Enterprise Performance Table Section */}
      <div className="kpi-table-panel bg-white border border-[#dad7ce] rounded-2xl overflow-hidden shadow-sm space-y-0">
        <div className="p-5 border-b border-[#dad7ce] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-[#1a1b1e] flex items-center gap-2">
              <UserCheck size={16} className="text-[#cba86e]" />
              Employee Performance Directory ({processedEmployees.length})
            </h3>
            <p className="text-[11px] text-[#6b707d] mt-0.5">
              Click View Details for full metric breakdown and evaluation options.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:w-56">
              <input
                type="text"
                placeholder="Search table..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="w-full text-xs bg-white border border-[#dad7ce] rounded-xl px-3 py-2 text-[#1a1b1e] focus:outline-none focus:border-[#cba86e]"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value as any); setCurrentPage(1); }}
              className="text-xs bg-white border border-[#dad7ce] rounded-xl px-3 py-2 text-[#1a1b1e] focus:outline-none focus:border-[#cba86e] cursor-pointer font-medium"
            >
              <option value="score_desc" className="bg-white text-[#1a1b1e]">Sort: Highest Score</option>
              <option value="score_asc" className="bg-white text-[#1a1b1e]">Sort: Lowest Score</option>
              <option value="name" className="bg-white text-[#1a1b1e]">Sort: Name (A-Z)</option>
              <option value="dept" className="bg-white text-[#1a1b1e]">Sort: Department</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f6f5f1] text-[#5c606b] border-b border-[#dad7ce] font-semibold tracking-wider uppercase text-[10px] sticky top-0 z-10">
              <tr>
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-4">Department</th>
                <th className="py-3.5 px-4">KPI Score / 10</th>
                <th className="py-3.5 px-4">Grade</th>
                <th className="py-3.5 px-4">Performance Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8e6e1] text-[#1a1b1e]">
              {loading && !data && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#6b707d]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={20} className="animate-spin text-[#cba86e]" />
                      <span>Loading performance records...</span>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && data && paginatedEmployees.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#6b707d]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users size={24} className="text-[#8a8e99]" />
                      <span>No employee records match the selected criteria.</span>
                    </div>
                  </td>
                </tr>
              )}
              {paginatedEmployees.map((emp) => {
                const trendType = !emp.is_evaluated
                  ? "not_evaluated"
                  : emp.final_score >= 85
                  ? "up"
                  : emp.final_score < 75
                  ? "down"
                  : "stable";

                return (
                  <tr key={emp.employee_id} className="hover:bg-[#f9f8f4] transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#f9f8f4] border border-[#dad7ce] flex items-center justify-center font-extrabold text-[#a8874e] text-xs">
                          {emp.employee_name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-[#1a1b1e]">{emp.employee_name}</div>
                          <div className="text-[10px] text-[#6b707d] font-mono">
                            {emp.employee_code} / {emp.designation}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-[#1a1b1e]">{emp.department}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-extrabold text-sm text-[#1a1b1e]">
                        {emp.is_evaluated ? emp.score_out_of_10 ?? scoreOutOf10(emp.final_score) : "N/A"}
                      </span>
                      {emp.is_evaluated && <span className="text-[10px] text-[#6b707d] font-normal"> / 10</span>}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getGradeBadgeClass(
                          emp.grade
                        )}`}
                      >
                        {emp.grade}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {trendType === "up" && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#a8874e]">
                          <ArrowUpRight size={14} /> High
                        </span>
                      )}
                      {trendType === "down" && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#df7d6e]">
                          <ArrowDownRight size={14} /> Attention
                        </span>
                      )}
                      {trendType === "stable" && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6b707d]">
                          <Minus size={14} /> Steady
                        </span>
                      )}
                      {trendType === "not_evaluated" && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6b707d]">
                          <Minus size={14} /> Not evaluated
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={getEmployeeKPIHref(emp.employee_id)}
                        className="inline-flex items-center gap-1 text-[#a8874e] hover:text-[#cba86e] font-semibold text-xs hover:underline"
                      >
                        View Details <ChevronRight size={13} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-[#dad7ce] flex items-center justify-between text-xs text-[#6b707d]">
            <span>
              Showing <span className="text-[#1a1b1e] font-semibold">{((currentPage - 1) * pageSize) + 1}</span> to{" "}
              <span className="text-[#1a1b1e] font-semibold">{Math.min(currentPage * pageSize, processedEmployees.length)}</span> of{" "}
              <span className="text-[#1a1b1e] font-semibold">{processedEmployees.length}</span> employees
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 bg-white border border-[#dad7ce] rounded-lg text-[#1a1b1e] hover:bg-[#f6f5f1] disabled:opacity-40 transition"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="font-mono text-[#1a1b1e]">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 bg-white border border-[#dad7ce] rounded-lg text-[#1a1b1e] hover:bg-[#f6f5f1] disabled:opacity-40 transition"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
