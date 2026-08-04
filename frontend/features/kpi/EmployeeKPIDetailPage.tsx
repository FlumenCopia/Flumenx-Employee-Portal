"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Award,
  BarChart3,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock,
  FileText,
  ShieldAlert,
  Star,
  TrendingUp,
  User,
  X,
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
      <div className="p-8 text-center text-xs text-slate-400">
        Loading employee performance records...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        {!isSelf && (
          <Link href={backPath} className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white">
            <ArrowLeft size={15} /> Back to KPI Overview
          </Link>
        )}
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-6 rounded-2xl text-xs">
          {error || "Employee performance detail not available."}
        </div>
      </div>
    );
  }

  const comp = data.components;

  const componentChartData = [
    { label: "Work Comp", score: comp.work_completion.score, max: 40, color: "#6366f1" },
    { label: "Attendance", score: comp.attendance.score, max: 20, color: "#10b981" },
    { label: "On-Time", score: comp.on_time_delivery.score, max: 15, color: "#3b82f6" },
    { label: "Leave Disc", score: comp.leave_discipline.score, max: 10, color: "#f59e0b" },
    { label: "Quality", score: comp.work_quality.score, max: 10, color: "#eab308" },
    { label: "Consistency", score: comp.consistency.score, max: 5, color: "#06b6d4" },
  ];

  return (
    <div className="space-y-6">
      {/* Header Navigation & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {!isSelf && (
            <Link
              href={backPath}
              className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition"
            >
              <ArrowLeft size={16} />
            </Link>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <User className="text-indigo-400" size={22} />
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

      {/* Main Profile & Score Gauge Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-indigo-500/20 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Score Gauge Circle */}
          <div className="flex flex-col items-center justify-center p-5 bg-slate-950/70 border border-slate-800 rounded-2xl text-center shadow-inner">
            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Overall KPI Score</span>
            <div className="text-5xl font-extrabold text-white font-mono tracking-tight my-2">
              {data.final_score}
              <span className="text-base font-normal text-slate-500"> / 100</span>
            </div>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border mt-1 ${getGradeBadgeClass(
                data.grade
              )}`}
            >
              Grade: {data.grade}
            </span>
          </div>

          {/* Component Quick Breakdown */}
          <div className="md:col-span-2 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-slate-950/50 border border-slate-800 p-3 rounded-xl">
                <span className="text-[10px] text-slate-400 block font-medium">Work Completion</span>
                <p className="text-base font-bold text-white font-mono mt-0.5">
                  {comp.work_completion.score} <span className="text-xs text-slate-500 font-normal">/ 40</span>
                </p>
              </div>

              <div className="bg-slate-950/50 border border-slate-800 p-3 rounded-xl">
                <span className="text-[10px] text-slate-400 block font-medium">Attendance</span>
                <p className="text-base font-bold text-emerald-400 font-mono mt-0.5">
                  {comp.attendance.score} <span className="text-xs text-slate-500 font-normal">/ 20</span>
                </p>
              </div>

              <div className="bg-slate-950/50 border border-slate-800 p-3 rounded-xl">
                <span className="text-[10px] text-slate-400 block font-medium">On-Time Delivery</span>
                <p className="text-base font-bold text-blue-400 font-mono mt-0.5">
                  {comp.on_time_delivery.score} <span className="text-xs text-slate-500 font-normal">/ 15</span>
                </p>
              </div>

              <div className="bg-slate-950/50 border border-slate-800 p-3 rounded-xl">
                <span className="text-[10px] text-slate-400 block font-medium">Leave Discipline</span>
                <p className="text-base font-bold text-white font-mono mt-0.5">
                  {comp.leave_discipline.score} <span className="text-xs text-slate-500 font-normal">/ 10</span>
                </p>
              </div>

              <div className="bg-slate-950/50 border border-slate-800 p-3 rounded-xl">
                <span className="text-[10px] text-slate-400 block font-medium">Work Quality</span>
                <p className="text-base font-bold text-amber-400 font-mono mt-0.5">
                  {comp.work_quality.score} <span className="text-xs text-slate-500 font-normal">({comp.work_quality.quality_rating}★)</span>
                </p>
              </div>

              <div className="bg-slate-950/50 border border-slate-800 p-3 rounded-xl">
                <span className="text-[10px] text-slate-400 block font-medium">Consistency</span>
                <p className="text-base font-bold text-cyan-400 font-mono mt-0.5">
                  {comp.consistency.score} <span className="text-xs text-slate-500 font-normal">/ 5</span>
                </p>
              </div>
            </div>

            {canUpdateRating && !isSelf && (
              <div className="flex justify-end pt-1">
                <button
                  onClick={() => setShowRatingModal(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition shadow-lg shadow-indigo-600/20"
                >
                  <Star size={14} className="fill-amber-400 text-amber-400" />
                  Update Manager Quality Rating
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 6 Component Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Work Completion (40) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3.5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CheckCircle2 size={16} className="text-indigo-400" />
              Work Completion (40)
            </h3>
            <span className="text-xs font-bold text-white font-mono">{comp.work_completion.score} / 40</span>
          </div>
          <div className="space-y-2 text-xs text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Assigned Quantity:</span>
              <span className="font-semibold text-white">{comp.work_completion.assigned_quantity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Completed Quantity:</span>
              <span className="font-semibold text-emerald-400">{comp.work_completion.completed_quantity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Completion Percentage:</span>
              <span className="font-semibold font-mono">{comp.work_completion.percentage}%</span>
            </div>
            <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800 mt-2">
              <div
                className="bg-indigo-500 h-full transition-all"
                style={{ width: `${Math.min(100, Math.max(0, comp.work_completion.percentage || 0))}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 pt-1">Ratio of completed output vs assigned work volume in evaluation month.</p>
          </div>
        </div>

        {/* Attendance (20) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3.5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CalendarCheck size={16} className="text-emerald-400" />
              Attendance (20)
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
              <span className="text-slate-400">Attendance Ratio:</span>
              <span className="font-semibold font-mono">{comp.attendance.percentage}%</span>
            </div>
            <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800 mt-2">
              <div
                className="bg-emerald-500 h-full transition-all"
                style={{ width: `${Math.min(100, Math.max(0, comp.attendance.percentage || 0))}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 pt-1">Evaluated based on present days, half days, and expected working days.</p>
          </div>
        </div>

        {/* On-Time Delivery (15) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3.5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock size={16} className="text-blue-400" />
              On-Time Delivery (15)
            </h3>
            <span className="text-xs font-bold text-white font-mono">{comp.on_time_delivery.score} / 15</span>
          </div>
          <div className="space-y-2 text-xs text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Total Due Tasks:</span>
              <span className="font-semibold text-white">{comp.on_time_delivery.total_due}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">On-Time Completed:</span>
              <span className="font-semibold text-blue-400">{comp.on_time_delivery.on_time_count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">On-Time Rate:</span>
              <span className="font-semibold font-mono">{comp.on_time_delivery.percentage}%</span>
            </div>
            <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800 mt-2">
              <div
                className="bg-blue-500 h-full transition-all"
                style={{ width: `${Math.min(100, Math.max(0, comp.on_time_delivery.percentage || 0))}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 pt-1">Tasks completed on or before scheduled due date in period.</p>
          </div>
        </div>

        {/* Leave Discipline (10) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3.5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText size={16} className="text-amber-400" />
              Leave Discipline (10)
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
            <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800 mt-2">
              <div
                className="bg-amber-500 h-full transition-all"
                style={{ width: `${Math.min(100, Math.max(0, comp.leave_discipline.percentage || 0))}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 pt-1">Score deductions applied for unexcused absences and rejected leave requests.</p>
          </div>
        </div>

        {/* Work Quality (10) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3.5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Star size={16} className="text-amber-400 fill-amber-400" />
              Work Quality (10)
            </h3>
            <span className="text-xs font-bold text-white font-mono">{comp.work_quality.score} / 10</span>
          </div>
          <div className="space-y-2 text-xs text-slate-300">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Manager Rating:</span>
              <span className="font-semibold text-amber-400 font-mono text-sm">
                {comp.work_quality.quality_rating} / 5.0
              </span>
            </div>
            {comp.work_quality.rated_by && (
              <div className="flex justify-between">
                <span className="text-slate-400">Reviewed By:</span>
                <span className="font-semibold text-slate-200">{comp.work_quality.rated_by}</span>
              </div>
            )}
            {comp.work_quality.notes && (
              <div className="text-[11px] text-slate-300 italic bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                &quot;{comp.work_quality.notes}&quot;
              </div>
            )}
            <p className="text-[10px] text-slate-500 pt-1">Direct manager rating evaluating execution accuracy and deliverables.</p>
          </div>
        </div>

        {/* Consistency (5) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3.5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp size={16} className="text-cyan-400" />
              Consistency (5)
            </h3>
            <span className="text-xs font-bold text-white font-mono">{comp.consistency.score} / 5</span>
          </div>
          <div className="space-y-2 text-xs text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Stability Index:</span>
              <span className="font-semibold font-mono">{comp.consistency.percentage}%</span>
            </div>
            <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800 mt-2">
              <div
                className="bg-cyan-500 h-full transition-all"
                style={{ width: `${Math.min(100, Math.max(0, comp.consistency.percentage || 0))}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 pt-1">Evaluates performance stability across daily attendance and task execution.</p>
          </div>
        </div>
      </div>

      {/* Monthly Performance Charts: Trend Line Chart & Component Comparison Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 6-Month Monthly Trend Chart */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp size={16} className="text-indigo-400" />
              6-Month Performance Trend
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">Monthly Score / 100</span>
          </div>

          {data.history && data.history.length > 0 ? (
            <div className="space-y-4">
              <div className="h-44 w-full pt-4 pb-2 relative">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 500 120">
                  <defs>
                    <linearGradient id="empHistGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {[20, 50, 80, 110].map((yVal, idx) => (
                    <line key={idx} x1="0" y1={yVal} x2="500" y2={yVal} stroke="#1e293b" strokeDasharray="3 3" strokeWidth="1" />
                  ))}

                  {(() => {
                    const points = data.history!.map((item, idx) => {
                      const x = (idx / (data.history!.length - 1)) * 480 + 10;
                      const y = 110 - (item.final_score / 100) * 100;
                      return { x, y, score: item.final_score, period: item.period, isCurrent: item.month === selectedMonth };
                    });

                    const pathD = points.reduce((acc, pt, i) => `${acc} ${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`, "");
                    const areaD = `${pathD} L ${points[points.length - 1].x} 115 L ${points[0].x} 115 Z`;

                    return (
                      <>
                        <path d={areaD} fill="url(#empHistGrad)" />
                        <path d={pathD} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        {points.map((pt, i) => (
                          <g key={i} className="group cursor-pointer">
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={pt.isCurrent ? "6" : "4"}
                              fill={pt.isCurrent ? "#6366f1" : "#10b981"}
                              stroke="#0f172a"
                              strokeWidth="2"
                            />
                            <text
                              x={pt.x}
                              y={pt.y - 10}
                              textAnchor="middle"
                              fill={pt.isCurrent ? "#818cf8" : "#cbd5e1"}
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

              <div className="flex justify-between border-t border-slate-800 pt-2 text-[11px] text-slate-400">
                {data.history.map((item) => (
                  <span
                    key={item.period}
                    className={item.month === selectedMonth ? "text-indigo-400 font-bold" : ""}
                  >
                    {item.period}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-xs text-slate-500">
              No historical data available for visualization.
            </div>
          )}
        </div>

        {/* Component Breakdown Bar Comparison */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BarChart3 size={16} className="text-indigo-400" />
              Component Score vs Maximum
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">Month: {selectedMonth}/{selectedYear}</span>
          </div>

          <div className="space-y-3 pt-1">
            {componentChartData.map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-slate-300">
                  <span>{item.label}</span>
                  <span className="font-mono font-bold text-white">
                    {item.score} <span className="text-[10px] text-slate-500 font-normal">/ {item.max}</span>
                  </span>
                </div>
                <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800 p-0.5">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(0, (item.score / item.max) * 100))}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Manager Rating Modal */}
      {showRatingModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Star className="fill-amber-400 text-amber-400" size={18} />
                Update Manager Quality Rating
              </h3>
              <button
                onClick={() => setShowRatingModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Submit Quality Rating (1.0 to 5.0) for {data.employee_name} for evaluation period {selectedMonth}/{selectedYear}.
            </p>

            {ratingError && (
              <div className="text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-xl flex items-center gap-2">
                <ShieldAlert size={15} />
                {ratingError}
              </div>
            )}

            <form onSubmit={handleRatingSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Quality Rating (1.0 – 5.0)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  max="5.0"
                  value={ratingInput}
                  onChange={(e) => setRatingInput(Number(e.target.value))}
                  className="w-full text-sm bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Manager Review Notes / Comments
                </label>
                <textarea
                  rows={3}
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="Optional review feedback..."
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
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
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition disabled:opacity-50"
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
