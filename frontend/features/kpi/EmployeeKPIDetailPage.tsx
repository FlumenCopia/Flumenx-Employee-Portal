"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Award,
  CalendarCheck,
  CheckCircle2,
  Clock,
  FileText,
  Star,
  TrendingUp,
  User,
  ShieldAlert,
} from "lucide-react";
import { api } from "@/lib/api";
import type { KPIEmployeeData, KPIGrade } from "@/lib/types";

function getGradeBadgeClass(grade?: KPIGrade) {
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

export function EmployeeKPIDetailPage({
  employeeId,
  isSelf = false,
  backPath = "/admin/kpi",
  canUpdateRating = true,
}: {
  employeeId?: string | number;
  isSelf?: boolean;
  backPath?: string;
  canUpdateRating?: boolean;
}) {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());

  const [data, setData] = useState<KPIEmployeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Manager Rating Modal state
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingInput, setRatingInput] = useState(5);
  const [notesInput, setNotesInput] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingError, setRatingError] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const endpoint = isSelf
        ? `/kpi/my-kpi/?month=${selectedMonth}&year=${selectedYear}`
        : `/kpi/employee/${employeeId}/?month=${selectedMonth}&year=${selectedYear}`;
      const res = await api<KPIEmployeeData>(endpoint);
      setData(res);
      if (res.components?.work_quality) {
        setRatingInput(res.components.work_quality.quality_rating || 5);
        setNotesInput(res.components.work_quality.notes || "");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load employee KPI detail.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [employeeId, selectedMonth, selectedYear, isSelf]);

  const handleRatingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    setSubmittingRating(true);
    setRatingError("");
    try {
      await api("/kpi/rating/", {
        method: "POST",
        body: JSON.stringify({
          employee_id: data.employee_id,
          month: selectedMonth,
          year: selectedYear,
          rating: ratingInput,
          notes: notesInput,
        }),
      });
      setShowRatingModal(false);
      loadData();
    } catch (err) {
      setRatingError(err instanceof Error ? err.message : "Failed to save quality rating.");
    } finally {
      setSubmittingRating(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="p-8 text-center text-slate-400">
        Loading employee performance detail...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link href={backPath} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft size={16} /> Back to KPI Overview
        </Link>
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-6 rounded-xl">
          {error || "Employee performance detail not available."}
        </div>
      </div>
    );
  }

  const comp = data.components;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          {!isSelf && (
            <Link
              href={backPath}
              className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg transition"
            >
              <ArrowLeft size={18} />
            </Link>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <User className="text-indigo-400" size={24} />
              {data.employee_name}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {data.employee_code} · {data.department} · {data.designation}
            </p>
          </div>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-xl">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="text-xs bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200"
          >
            {[
              "January", "February", "March", "April", "May", "June",
              "July", "August", "September", "October", "November", "December"
            ].map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="text-xs bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200"
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Overview Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-indigo-500/20 rounded-2xl p-6 relative overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Final Score Gauge */}
          <div className="flex flex-col items-center justify-center p-4 bg-slate-950/60 border border-slate-800 rounded-xl text-center">
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Final KPI Score</span>
            <div className="text-5xl font-extrabold text-white font-mono tracking-tight my-2">
              {data.final_score}
              <span className="text-lg font-normal text-slate-500"> / 100</span>
            </div>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border mt-1 ${getGradeBadgeClass(
                data.grade
              )}`}
            >
              Grade: {data.grade}
            </span>
          </div>

          {/* Quick Summary Metrics */}
          <div className="md:col-span-2 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-slate-950/40 border border-slate-800 p-3 rounded-lg">
                <span className="text-[11px] text-slate-400">Work Completion</span>
                <p className="text-base font-bold text-white font-mono mt-0.5">
                  {comp.work_completion.score} <span className="text-xs text-slate-500 font-normal">/ 40</span>
                </p>
              </div>

              <div className="bg-slate-950/40 border border-slate-800 p-3 rounded-lg">
                <span className="text-[11px] text-slate-400">Attendance</span>
                <p className="text-base font-bold text-white font-mono mt-0.5">
                  {comp.attendance.score} <span className="text-xs text-slate-500 font-normal">/ 20</span>
                </p>
              </div>

              <div className="bg-slate-950/40 border border-slate-800 p-3 rounded-lg">
                <span className="text-[11px] text-slate-400">On-Time Delivery</span>
                <p className="text-base font-bold text-white font-mono mt-0.5">
                  {comp.on_time_delivery.score} <span className="text-xs text-slate-500 font-normal">/ 15</span>
                </p>
              </div>

              <div className="bg-slate-950/40 border border-slate-800 p-3 rounded-lg">
                <span className="text-[11px] text-slate-400">Leave Discipline</span>
                <p className="text-base font-bold text-white font-mono mt-0.5">
                  {comp.leave_discipline.score} <span className="text-xs text-slate-500 font-normal">/ 10</span>
                </p>
              </div>

              <div className="bg-slate-950/40 border border-slate-800 p-3 rounded-lg">
                <span className="text-[11px] text-slate-400">Work Quality</span>
                <p className="text-base font-bold text-amber-400 font-mono mt-0.5">
                  {comp.work_quality.score} <span className="text-xs text-slate-500 font-normal">({comp.work_quality.quality_rating}★)</span>
                </p>
              </div>

              <div className="bg-slate-950/40 border border-slate-800 p-3 rounded-lg">
                <span className="text-[11px] text-slate-400">Consistency</span>
                <p className="text-base font-bold text-white font-mono mt-0.5">
                  {comp.consistency.score} <span className="text-xs text-slate-500 font-normal">/ 5</span>
                </p>
              </div>
            </div>

            {canUpdateRating && !isSelf && (
              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setShowRatingModal(true)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition"
                >
                  <Star size={14} className="fill-amber-400 text-amber-400" />
                  Update Manager Quality Rating
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Component Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Work Completion (40%) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <CheckCircle2 size={16} className="text-indigo-400" />
              Work Completion (40%)
            </h3>
            <span className="text-xs font-bold text-white font-mono">{comp.work_completion.score} / 40</span>
          </div>
          <div className="space-y-2 text-xs text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Assigned Quantity:</span>
              <span className="font-semibold">{comp.work_completion.assigned_quantity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Completed Quantity:</span>
              <span className="font-semibold text-emerald-400">{comp.work_completion.completed_quantity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Completion Ratio:</span>
              <span className="font-semibold">{comp.work_completion.percentage}%</span>
            </div>
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800 mt-2">
              <div
                className="bg-indigo-500 h-full transition-all"
                style={{ width: `${Math.min(100, Math.max(0, comp.work_completion.percentage || 0))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Attendance (20%) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <CalendarCheck size={16} className="text-emerald-400" />
              Attendance (20%)
            </h3>
            <span className="text-xs font-bold text-white font-mono">{comp.attendance.score} / 20</span>
          </div>
          <div className="space-y-2 text-xs text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Present Days:</span>
              <span className="font-semibold text-emerald-400">{comp.attendance.present_days}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Half Days:</span>
              <span className="font-semibold text-amber-400">{comp.attendance.half_days}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Absent Days:</span>
              <span className="font-semibold text-rose-400">{comp.attendance.absent_days}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Attendance Rate:</span>
              <span className="font-semibold">{comp.attendance.percentage}%</span>
            </div>
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800 mt-2">
              <div
                className="bg-emerald-500 h-full transition-all"
                style={{ width: `${Math.min(100, Math.max(0, comp.attendance.percentage || 0))}%` }}
              />
            </div>
          </div>
        </div>

        {/* On-Time Delivery (15%) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Clock size={16} className="text-blue-400" />
              On-Time Delivery (15%)
            </h3>
            <span className="text-xs font-bold text-white font-mono">{comp.on_time_delivery.score} / 15</span>
          </div>
          <div className="space-y-2 text-xs text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Total Due Tasks:</span>
              <span className="font-semibold">{comp.on_time_delivery.total_due}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">On-Time Completed:</span>
              <span className="font-semibold text-blue-400">{comp.on_time_delivery.on_time_count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">On-Time Rate:</span>
              <span className="font-semibold">{comp.on_time_delivery.percentage}%</span>
            </div>
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800 mt-2">
              <div
                className="bg-blue-500 h-full transition-all"
                style={{ width: `${Math.min(100, Math.max(0, comp.on_time_delivery.percentage || 0))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Leave Discipline (10%) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <FileText size={16} className="text-amber-400" />
              Leave Discipline (10%)
            </h3>
            <span className="text-xs font-bold text-white font-mono">{comp.leave_discipline.score} / 10</span>
          </div>
          <div className="space-y-2 text-xs text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Approved Leaves:</span>
              <span className="font-semibold text-emerald-400">{comp.leave_discipline.approved_leaves}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Rejected Leaves:</span>
              <span className="font-semibold text-rose-400">{comp.leave_discipline.rejected_leaves}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Unapproved Absences:</span>
              <span className="font-semibold text-rose-400">{comp.leave_discipline.unapproved_absences}</span>
            </div>
          </div>
        </div>

        {/* Work Quality (10%) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Star size={16} className="text-amber-400 fill-amber-400" />
              Work Quality (10%)
            </h3>
            <span className="text-xs font-bold text-white font-mono">{comp.work_quality.score} / 10</span>
          </div>
          <div className="space-y-2 text-xs text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Manager Rating:</span>
              <span className="font-semibold text-amber-400 font-mono text-sm">
                {comp.work_quality.quality_rating} / 5.0
              </span>
            </div>
            {comp.work_quality.rated_by && (
              <div className="flex justify-between">
                <span className="text-slate-400">Rated By:</span>
                <span className="font-semibold text-slate-300">{comp.work_quality.rated_by}</span>
              </div>
            )}
            {comp.work_quality.notes && (
              <div className="text-[11px] text-slate-400 italic bg-slate-950 p-2 rounded border border-slate-800/80">
                &quot;{comp.work_quality.notes}&quot;
              </div>
            )}
          </div>
        </div>

        {/* Consistency (5%) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <TrendingUp size={16} className="text-cyan-400" />
              Consistency (5%)
            </h3>
            <span className="text-xs font-bold text-white font-mono">{comp.consistency.score} / 5</span>
          </div>
          <div className="space-y-2 text-xs text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Stability Index:</span>
              <span className="font-semibold">{comp.consistency.percentage}%</span>
            </div>
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800 mt-2">
              <div
                className="bg-cyan-500 h-full transition-all"
                style={{ width: `${Math.min(100, Math.max(0, comp.consistency.percentage || 0))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Performance History */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <Award size={18} className="text-indigo-400" />
          Monthly KPI Performance History
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-medium">
              <tr>
                <th className="py-2.5 px-4">Period</th>
                <th className="py-2.5 px-4">Final Score</th>
                <th className="py-2.5 px-4">Grade</th>
                <th className="py-2.5 px-4">Quality Rating</th>
                <th className="py-2.5 px-4">Work Comp %</th>
                <th className="py-2.5 px-4">Attendance %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {data.history && data.history.length > 0 ? (
                data.history.map((h) => (
                  <tr key={h.period} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-semibold text-white">{h.period}</td>
                    <td className="py-2.5 px-4 font-mono font-bold">{h.final_score}</td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getGradeBadgeClass(
                          h.grade
                        )}`}
                      >
                        {h.grade}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-amber-400 font-medium">{h.quality_rating} ★</td>
                    <td className="py-2.5 px-4 font-mono">{h.work_completion_pct}%</td>
                    <td className="py-2.5 px-4 font-mono">{h.attendance_pct}%</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-slate-500">
                    No past history records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manager Rating Modal */}
      {showRatingModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Star className="fill-amber-400 text-amber-400" size={20} />
              Update Manager Quality Rating
            </h3>
            <p className="text-xs text-slate-400">
              Set quality rating (1.0 to 5.0) for {data.employee_name} ({selectedMonth}/{selectedYear}).
            </p>

            {ratingError && (
              <div className="text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 p-2.5 rounded-lg">
                {ratingError}
              </div>
            )}

            <form onSubmit={handleRatingSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Quality Rating (1.0 – 5.0)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  max="5.0"
                  value={ratingInput}
                  onChange={(e) => setRatingInput(Number(e.target.value))}
                  className="w-full text-sm bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Notes / Review Comments
                </label>
                <textarea
                  rows={3}
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="Optional manager comments..."
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRatingModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRating}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition disabled:opacity-50"
                >
                  {submittingRating ? "Saving..." : "Save Rating"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
