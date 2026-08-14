"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock,
  FileText,
  ShieldAlert,
  Star,
  TrendingUp,
  Zap,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import type { KPIEmployeeData, KPIGrade } from "@/lib/types";

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

  // Rating Modal state
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
      <div className="w-full max-w-7xl mx-auto p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        <p className="font-mono">Loading enterprise performance analytics...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-full max-w-7xl mx-auto space-y-4 text-slate-100">
        {!isSelf && (
          <Link href={backPath} className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white transition">
            <ArrowLeft size={15} /> Back to KPI Overview
          </Link>
        )}
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-6 rounded-2xl text-xs flex items-center gap-3 shadow-xl">
          <AlertTriangle size={20} />
          {error || "Employee performance detail not available."}
        </div>
      </div>
    );
  }

  const comp = data.components;
  const kpiScore = data.score_out_of_10 ?? scoreOutOf10(data.final_score);
  const kpiScoreLabel = data.is_evaluated ? String(kpiScore) : "N/A";

  const componentList = [
    {
      name: "Work Performance",
      score: comp.work_completion.score,
      max: 50,
      pct: comp.work_completion.percentage ?? 0,
      color: "#10b981",
      icon: CheckCircle2,
      description: "Weighted task completion (0% Assigned -> 100% Published).",
      detail: `${comp.work_completion.completed_quantity ?? 0} completed from ${comp.work_completion.assigned_quantity ?? 0} assigned`,
    },
    {
      name: "Attendance",
      score: comp.attendance.score,
      max: 20,
      pct: comp.attendance.percentage ?? 0,
      color: "#34d399",
      icon: CalendarCheck,
      description: "Presence in the selected month.",
      detail: `${comp.attendance.present_days ?? 0} present, ${comp.attendance.half_days ?? 0} half day, ${comp.attendance.absent_days ?? 0} absent`,
    },
    {
      name: "On-Time Delivery",
      score: comp.on_time_delivery.score,
      max: 15,
      pct: comp.on_time_delivery.percentage ?? 0,
      color: "#3b82f6",
      icon: Clock,
      description: "Published tasks completed on or before due date.",
      detail: `${comp.on_time_delivery.on_time_count ?? 0} on time from ${comp.on_time_delivery.total_due ?? 0} due tasks`,
    },
    {
      name: "Work Quality",
      score: comp.work_quality.score,
      max: 10,
      pct: comp.work_quality.percentage ?? (((comp.work_quality.quality_rating || 0) / 5) * 100),
      color: "#a855f7",
      icon: Star,
      description: "Auto-derived task review quality and acceptance rating.",
      detail: `${comp.work_quality.quality_rating ?? 0} out of 5 quality rating`,
    },
    {
      name: "Leave Discipline",
      score: comp.leave_discipline.score,
      max: 5,
      pct: comp.leave_discipline.percentage ?? 0,
      color: "#f59e0b",
      icon: FileText,
      description: "Approved leave behavior and unapproved absences.",
      detail: `${comp.leave_discipline.unapproved_absences ?? 0} unapproved absences, ${comp.leave_discipline.rejected_leaves ?? 0} rejected leaves`,
    },
  ];

  return (
    <div className="kpi-detail-page w-full max-w-7xl mx-auto space-y-6 text-slate-100 font-sans">
      {/* 1. Large Employee Header & Control Bar */}
      <div className="kpi-detail-hero flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-4">
          {!isSelf && (
            <Link
              href={backPath}
              className="p-2.5 text-slate-400 hover:text-white bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl transition shadow-inner"
              title="Back to KPI Dashboard"
            >
              <ArrowLeft size={18} />
            </Link>
          )}

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-extrabold text-xl shadow-lg shadow-emerald-500/10">
              {data.employee_name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-extrabold text-white tracking-tight">{data.employee_name}</h1>
                <span className="text-xs text-slate-400 font-mono bg-slate-950 border border-slate-800 px-2.5 py-0.5 rounded-lg">
                  {data.employee_code}
                </span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getGradeBadgeClass(data.grade)}`}>
                  {data.grade}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-3 flex-wrap">
                <span>{data.department}</span>
                <span>/</span>
                <span className="text-slate-300 font-medium">{data.designation}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="kpi-detail-actions flex items-center gap-3">
          {/* Month & Year Selectors */}
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 p-1.5 rounded-xl shadow-inner">
            <Calendar size={14} className="text-emerald-400 ml-2" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="text-xs bg-transparent border-0 text-slate-200 focus:outline-none pr-1 font-medium cursor-pointer"
            >
              {[
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
              ].map((m, i) => (
                <option key={m} value={i + 1} className="bg-slate-950 text-slate-200">{m}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="text-xs bg-transparent border-0 text-slate-200 focus:outline-none pr-1 font-medium cursor-pointer"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y} className="bg-slate-950 text-slate-200">{y}</option>
              ))}
            </select>
          </div>

        </div>
      </div>

      <div className="kpi-simple-layout">
        <section className="kpi-score-summary">
          <div>
            <p className="kpi-score-eyebrow">Employee KPI</p>
            <div className="kpi-score-value">
              <span>{kpiScoreLabel}</span>
              {data.is_evaluated && <small>/ 10</small>}
            </div>
            <span className={`kpi-grade-pill ${getGradeBadgeClass(data.grade)}`}>
              {data.grade}
            </span>
          </div>

          <div className="kpi-score-copy">
            {data.is_evaluated ? (
              <>
                <p>
                  This KPI shows the employee performance for {selectedMonth}/{selectedYear}.
                </p>
                <p>
                  The score is calculated from work completion, attendance, on-time delivery, leave discipline, manager quality rating, and consistency.
                </p>
              </>
            ) : (
              <>
                <p>No KPI evaluation for {selectedMonth}/{selectedYear}.</p>
                <p>This employee has no assigned work in the selected month, so management should not treat this as poor performance.</p>
              </>
            )}
          </div>

          <div className="kpi-scale-box">
            <p>How to read</p>
              <div>
                <div>
                  <span>No assigned work</span>
                  <b>Not Evaluated</b>
                </div>
                <div>
                  <span>9.5 - 10</span>
                  <b>Outstanding</b>
              </div>
              <div>
                <span>8.5 - 9.4</span>
                <b>Excellent</b>
              </div>
              <div>
                <span>7.5 - 8.4</span>
                <b>Good</b>
              </div>
              <div>
                <span>6.0 - 7.4</span>
                <b>Needs Improvement</b>
              </div>
              <div>
                <span>Below 6.0</span>
                <b>Critical</b>
              </div>
            </div>
          </div>
        </section>

        <section className="kpi-factor-panel">
          <div className="kpi-factor-head">
            <div>
              <h2>
                <Zap size={17} className="text-emerald-400" />
                KPI factors
              </h2>
              <p>
                {data.is_evaluated
                  ? "These items explain why the employee received this score."
                  : "Factors will be calculated after work is assigned in this month."}
              </p>
            </div>
            <span>{data.is_evaluated ? `${data.final_score} / 100 weighted score` : "Not evaluated"}</span>
          </div>

          {data.is_evaluated ? (
            <div className="kpi-factor-list">
              {componentList.map((item) => {
              const Icon = item.icon;
              const factorPct = Math.min(100, Math.max(0, (item.score / item.max) * 100));
              return (
                <div key={item.name} className="kpi-factor-card">
                  <div className="kpi-factor-main">
                    <div className="kpi-factor-title">
                      <div className="kpi-factor-icon" style={{ color: item.color }}>
                        <Icon size={16} />
                      </div>
                      <div>
                        <h3>{item.name}</h3>
                        <p>{item.description}</p>
                        <small>{item.detail}</small>
                      </div>
                    </div>
                    <div className="kpi-factor-score">
                      <p>
                        {item.score} <span>/ {item.max}</span>
                      </p>
                      <small>{Math.round(factorPct)}%</small>
                    </div>
                  </div>
                  <div className="kpi-factor-bar">
                    <div
                      className="kpi-factor-fill"
                      style={{ width: `${factorPct}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-sm text-slate-300">
              No work assigned for this period. KPI tracking will start when assignments are added for this employee.
            </div>
          )}
        </section>
      </div>

      {/* Manager Rating Modal */}
      {showRatingModal && (
        <div className="kpi-rating-backdrop fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-emerald-500/30 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Star className="fill-amber-400 text-amber-400" size={18} />
                Update Manager Quality Rating
              </h3>
              <button
                type="button"
                onClick={() => setShowRatingModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Submit Quality Rating (1.0 to 5.0) for <span className="text-white font-semibold">{data.employee_name}</span> for evaluation period {selectedMonth}/{selectedYear}.
            </p>

            {ratingError && (
              <div className="text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-xl flex items-center gap-2">
                <ShieldAlert size={15} />
                {ratingError}
              </div>
            )}

            <form onSubmit={handleRatingSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Quality Rating (1.0 - 5.0)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  max="5.0"
                  value={ratingInput}
                  onChange={(e) => setRatingInput(Number(e.target.value))}
                  className="w-full text-sm bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Manager Review Notes / Comments
                </label>
                <textarea
                  rows={3}
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="Optional review feedback..."
                  className="w-full text-xs bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRatingModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRating}
                  className="px-4 py-2 text-xs font-semibold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition disabled:opacity-50"
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
