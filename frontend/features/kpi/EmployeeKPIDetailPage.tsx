"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  BarChart3,
  Building2,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquare,
  ShieldAlert,
  Sparkles,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  User,
  UserCheck,
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
    default:
      return "bg-slate-500/15 text-slate-400 border-slate-500/30";
  }
}

function getGradeColor(grade?: KPIGrade) {
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
  const gradeColor = getGradeColor(data.grade);

  const componentList = [
    { name: "Work Completion", score: comp.work_completion.score, max: 40, pct: comp.work_completion.percentage ?? 0, color: "#10b981", icon: CheckCircle2 },
    { name: "Attendance", score: comp.attendance.score, max: 20, pct: comp.attendance.percentage ?? 0, color: "#34d399", icon: CalendarCheck },
    { name: "On-Time Delivery", score: comp.on_time_delivery.score, max: 15, pct: comp.on_time_delivery.percentage ?? 0, color: "#3b82f6", icon: Clock },
    { name: "Leave Discipline", score: comp.leave_discipline.score, max: 10, pct: comp.leave_discipline.percentage ?? 0, color: "#f59e0b", icon: FileText },
    { name: "Work Quality", score: comp.work_quality.score, max: 10, pct: (((comp.work_quality.quality_rating || 0) / 5) * 100), color: "#a855f7", icon: Star },
    { name: "Consistency", score: comp.consistency.score, max: 5, pct: comp.consistency.percentage ?? 0, color: "#06b6d4", icon: TrendingUp },
  ];

  const strengths = componentList.filter((c) => c.pct >= 80);
  const areasToImprove = componentList.filter((c) => c.pct < 80);

  // SVG Gauge calculations
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const gaugeOffset = circumference - (Math.min(100, Math.max(0, data.final_score)) / 100) * circumference;

  const reportingManager = comp.work_quality.rated_by || "HR / Team Management";

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 text-slate-100 font-sans">
      {/* 1. Large Employee Header & Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-md">
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
                <span>·</span>
                <span className="text-slate-300 font-medium">{data.designation}</span>
                <span>·</span>
                <span className="text-slate-400">Manager: <strong className="text-slate-200">{reportingManager}</strong></span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
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

          {canUpdateRating && !isSelf && (
            <button
              onClick={() => setShowRatingModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 active:bg-emerald-500 rounded-xl transition shadow-lg shadow-emerald-500/20"
            >
              <Star size={15} className="fill-emerald-950 text-emerald-950" />
              Update Rating
            </button>
          )}
        </div>
      </div>

      {/* 2. Hero Score Gauge & High-Level Metrics Summary */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 shadow-2xl space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
          {/* Circular Score Gauge Container */}
          <div className="flex flex-col items-center justify-center p-6 bg-slate-950/80 border border-slate-800/80 rounded-2xl text-center shadow-inner relative">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                {/* Background Circle */}
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  stroke="#1e293b"
                  strokeWidth="10"
                  fill="transparent"
                />
                {/* Score Circle Progress */}
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  stroke={gradeColor}
                  strokeWidth="10"
                  strokeDasharray={circumference}
                  strokeDashoffset={gaugeOffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-extrabold text-white font-mono tracking-tight">{data.final_score}</span>
                <span className="text-[10px] text-slate-400 font-mono font-medium uppercase tracking-wider">out of 100</span>
              </div>
            </div>

            <div className="mt-4 space-y-1">
              <span className="text-[11px] text-slate-400 block font-medium">Overall Performance Grade</span>
              <span
                className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-bold border ${getGradeBadgeClass(
                  data.grade
                )}`}
              >
                {data.grade}
              </span>
            </div>
          </div>

          {/* Quick Metrics Widget Cards (Right 2 Columns) */}
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {/* Work Completion Widget */}
            <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-2xl space-y-2 hover:border-slate-700 transition">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[11px] font-medium truncate">Work Comp.</span>
                <CheckCircle2 size={15} className="text-emerald-400" />
              </div>
              <p className="text-xl font-extrabold text-white font-mono">{comp.work_completion.score} <span className="text-xs text-slate-500 font-normal">/ 40</span></p>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>Completion</span>
                <span className="font-mono font-semibold text-emerald-400">{comp.work_completion.percentage}%</span>
              </div>
            </div>

            {/* Attendance Widget */}
            <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-2xl space-y-2 hover:border-slate-700 transition">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[11px] font-medium truncate">Attendance</span>
                <CalendarCheck size={15} className="text-emerald-400" />
              </div>
              <p className="text-xl font-extrabold text-emerald-400 font-mono">{comp.attendance.score} <span className="text-xs text-slate-500 font-normal">/ 20</span></p>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>Presence</span>
                <span className="font-mono font-semibold text-emerald-400">{comp.attendance.percentage}%</span>
              </div>
            </div>

            {/* On-Time Delivery Widget */}
            <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-2xl space-y-2 hover:border-slate-700 transition">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[11px] font-medium truncate">On-Time</span>
                <Clock size={15} className="text-blue-400" />
              </div>
              <p className="text-xl font-extrabold text-blue-400 font-mono">{comp.on_time_delivery.score} <span className="text-xs text-slate-500 font-normal">/ 15</span></p>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>On-Time Rate</span>
                <span className="font-mono font-semibold text-blue-400">{comp.on_time_delivery.percentage}%</span>
              </div>
            </div>

            {/* Leave Discipline Widget */}
            <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-2xl space-y-2 hover:border-slate-700 transition">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[11px] font-medium truncate">Leave Disc.</span>
                <FileText size={15} className="text-amber-400" />
              </div>
              <p className="text-xl font-extrabold text-amber-400 font-mono">{comp.leave_discipline.score} <span className="text-xs text-slate-500 font-normal">/ 10</span></p>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>Discipline</span>
                <span className="font-mono font-semibold text-amber-400">{comp.leave_discipline.percentage}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. 6 Component Breakdown Cards Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Zap size={16} className="text-emerald-400" />
            Detailed KPI Component Score Breakdown
          </h2>
          <span className="text-[11px] text-slate-400 font-mono">Weighted Factor Breakdown</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Work Completion Card */}
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 space-y-3 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                Work Completion (40)
              </h3>
              <span className="text-xs font-extrabold text-white font-mono">{comp.work_completion.score} / 40</span>
            </div>
            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Assigned Volume:</span>
                <span className="font-semibold text-white">{comp.work_completion.assigned_quantity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Completed Output:</span>
                <span className="font-semibold text-emerald-400">{comp.work_completion.completed_quantity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Completion Ratio:</span>
                <span className="font-semibold font-mono text-emerald-400">{comp.work_completion.percentage}%</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800/80 mt-2">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, comp.work_completion.percentage || 0))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Attendance Card */}
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 space-y-3 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <CalendarCheck size={16} className="text-emerald-400" />
                Attendance (20)
              </h3>
              <span className="text-xs font-extrabold text-white font-mono">{comp.attendance.score} / 20</span>
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
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800/80 mt-2">
                <div
                  className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, comp.attendance.percentage || 0))}%` }}
                />
              </div>
            </div>
          </div>

          {/* On-Time Delivery Card */}
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 space-y-3 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <Clock size={16} className="text-blue-400" />
                On-Time Delivery (15)
              </h3>
              <span className="text-xs font-extrabold text-white font-mono">{comp.on_time_delivery.score} / 15</span>
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
                <span className="font-semibold font-mono text-blue-400">{comp.on_time_delivery.percentage}%</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800/80 mt-2">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, comp.on_time_delivery.percentage || 0))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Leave Discipline Card */}
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 space-y-3 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <FileText size={16} className="text-amber-400" />
                Leave Discipline (10)
              </h3>
              <span className="text-xs font-extrabold text-white font-mono">{comp.leave_discipline.score} / 10</span>
            </div>
            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Approved Leaves:</span>
                <span className="font-semibold text-emerald-400">{comp.leave_discipline.approved_leaves}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Rejected Requests:</span>
                <span className="font-semibold text-rose-400">{comp.leave_discipline.rejected_leaves}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Unapproved Absences:</span>
                <span className="font-semibold text-rose-400">{comp.leave_discipline.unapproved_absences}</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800/80 mt-2">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, comp.leave_discipline.percentage || 0))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Work Quality Card */}
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 space-y-3 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <Star size={16} className="text-purple-400 fill-purple-400" />
                Work Quality (10)
              </h3>
              <span className="text-xs font-extrabold text-white font-mono">{comp.work_quality.score} / 10</span>
            </div>
            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Manager Rating:</span>
                <span className="font-semibold text-purple-400 font-mono text-sm font-bold">
                  {comp.work_quality.quality_rating} / 5.0 ★
                </span>
              </div>
              {comp.work_quality.rated_by && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Reviewed By:</span>
                  <span className="font-semibold text-slate-200">{comp.work_quality.rated_by}</span>
                </div>
              )}
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800/80 mt-2">
                <div
                  className="bg-purple-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, ((comp.work_quality.quality_rating || 0) / 5) * 100))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Consistency Card */}
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 space-y-3 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <TrendingUp size={16} className="text-cyan-400" />
                Consistency (5)
              </h3>
              <span className="text-xs font-extrabold text-white font-mono">{comp.consistency.score} / 5</span>
            </div>
            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Stability Index:</span>
                <span className="font-semibold font-mono text-cyan-400">{comp.consistency.percentage}%</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800/80 mt-2">
                <div
                  className="bg-cyan-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, comp.consistency.percentage || 0))}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Strengths, Focus Areas & Manager Remarks Analytics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Strengths Card */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 space-y-3 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <Sparkles size={16} className="text-emerald-400" />
              Performance Strengths
            </h3>
            <span className="text-[10px] text-emerald-400 font-mono">&ge; 80% Efficiency</span>
          </div>

          <div className="space-y-2 text-xs">
            {strengths.length > 0 ? (
              strengths.map((item) => (
                <div key={item.name} className="flex items-center justify-between bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
                  <span className="font-medium text-slate-200">{item.name}</span>
                  <span className="font-mono font-bold text-emerald-400">{item.score} / {item.max}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 py-4 text-center">No components above 80% threshold in period.</p>
            )}
          </div>
        </div>

        {/* Growth Focus Areas Card */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 space-y-3 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <Target size={16} className="text-amber-400" />
              Growth & Focus Areas
            </h3>
            <span className="text-[10px] text-amber-400 font-mono">&lt; 80% Score</span>
          </div>

          <div className="space-y-2 text-xs">
            {areasToImprove.length > 0 ? (
              areasToImprove.map((item) => (
                <div key={item.name} className="flex items-center justify-between bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
                  <span className="font-medium text-slate-200">{item.name}</span>
                  <span className="font-mono font-bold text-amber-400">{item.score} / {item.max}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-emerald-400/80 py-4 text-center">All components performing at high efficiency (&ge;80%).</p>
            )}
          </div>
        </div>

        {/* Manager Remarks & Comments Log */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 space-y-3 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <MessageSquare size={16} className="text-purple-400" />
              Manager Remarks
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">Review Note</span>
          </div>

          <div className="space-y-2 text-xs">
            {comp.work_quality.notes ? (
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 text-slate-300 italic leading-relaxed">
                &quot;{comp.work_quality.notes}&quot;
                {comp.work_quality.rated_by && (
                  <span className="block not-italic text-[10px] text-slate-500 font-medium mt-2 font-mono">
                    — Reviewed by {comp.work_quality.rated_by}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-4 text-center">No manager review comments submitted for this evaluation period.</p>
            )}
          </div>
        </div>
      </div>

      {/* 5. Monthly Performance Charts Grid: 6-Month Trend & Component Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 6-Month Monthly Trend Line Chart */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 space-y-4 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-400" />
              6-Month Performance Trend History
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">Score / 100</span>
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
                {data.history.map((item) => (
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
            <div className="h-44 flex items-center justify-center text-xs text-slate-500">
              No historical data available for visualization.
            </div>
          )}
        </div>

        {/* Component Breakdown Bar Chart */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 space-y-4 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BarChart3 size={16} className="text-emerald-400" />
              Component Score vs Maximum Weight
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">{selectedMonth}/{selectedYear}</span>
          </div>

          <div className="space-y-3.5 pt-1">
            {componentList.map((item) => (
              <div key={item.name} className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-slate-300">
                  <span>{item.name}</span>
                  <span className="font-mono font-bold text-white">
                    {item.score} <span className="text-[10px] text-slate-500 font-normal">/ {item.max}</span>
                  </span>
                </div>
                <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800/80 p-0.5">
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-emerald-500/30 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
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
                  Quality Rating (1.0 – 5.0)
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
