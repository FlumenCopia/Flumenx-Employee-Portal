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
      work += emp.components.work_completion.score;
      att += emp.components.attendance.score;
      onTime += emp.components.on_time_delivery.score;
      leave += emp.components.leave_discipline.score;
      quality += emp.components.work_quality.score;
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
        work_completion: selectedEmployeeData.components.work_completion.score,
        attendance: selectedEmployeeData.components.attendance.score,
        on_time_delivery: selectedEmployeeData.components.on_time_delivery.score,
        leave_discipline: selectedEmployeeData.components.leave_discipline.score,
        work_quality: selectedEmployeeData.components.work_quality.score,
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
    "w-full text-xs bg-slate-950 border border-slate-800/80 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition appearance-none cursor-pointer";

  return (
    <div className="kpi-dashboard w-full max-w-7xl mx-auto space-y-6 text-slate-100 font-sans">
      {/* 1. Large Modern Header Section */}
      <div className="kpi-hero flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 shadow-md shadow-emerald-500/10">
              <TrendingUp size={24} />
            </div>
            KPI Performance Dashboard
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            Enterprise employee evaluation, component score tracking, department analytics, and grade distribution.
          </p>
        </div>

        <div className="kpi-hero-actions flex items-center gap-3">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl transition"
            >
              <X size={14} className="text-emerald-400" />
              Reset Filters
            </button>
          )}

        </div>
      </div>

      {/* 2. Premium Filter Toolbar Panel */}
      <div className="kpi-filter-panel bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4 backdrop-blur-md">
        <div className="kpi-panel-head flex items-center justify-between text-xs font-semibold text-slate-300 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-emerald-400" />
            <span>Filter Performance Records</span>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-emerald-400 hover:text-emerald-300 transition flex items-center gap-1 font-normal"
            >
              <X size={13} /> Clear Filters
            </button>
          )}
        </div>

        <div className="kpi-filter-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Month */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1 font-medium">Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => { setSelectedMonth(Number(e.target.value)); setCurrentPage(1); }}
              className={inputControlClasses}
            >
              {[
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
              ].map((m, i) => (
                <option key={m} value={i + 1} className="bg-slate-950 text-slate-200">{m}</option>
              ))}
            </select>
          </div>

          {/* Year */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1 font-medium">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => { setSelectedYear(Number(e.target.value)); setCurrentPage(1); }}
              className={inputControlClasses}
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y} className="bg-slate-950 text-slate-200">{y}</option>
              ))}
            </select>
          </div>

          {/* Department */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1 font-medium">Department</label>
            <select
              value={department}
              onChange={(e) => { setDepartment(e.target.value); setCurrentPage(1); }}
              className={inputControlClasses}
            >
              <option value="" className="bg-slate-950 text-slate-200">All Departments</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d} className="bg-slate-950 text-slate-200">{d}</option>
              ))}
            </select>
          </div>

          {/* Grade */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1 font-medium">Grade</label>
            <select
              value={grade}
              onChange={(e) => { setGrade(e.target.value); setCurrentPage(1); }}
              className={inputControlClasses}
            >
              <option value="" className="bg-slate-950 text-slate-200">All Grades</option>
              {GRADES.map((g) => (
                <option key={g} value={g} className="bg-slate-950 text-slate-200">{g}</option>
              ))}
            </select>
          </div>

          {/* Searchable Employee Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <label className="block text-[11px] text-slate-400 mb-1 font-medium">Select Employee</label>
            <button
              type="button"
              onClick={() => setEmployeeSearchOpen((open) => !open)}
              className={`${inputControlClasses} flex items-center justify-between text-left truncate`}
            >
              <span className="truncate text-slate-200">
                {selectedEmployeeData ? selectedEmployeeData.employee_name : "All Employees"}
              </span>
              <ChevronDown size={14} className="text-slate-400 shrink-0 ml-1" />
            </button>

            {employeeSearchOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-30 p-2 space-y-2 max-h-60 overflow-y-auto">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search name, code, dept..."
                    value={employeeSearchQuery}
                    onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                    className="w-full text-xs bg-slate-900 border border-slate-800 rounded-lg pl-7 pr-3 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                    autoFocus
                  />
                  <Search size={12} className="absolute left-2.5 top-2.5 text-slate-500" />
                </div>

                <div className="space-y-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEmployeeId(null);
                      setEmployeeSearchOpen(false);
                      setEmployeeSearchQuery("");
                      setCurrentPage(1);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg transition ${
                      selectedEmployeeId === null
                        ? "bg-emerald-500/20 text-emerald-400 font-semibold"
                        : "text-slate-300 hover:bg-slate-900"
                    }`}
                  >
                    All Employees
                  </button>

                  {filteredEmployeesForDropdown.map((emp) => (
                    <button
                      key={emp.employee_id}
                      type="button"
                      onClick={() => {
                        setSelectedEmployeeId(emp.employee_id);
                        setEmployeeSearchOpen(false);
                        setEmployeeSearchQuery("");
                        setCurrentPage(1);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg transition flex items-center justify-between ${
                        selectedEmployeeId === emp.employee_id
                          ? "bg-emerald-500/20 text-emerald-400 font-semibold"
                          : "text-slate-300 hover:bg-slate-900"
                      }`}
                    >
                      <div className="truncate">
                        <span className="font-medium text-white">{emp.employee_name}</span>
                        <span className="text-[10px] text-slate-400 ml-1.5">({emp.department})</span>
                      </div>
                      <span className="text-[11px] font-mono text-emerald-400 ml-2 font-bold">
                        {emp.is_evaluated ? emp.score_out_of_10 ?? scoreOutOf10(emp.final_score) : "N/A"}
                      </span>
                    </button>
                  ))}

                  {filteredEmployeesForDropdown.length === 0 && (
                    <div className="text-[11px] text-slate-500 p-2 text-center">No matching employees</div>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-4 rounded-xl text-xs flex items-center gap-2">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* 3. Summary Section Widget Cards Grid (6 Metric Cards) */}
      <div className="kpi-summary-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Total Evaluated */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 relative overflow-hidden shadow-lg hover:border-slate-700 transition hover:-translate-y-0.5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Evaluated</p>
              <h3 className="text-xl font-extrabold text-white mt-1 font-mono">{data?.evaluated_employees ?? evaluatedEmployees.length}</h3>
            </div>
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
              <Users size={18} />
            </div>
          </div>
          <p className="mt-2 text-[10px] text-slate-400">Evaluated from {data?.total_employees ?? 0} employees</p>
        </div>

        {/* Average KPI Score */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 relative overflow-hidden shadow-lg hover:border-slate-700 transition hover:-translate-y-0.5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Average KPI</p>
              <h3 className="text-xl font-extrabold text-white mt-1 font-mono">
                {data?.average_kpi_out_of_10 ?? scoreOutOf10(data?.average_kpi)} <span className="text-xs font-normal text-slate-500">/ 10</span>
              </h3>
            </div>
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl">
              <TrendingUp size={18} />
            </div>
          </div>
          <p className="mt-2 text-[10px] text-slate-400">Company-wide performance score</p>
        </div>

        {/* Outstanding Performers */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 relative overflow-hidden shadow-lg hover:border-slate-700 transition hover:-translate-y-0.5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Outstanding</p>
              <h3 className="text-xl font-extrabold text-emerald-400 mt-1 font-mono">{outstandingCount}</h3>
            </div>
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
              <Award size={18} />
            </div>
          </div>
          <p className="mt-2 text-[10px] text-slate-400">High performers (&ge; 8.5)</p>
        </div>

        {/* Needs Improvement */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 relative overflow-hidden shadow-lg hover:border-slate-700 transition hover:-translate-y-0.5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Needs Review</p>
              <h3 className="text-xl font-extrabold text-rose-400 mt-1 font-mono">{criticalCount}</h3>
            </div>
            <div className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">
              <AlertTriangle size={18} />
            </div>
          </div>
          <p className="mt-2 text-[10px] text-slate-400">Attention needed (&lt; 7.5)</p>
        </div>

        {/* Highest Score */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 relative overflow-hidden shadow-lg hover:border-slate-700 transition hover:-translate-y-0.5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Highest Score</p>
              <h3 className="text-xl font-extrabold text-emerald-400 mt-1 font-mono">
                {highestPerformer ? (highestPerformer.score_out_of_10 ?? scoreOutOf10(highestPerformer.final_score)) : "N/A"}
                {highestPerformer && <span className="text-xs font-normal text-slate-500"> / 10</span>}
              </h3>
            </div>
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
              <Trophy size={18} />
            </div>
          </div>
          <p className="mt-2 text-[10px] text-slate-300 truncate">
            {highestPerformer ? highestPerformer.employee_name : "N/A"}
          </p>
        </div>

        {/* Lowest Score */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 relative overflow-hidden shadow-lg hover:border-slate-700 transition hover:-translate-y-0.5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Lowest Score</p>
              <h3 className="text-xl font-extrabold text-rose-400 mt-1 font-mono">
                {lowestPerformer ? (lowestPerformer.score_out_of_10 ?? scoreOutOf10(lowestPerformer.final_score)) : "N/A"}
                {lowestPerformer && <span className="text-xs font-normal text-slate-500"> / 10</span>}
              </h3>
            </div>
            <div className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">
              <TrendingDown size={18} />
            </div>
          </div>
          <p className="mt-2 text-[10px] text-slate-300 truncate">
            {lowestPerformer ? lowestPerformer.employee_name : "N/A"}
          </p>
        </div>
      </div>

      {/* 4. Selected Employee Spotlight Banner */}
      {selectedEmployeeData ? (
        <div className="kpi-spotlight bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-extrabold text-xl shadow-lg shadow-emerald-500/10">
                {selectedEmployeeData.employee_name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-bold text-white">{selectedEmployeeData.employee_name}</h2>
                  <span className="text-xs text-slate-400 font-mono">({selectedEmployeeData.employee_code})</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedEmployeeData.department} / {selectedEmployeeData.designation}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-5">
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block font-medium">Evaluation Period</span>
                <span className="text-sm font-semibold text-white font-mono">
                  {selectedMonth}/{selectedYear}
                </span>
              </div>
              <div className="text-right pl-5 border-l border-slate-800">
                <span className="text-[11px] text-slate-400 block font-medium">KPI Score</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-2xl font-extrabold text-white font-mono">
                    {selectedEmployeeData.is_evaluated
                      ? selectedEmployeeData.score_out_of_10 ?? scoreOutOf10(selectedEmployeeData.final_score)
                      : "N/A"}
                    {selectedEmployeeData.is_evaluated && <span className="text-xs font-normal text-slate-500"> / 10</span>}
                  </span>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getGradeBadgeClass(
                      selectedEmployeeData.grade
                    )}`}
                  >
                    {selectedEmployeeData.grade}
                  </span>
                </div>
              </div>
              <Link
                href={`${basePath}/kpi/${selectedEmployeeData.employee_id}`}
                className="px-4 py-2.5 text-xs font-semibold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
              >
                View Full Details <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="kpi-empty-spotlight bg-slate-900/60 border border-slate-800/60 rounded-2xl p-4 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-emerald-400" />
            <span>Select an employee from the dropdown or performance table to highlight their spotlight metrics.</span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">Company Overview Mode</span>
        </div>
      )}

      {/* 5. Analytics Grid (Grade Distribution, Department Comparison, Monthly Trend, Top/Bottom Performers) */}
      <div className="kpi-analytics-grid grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department Average KPI Comparison */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 space-y-4 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Building2 size={16} className="text-emerald-400" />
              Department KPI Comparison
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">Avg KPI / 10</span>
          </div>

          {data?.department_averages && data.department_averages.length > 0 ? (
            <div className="space-y-4">
              {data.department_averages.map((dept) => (
                <div key={dept.department} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium text-slate-300">
                    <span className="truncate">
                      {dept.department} <span className="text-[10px] text-slate-500">({dept.employee_count} emp)</span>
                    </span>
                    <span className="font-bold font-mono text-white">
                      {dept.average_score_out_of_10 ?? scoreOutOf10(dept.average_score)} / 10
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800/80 p-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        dept.average_score >= 85
                          ? "bg-emerald-500"
                          : dept.average_score >= 75
                          ? "bg-blue-500"
                          : dept.average_score >= 60
                          ? "bg-amber-500"
                          : "bg-rose-500"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, dept.average_score))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-44 flex flex-col items-center justify-center text-xs text-slate-500 space-y-2">
              <BarChart3 size={24} className="text-slate-600" />
              <span>No department comparison data available.</span>
            </div>
          )}
        </div>

        {/* 6-Month Monthly KPI Trend Line Chart */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 space-y-4 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-400" />
              Monthly Performance Trend
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">Company Avg</span>
          </div>

          {data?.monthly_trend && data.monthly_trend.length > 0 ? (
            <div className="space-y-4">
              <div className="h-44 w-full pt-4 pb-2 relative">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 500 120">
                  <defs>
                    <linearGradient id="kpiTrendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {[20, 50, 80, 110].map((yVal, idx) => (
                    <line key={idx} x1="0" y1={yVal} x2="500" y2={yVal} stroke="#1e293b" strokeDasharray="3 3" strokeWidth="1" />
                  ))}

                  {(() => {
                    const points = data.monthly_trend.map((item, idx) => {
                      const x = (idx / (data.monthly_trend.length - 1)) * 480 + 10;
                      const y = 110 - (item.average_score / 100) * 100;
                      return {
                        x,
                        y,
                        score: item.average_score_out_of_10 ?? scoreOutOf10(item.average_score),
                        period: item.period,
                        isCurrent: item.month === selectedMonth,
                      };
                    });

                    const pathD = points.reduce((acc, pt, i) => `${acc} ${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`, "");
                    const areaD = `${pathD} L ${points[points.length - 1].x} 115 L ${points[0].x} 115 Z`;

                    return (
                      <>
                        <path d={areaD} fill="url(#kpiTrendGrad)" />
                        <path d={pathD} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        {points.map((pt, i) => (
                          <g key={i} className="group cursor-pointer">
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={pt.isCurrent ? "6" : "4"}
                              fill={pt.isCurrent ? "#10b981" : "#34d399"}
                              stroke="#020617"
                              strokeWidth="2"
                            />
                            <text
                              x={pt.x}
                              y={pt.y - 10}
                              textAnchor="middle"
                              fill={pt.isCurrent ? "#10b981" : "#cbd5e1"}
                              fontSize="10"
                              fontWeight={pt.isCurrent ? "bold" : "normal"}
                            >
                              {pt.score}
                            </text>
                          </g>
                        ))}
                      </>
                    );
                  })()}
                </svg>
              </div>

              <div className="flex justify-between border-t border-slate-800/80 pt-2 text-[11px] text-slate-400">
                {data.monthly_trend.map((item) => (
                  <span
                    key={item.period}
                    className={item.month === selectedMonth ? "text-emerald-400 font-bold" : ""}
                  >
                    {item.period}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-44 flex flex-col items-center justify-center text-xs text-slate-500 space-y-2">
              <TrendingUp size={24} className="text-slate-600" />
              <span>No historical trend data available.</span>
            </div>
          )}
        </div>

        {/* Grade Distribution Card */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 space-y-4 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <PieChart size={16} className="text-emerald-400" />
              Grade Distribution
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">5 Grade Tiers</span>
          </div>

          <div className="space-y-3 pt-1">
            {gradeDistribution.map((item) => (
              <div key={item.grade} className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-slate-300">
                  <span className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${getGradeBadgeClass(
                        item.grade as KPIGrade
                      )}`}
                    >
                      {item.grade}
                    </span>
                  </span>
                  <span className="font-mono font-bold text-white">
                    {item.count} <span className="text-[10px] text-slate-500 font-normal">({item.pct}%)</span>
                  </span>
                </div>
                <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800/80 p-0.5">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, item.pct))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 6. Enterprise Performance Table Section */}
      <div className="kpi-table-panel bg-slate-900/90 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl backdrop-blur-md space-y-0">
        <div className="p-5 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <UserCheck size={16} className="text-emerald-400" />
              Employee Performance Directory ({processedEmployees.length})
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
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
                className="w-full text-xs bg-slate-950 border border-slate-800/80 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value as any); setCurrentPage(1); }}
              className="text-xs bg-slate-950 border border-slate-800/80 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="score_desc">Sort: Highest Score</option>
              <option value="score_asc">Sort: Lowest Score</option>
              <option value="name">Sort: Name (A-Z)</option>
              <option value="dept">Sort: Department</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800/80 font-semibold tracking-wider uppercase text-[10px] sticky top-0 z-10">
              <tr>
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-4">Department</th>
                <th className="py-3.5 px-4">KPI Score / 10</th>
                <th className="py-3.5 px-4">Grade</th>
                <th className="py-3.5 px-4">Performance Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading && !data && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={20} className="animate-spin text-emerald-400" />
                      <span>Loading performance records...</span>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && data && paginatedEmployees.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users size={24} className="text-slate-600" />
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
                  <tr key={emp.employee_id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center font-extrabold text-emerald-400 text-xs shadow-inner">
                          {emp.employee_name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-white">{emp.employee_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {emp.employee_code} / {emp.designation}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-300">{emp.department}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-extrabold text-sm text-white">
                        {emp.is_evaluated ? emp.score_out_of_10 ?? scoreOutOf10(emp.final_score) : "N/A"}
                      </span>
                      {emp.is_evaluated && <span className="text-[10px] text-slate-500 font-normal"> / 10</span>}
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
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                          <ArrowUpRight size={14} /> High
                        </span>
                      )}
                      {trendType === "down" && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400">
                          <ArrowDownRight size={14} /> Attention
                        </span>
                      )}
                      {trendType === "stable" && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                          <Minus size={14} /> Steady
                        </span>
                      )}
                      {trendType === "not_evaluated" && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                          <Minus size={14} /> Not evaluated
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`${basePath}/kpi/${emp.employee_id}`}
                        className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold text-xs hover:underline"
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
          <div className="p-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>
              Showing <span className="text-white font-semibold">{((currentPage - 1) * pageSize) + 1}</span> to{" "}
              <span className="text-white font-semibold">{Math.min(currentPage * pageSize, processedEmployees.length)}</span> of{" "}
              <span className="text-white font-semibold">{processedEmployees.length}</span> employees
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 hover:text-white disabled:opacity-40 transition"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="font-mono text-slate-200">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 hover:text-white disabled:opacity-40 transition"
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
