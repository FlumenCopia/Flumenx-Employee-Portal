"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Award,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  FileSpreadsheet,
  Filter,
  Minus,
  RefreshCw,
  Search,
  Star,
  TrendingUp,
  UserCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { api, apiBlob } from "@/lib/api";
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
];

function getGradeBadgeClass(grade: KPIGrade) {
  switch (grade) {
    case "Outstanding":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "Excellent":
      return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    case "Good":
      return "bg-cyan-500/15 text-cyan-400 border-cyan-500/30";
    case "Needs Improvement":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "Critical":
      return "bg-rose-500/15 text-rose-400 border-rose-500/30";
    default:
      return "bg-slate-500/15 text-slate-400 border-slate-500/30";
  }
}

function getGradeColor(grade: KPIGrade) {
  switch (grade) {
    case "Outstanding":
      return "#10b981";
    case "Excellent":
      return "#3b82f6";
    case "Good":
      return "#06b6d4";
    case "Needs Improvement":
      return "#f59e0b";
    case "Critical":
      return "#f43f5e";
    default:
      return "#94a3b8";
  }
}

export function KPIDashboardPage({ basePath = "/admin" }: { basePath?: string }) {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [department, setDepartment] = useState("");
  const [grade, setGrade] = useState("");
  const [search, setSearch] = useState("");
  const [minScore, setMinScore] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);

  const [data, setData] = useState<KPIDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
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
      if (minScore) params.set("min_score", minScore);
      if (maxScore) params.set("max_score", maxScore);

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
  }, [selectedMonth, selectedYear, department, grade]);

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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadDashboard();
  };

  const handleCSVExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("month", String(selectedMonth));
      params.set("year", String(selectedYear));
      if (department) params.set("department", department);
      if (grade) params.set("grade", grade);
      if (search) params.set("search", search);
      if (minScore) params.set("min_score", minScore);
      if (maxScore) params.set("max_score", maxScore);

      const blob = await apiBlob(`/kpi/export-csv/?${params.toString()}`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `employee_kpis_${selectedYear}_${String(selectedMonth).padStart(2, "0")}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to download CSV export.");
    } finally {
      setExporting(false);
    }
  };

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

  const outstandingCount = (data?.employees || []).filter(
    (e) => e.grade === "Outstanding" || e.grade === "Excellent"
  ).length;

  const criticalCount = (data?.employees || []).filter(
    (e) => e.grade === "Critical" || e.grade === "Needs Improvement" || e.final_score < 75
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
              <TrendingUp size={22} />
            </div>
            KPI Performance Dashboard
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Monthly employee evaluation, component score tracking, and performance analytics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCSVExport}
            disabled={exporting}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-xl transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
          >
            <FileSpreadsheet size={15} />
            {exporting ? "Exporting..." : "Export CSV"}
          </button>

          <button
            onClick={loadDashboard}
            disabled={loading}
            className="p-2 text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl transition"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300 border-b border-slate-800/60 pb-2.5">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-indigo-400" />
            <span>Filter Performance Records</span>
          </div>
          {(department || grade || search || minScore || maxScore || selectedEmployeeId) && (
            <button
              onClick={() => {
                setDepartment("");
                setGrade("");
                setSearch("");
                setMinScore("");
                setMaxScore("");
                setSelectedEmployeeId(null);
                setEmployeeSearchQuery("");
              }}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1 font-normal"
            >
              <X size={13} /> Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Month */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1 font-medium">Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
            >
              {[
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
              ].map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>

          {/* Year */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1 font-medium">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Department */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1 font-medium">Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
            >
              <option value="">All Departments</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Grade */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1 font-medium">Grade</label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
            >
              <option value="">All Grades</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Searchable Employee Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <label className="block text-[11px] text-slate-400 mb-1 font-medium">Select Employee</label>
            <button
              type="button"
              onClick={() => setEmployeeSearchOpen((open) => !open)}
              className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 flex items-center justify-between focus:outline-none focus:border-indigo-500 transition truncate"
            >
              <span className="truncate">
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
                    className="w-full text-xs bg-slate-900 border border-slate-800 rounded-lg pl-7 pr-3 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
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
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg transition ${
                      selectedEmployeeId === null
                        ? "bg-indigo-600/20 text-indigo-400 font-semibold"
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
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg transition flex items-center justify-between ${
                        selectedEmployeeId === emp.employee_id
                          ? "bg-indigo-600/20 text-indigo-400 font-semibold"
                          : "text-slate-300 hover:bg-slate-900"
                      }`}
                    >
                      <div className="truncate">
                        <span className="font-medium text-white">{emp.employee_name}</span>
                        <span className="text-[10px] text-slate-400 ml-1.5">({emp.department})</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 ml-2">{emp.final_score}</span>
                    </button>
                  ))}

                  {filteredEmployeesForDropdown.length === 0 && (
                    <div className="text-[11px] text-slate-500 p-2 text-center">No matching employees</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Score Range & Submit */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1 font-medium">Min / Max Score</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                placeholder="Min"
                min="0"
                max="100"
                value={minScore}
                onChange={(e) => setMinScore(e.target.value)}
                className="w-1/2 text-xs bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
              <input
                type="number"
                placeholder="Max"
                min="0"
                max="100"
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
                className="w-1/2 text-xs bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-4 rounded-xl text-xs flex items-center gap-2">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Employee Spotlight Card (Triggers when a specific employee is selected) */}
      {selectedEmployeeData && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold text-lg">
                {selectedEmployeeData.employee_name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">{selectedEmployeeData.employee_name}</h2>
                  <span className="text-xs text-slate-400 font-mono">({selectedEmployeeData.employee_code})</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedEmployeeData.department} · {selectedEmployeeData.designation}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block font-medium">Evaluation Period</span>
                <span className="text-sm font-semibold text-white font-mono">
                  {selectedMonth}/{selectedYear}
                </span>
              </div>
              <div className="text-right pl-4 border-l border-slate-800">
                <span className="text-[11px] text-slate-400 block font-medium">Overall Score</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-extrabold text-white font-mono">{selectedEmployeeData.final_score}</span>
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
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition flex items-center gap-1.5"
              >
                View Full Details <ChevronRight size={14} />
              </Link>
            </div>
          </div>

          {/* Component Breakdown Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl">
              <span className="text-[10px] text-slate-400 block">Work Completion</span>
              <span className="text-sm font-bold text-white font-mono">
                {selectedEmployeeData.components.work_completion.score} <span className="text-[10px] text-slate-500 font-normal">/ 40</span>
              </span>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl">
              <span className="text-[10px] text-slate-400 block">Attendance</span>
              <span className="text-sm font-bold text-emerald-400 font-mono">
                {selectedEmployeeData.components.attendance.score} <span className="text-[10px] text-slate-500 font-normal">/ 20</span>
              </span>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl">
              <span className="text-[10px] text-slate-400 block">On-Time Delivery</span>
              <span className="text-sm font-bold text-blue-400 font-mono">
                {selectedEmployeeData.components.on_time_delivery.score} <span className="text-[10px] text-slate-500 font-normal">/ 15</span>
              </span>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl">
              <span className="text-[10px] text-slate-400 block">Leave Discipline</span>
              <span className="text-sm font-bold text-white font-mono">
                {selectedEmployeeData.components.leave_discipline.score} <span className="text-[10px] text-slate-500 font-normal">/ 10</span>
              </span>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl">
              <span className="text-[10px] text-slate-400 block">Work Quality</span>
              <span className="text-sm font-bold text-amber-400 font-mono">
                {selectedEmployeeData.components.work_quality.score} <span className="text-[10px] text-slate-500 font-normal">({selectedEmployeeData.components.work_quality.quality_rating}★)</span>
              </span>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl">
              <span className="text-[10px] text-slate-400 block">Consistency</span>
              <span className="text-sm font-bold text-cyan-400 font-mono">
                {selectedEmployeeData.components.consistency.score} <span className="text-[10px] text-slate-500 font-normal">/ 5</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Metric Cards Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Evaluated */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-lg">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Evaluated</p>
              <h3 className="text-2xl font-bold text-white mt-1.5">{data?.total_employees ?? 0}</h3>
            </div>
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
              <Users size={20} />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-400 flex items-center gap-1">
            <span className="text-slate-300 font-medium">{data?.total_employees ?? 0} active records</span> in {selectedMonth}/{selectedYear}
          </div>
        </div>

        {/* Average KPI Score */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-lg">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Average KPI Score</p>
              <h3 className="text-2xl font-bold text-white mt-1.5">
                {data?.average_kpi ?? 0} <span className="text-xs font-normal text-slate-500">/ 100</span>
              </h3>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-400">Company average across department</div>
        </div>

        {/* Outstanding / Excellent */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-lg">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Outstanding Performers</p>
              <h3 className="text-2xl font-bold text-emerald-400 mt-1.5">{outstandingCount}</h3>
            </div>
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
              <Award size={20} />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-400">Score &ge; 85 (Outstanding / Excellent)</div>
        </div>

        {/* Critical / Needs Improvement */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-lg">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Critical / Attention Required</p>
              <h3 className="text-2xl font-bold text-rose-400 mt-1.5">{criticalCount}</h3>
            </div>
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-400">Score &lt; 75 needing HR review</div>
        </div>
      </div>

      {/* Visual Analytics Grid: Line Chart for 6-Month Trend & Department Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 6-Month Monthly Trend Line Chart */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp size={16} className="text-indigo-400" />
              Monthly Performance Trend (Past 6 Months)
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">Company Avg Score</span>
          </div>

          {data?.monthly_trend && data.monthly_trend.length > 0 ? (
            <div className="space-y-4">
              {/* SVG Line Chart */}
              <div className="h-44 w-full pt-4 pb-2 relative">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 500 120">
                  <defs>
                    <linearGradient id="kpiTrendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Grid Lines */}
                  {[20, 50, 80, 110].map((yVal, idx) => (
                    <line key={idx} x1="0" y1={yVal} x2="500" y2={yVal} stroke="#1e293b" strokeDasharray="3 3" strokeWidth="1" />
                  ))}

                  {/* Construct Line Path */}
                  {(() => {
                    const points = data.monthly_trend.map((item, idx) => {
                      const x = (idx / (data.monthly_trend.length - 1)) * 480 + 10;
                      // map 0..100 to 110..10
                      const y = 110 - (item.average_score / 100) * 100;
                      return { x, y, score: item.average_score, period: item.period, isCurrent: item.month === selectedMonth };
                    });

                    const pathD = points.reduce((acc, pt, i) => `${acc} ${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`, "");
                    const areaD = `${pathD} L ${points[points.length - 1].x} 115 L ${points[0].x} 115 Z`;

                    return (
                      <>
                        <path d={areaD} fill="url(#kpiTrendGrad)" />
                        <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        {points.map((pt, i) => (
                          <g key={i} className="group cursor-pointer">
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={pt.isCurrent ? "6" : "4"}
                              fill={pt.isCurrent ? "#10b981" : "#818cf8"}
                              stroke="#0f172a"
                              strokeWidth="2"
                            />
                            {/* Score Tag above node */}
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

              {/* Month Labels */}
              <div className="flex justify-between border-t border-slate-800 pt-2 text-[11px] text-slate-400">
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
            <div className="h-40 flex items-center justify-center text-xs text-slate-500">
              No historical trend data available.
            </div>
          )}
        </div>

        {/* Department Averages Bar Analytics */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Building2 size={16} className="text-indigo-400" />
              Department KPI Performance Comparison
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">Avg Score / 100</span>
          </div>

          {data?.department_averages && data.department_averages.length > 0 ? (
            <div className="space-y-3.5">
              {data.department_averages.map((dept) => (
                <div key={dept.department} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium text-slate-300">
                    <span className="truncate">{dept.department} <span className="text-[10px] text-slate-500">({dept.employee_count} emp)</span></span>
                    <span className="font-bold font-mono text-white">{dept.average_score}</span>
                  </div>
                  <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800 p-0.5">
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
            <div className="h-40 flex items-center justify-center text-xs text-slate-500">
              No department comparison data available.
            </div>
          )}
        </div>
      </div>

      {/* Compact Employee KPI Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <UserCheck size={16} className="text-indigo-400" />
              Employee Performance Records ({data?.employees.length ?? 0})
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Simplified overview for fast comparison. Click View Details for full metric breakdown.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold tracking-wider uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">KPI Score</th>
                <th className="py-3 px-4">Grade</th>
                <th className="py-3 px-4">Monthly Trend</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading && !data && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Loading performance records...
                  </td>
                </tr>
              )}
              {!loading && data && data.employees.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No employee records match the selected filters.
                  </td>
                </tr>
              )}
              {data?.employees.map((emp) => {
                // Compute trend indicator (Up, Down, or Stable) based on score
                const trendType =
                  emp.final_score >= 85 ? "up" : emp.final_score < 75 ? "down" : "stable";

                return (
                  <tr key={emp.employee_id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300 text-xs">
                          {emp.employee_name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-white">{emp.employee_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {emp.employee_code} · {emp.designation}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-300">{emp.department}</td>
                    <td className="py-3 px-4">
                      <span className="font-mono font-extrabold text-sm text-white">{emp.final_score}</span>
                      <span className="text-[10px] text-slate-500 font-normal"> / 100</span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getGradeBadgeClass(
                          emp.grade
                        )}`}
                      >
                        {emp.grade}
                      </span>
                    </td>
                    <td className="py-3 px-4">
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
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`${basePath}/kpi/${emp.employee_id}`}
                        className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-semibold text-xs hover:underline"
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
      </div>
    </div>
  );
}
