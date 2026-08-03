"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Award,
  AlertTriangle,
  Building2,
  ChevronRight,
  Download,
  Filter,
  Search,
  TrendingUp,
  UserCheck,
  Users,
  Star,
  RefreshCw,
} from "lucide-react";
import { api, apiBlob } from "@/lib/api";
import type { KPIDashboardData, KPIGrade, Department } from "@/lib/types";

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

export function KPIDashboardPage({ basePath = "/admin" }: { basePath?: string }) {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [department, setDepartment] = useState("");
  const [grade, setGrade] = useState("");
  const [search, setSearch] = useState("");
  const [minScore, setMinScore] = useState("");
  const [maxScore, setMaxScore] = useState("");

  const [data, setData] = useState<KPIDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <TrendingUp className="text-indigo-400" size={26} />
            KPI Performance Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track employee performance metrics, grades, component breakdown, and monthly trends.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCSVExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition disabled:opacity-50"
          >
            <Download size={16} />
            {exporting ? "Exporting..." : "Export CSV"}
          </button>

          <button
            onClick={loadDashboard}
            disabled={loading}
            className="p-2 text-slate-300 hover:text-white bg-slate-800/80 border border-slate-700/60 rounded-lg transition"
            title="Refresh Data"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-4">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Month */}
          <div>
            <label className="block text-xs text-slate-400 mb-1 font-medium">Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full text-sm bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
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
            <label className="block text-xs text-slate-400 mb-1 font-medium">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full text-sm bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Department */}
          <div>
            <label className="block text-xs text-slate-400 mb-1 font-medium">Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full text-sm bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Departments</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Grade */}
          <div>
            <label className="block text-xs text-slate-400 mb-1 font-medium">Grade</label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full text-sm bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Grades</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="block text-xs text-slate-400 mb-1 font-medium">Search</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Name/Code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-sm bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
              <Search size={14} className="absolute left-2.5 top-3 text-slate-500" />
            </div>
          </div>

          {/* Submit/Apply */}
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-lg transition"
            >
              Apply Filter
            </button>
          </div>
        </form>

        {/* Score Range Filters */}
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-800 text-xs text-slate-400">
          <span className="font-medium text-slate-300">Score Range:</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Min"
              min="0"
              max="100"
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
              className="w-20 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
            />
            <span>to</span>
            <input
              type="number"
              placeholder="Max"
              min="0"
              max="100"
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value)}
              className="w-20 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
            />
            <button
              onClick={loadDashboard}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition"
            >
              Filter Score
            </button>
          </div>
          {(department || grade || search || minScore || maxScore) && (
            <button
              onClick={() => {
                setDepartment("");
                setGrade("");
                setSearch("");
                setMinScore("");
                setMaxScore("");
              }}
              className="text-indigo-400 hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-4 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Employees */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Employees</p>
              <h3 className="text-2xl font-bold text-white mt-1">{data?.total_employees ?? 0}</h3>
            </div>
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
              <Users size={22} />
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-400">Evaluated in selected period</div>
        </div>

        {/* Average KPI */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Average KPI Score</p>
              <h3 className="text-2xl font-bold text-white mt-1">
                {data?.average_kpi ?? 0} <span className="text-sm font-normal text-slate-400">/ 100</span>
              </h3>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
              <TrendingUp size={22} />
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-400">Company average across department</div>
        </div>

        {/* Top Performer */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Top Performer</p>
              <h3 className="text-lg font-bold text-white mt-1 truncate max-w-[160px]">
                {data?.top_performer?.name ?? "N/A"}
              </h3>
              {data?.top_performer && (
                <p className="text-xs text-emerald-400 font-semibold mt-0.5">
                  Score: {data.top_performer.score} ({data.top_performer.grade})
                </p>
              )}
            </div>
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
              <Award size={22} />
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-400 truncate">
            {data?.top_performer?.department ?? "Highest score"}
          </div>
        </div>

        {/* Critical Performers */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Critical Performers</p>
              <h3 className="text-2xl font-bold text-rose-400 mt-1">{data?.critical_performers_count ?? 0}</h3>
            </div>
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">
              <AlertTriangle size={22} />
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-400">Score &lt; 60 or grade &apos;Critical&apos;</div>
        </div>
      </div>

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Averages */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
          <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <Building2 size={18} className="text-indigo-400" />
            Department Average KPI
          </h3>
          {data?.department_averages && data.department_averages.length > 0 ? (
            <div className="space-y-4">
              {data.department_averages.map((dept) => (
                <div key={dept.department}>
                  <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
                    <span>{dept.department} ({dept.employee_count} emp)</span>
                    <span className="font-bold">{dept.average_score} / 100</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full transition-all duration-500 ${
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
            <p className="text-xs text-slate-500">No department data available.</p>
          )}
        </div>

        {/* Monthly Trend */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
          <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-indigo-400" />
            Monthly KPI Trend (Past 6 Months)
          </h3>
          {data?.monthly_trend && data.monthly_trend.length > 0 ? (
            <div className="space-y-4">
              {data.monthly_trend.map((item) => (
                <div key={item.period} className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 font-medium w-20">{item.period}</span>
                  <div className="flex-1 bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="bg-indigo-500 h-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, item.average_score))}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-white w-12 text-right">{item.average_score}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No monthly trend data available.</p>
          )}
        </div>
      </div>

      {/* Employee KPI Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <UserCheck size={18} className="text-indigo-400" />
            Employee KPI Performance ({data?.employees.length ?? 0})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-medium">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Work Comp (40)</th>
                <th className="py-3 px-4">Attendance (20)</th>
                <th className="py-3 px-4">On-Time (15)</th>
                <th className="py-3 px-4">Leave Disc (10)</th>
                <th className="py-3 px-4">Quality (10)</th>
                <th className="py-3 px-4">Consistency (5)</th>
                <th className="py-3 px-4">Score / 100</th>
                <th className="py-3 px-4">Grade</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading && !data && (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-500">
                    Loading performance records...
                  </td>
                </tr>
              )}
              {!loading && data && data.employees.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-500">
                    No matching employee performance records found.
                  </td>
                </tr>
              )}
              {data?.employees.map((emp) => {
                const comp = emp.components;
                return (
                  <tr key={emp.employee_id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{emp.employee_name}</div>
                      <div className="text-[11px] text-slate-500">{emp.employee_code} · {emp.designation}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-300">{emp.department}</td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-200">
                      {comp.work_completion.score} <span className="text-[10px] text-slate-500">({comp.work_completion.percentage}%)</span>
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-200">
                      {comp.attendance.score} <span className="text-[10px] text-slate-500">({comp.attendance.percentage}%)</span>
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-200">
                      {comp.on_time_delivery.score} <span className="text-[10px] text-slate-500">({comp.on_time_delivery.percentage}%)</span>
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-200">
                      {comp.leave_discipline.score}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-200">
                      {comp.work_quality.score} <span className="text-[10px] text-amber-400">({comp.work_quality.quality_rating}★)</span>
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-200">
                      {comp.consistency.score}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-sm text-white font-mono">{emp.final_score}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getGradeBadgeClass(
                          emp.grade
                        )}`}
                      >
                        {emp.grade}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`${basePath}/kpi/${emp.employee_id}`}
                        className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium text-xs hover:underline"
                      >
                        View Details <ChevronRight size={14} />
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
