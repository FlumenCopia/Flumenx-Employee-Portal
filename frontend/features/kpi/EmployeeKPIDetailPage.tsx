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
  FileCheck,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import type { KPIEmployeeData, KPIGrade } from "@/lib/types";

function getGradeBadgeStyle(grade?: KPIGrade): { background: string; color: string; border: string } {
  switch (grade) {
    case "Outstanding":
      return { background: "rgba(16, 185, 129, 0.15)", color: "#34d399", border: "1px solid rgba(16, 185, 129, 0.3)" };
    case "Excellent":
      return { background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", border: "1px solid rgba(59, 130, 246, 0.3)" };
    case "Good":
      return { background: "rgba(6, 182, 212, 0.15)", color: "#22d3ee", border: "1px solid rgba(6, 182, 212, 0.3)" };
    case "Needs Improvement":
      return { background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24", border: "1px solid rgba(245, 158, 11, 0.3)" };
    case "Critical":
      return { background: "rgba(239, 68, 68, 0.15)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.3)" };
    default:
      return { background: "rgba(148, 163, 184, 0.15)", color: "#cbd5e1", border: "1px solid rgba(148, 163, 184, 0.3)" };
  }
}

export function EmployeeKPIDetailPage({
  employeeId,
  isSelf = false,
  backPath = "/admin/kpi",
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

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const endpoint = isSelf
        ? `/kpi/my-kpi/?month=${selectedMonth}&year=${selectedYear}`
        : `/kpi/employee/${employeeId}/?month=${selectedMonth}&year=${selectedYear}`;
      const res = await api<KPIEmployeeData>(endpoint);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load employee KPI detail.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [employeeId, selectedMonth, selectedYear, isSelf]);

  if (loading && !data) {
    return (
      <div className="page flex flex-col items-center justify-center min-h-[300px] text-[#6b707d] gap-3">
        <RefreshCw size={24} className="animate-spin text-[#cba86e]" />
        <span className="text-xs font-semibold uppercase tracking-wider">Loading KPI performance metrics...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page">
        {!isSelf && (
          <Link href={backPath} className="text-action" style={{ marginBottom: "16px" }}>
            <ArrowLeft size={15} /> Back to KPI Overview
          </Link>
        )}
        <div className="form-error" style={{ padding: "20px", background: "rgba(223,125,110,0.1)", border: "1px solid var(--red)", borderRadius: "8px" }}>
          <AlertTriangle size={18} style={{ marginRight: "8px", verticalAlign: "middle" }} />
          {error || "Employee performance detail not available."}
        </div>
      </div>
    );
  }

  const comp = data.components;
  const gradeStyle = getGradeBadgeStyle(data.grade);

  // Component cards data
  const factorCards = [
    {
      title: "Attendance",
      score: comp.attendance?.score ?? 0,
      max: 2.0,
      icon: CalendarCheck,
      color: "var(--neon)",
      detail: `${comp.attendance?.present_days ?? 0} present / ${comp.attendance?.eligible_days ?? comp.attendance?.total_days ?? 0} eligible days`,
    },
    {
      title: "On-Time Delivery",
      score: comp.on_time_delivery?.score ?? 0,
      max: 3.0,
      icon: Clock,
      color: "#60a5fa",
      detail: `${comp.on_time_delivery?.on_time_count ?? 0} of ${comp.on_time_delivery?.total_due ?? 0} delivered on time`,
    },
    {
      title: "Pending Work",
      score: comp.pending_work?.score ?? 0,
      max: 2.0,
      icon: FileCheck,
      color: "#f59e0b",
      detail: `${comp.pending_work?.overdue_count ?? 0} overdue · ${comp.pending_work?.active_count ?? 0} active`,
    },
    {
      title: "Rework / Correction",
      score: comp.rework?.score ?? 0,
      max: 2.0,
      icon: RefreshCw,
      color: "#a855f7",
      detail: `${comp.rework?.correction_count ?? 0} task(s) currently need correction`,
    },
    {
      title: "Work Completion",
      score: comp.work_completion?.score ?? 0,
      max: 1.0,
      icon: CheckCircle2,
      color: "var(--neon)",
      detail: `${comp.work_completion?.completed_quantity ?? 0} of ${comp.work_completion?.assigned_quantity ?? 0} units completed`,
    },
  ];

  return (
    <div className="page" style={{ maxWidth: "1200px" }}>
      {/* 1. Header & Controls */}
      <div className="page-header" style={{ marginBottom: "24px" }}>
        <div>
          {!isSelf && (
            <Link href={backPath} className="text-action" style={{ marginBottom: "12px" }}>
              <ArrowLeft size={15} /> Back to KPI Overview
            </Link>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: "32px", fontWeight: 600 }}>{data.employee_name}</h1>
            <span style={{ fontSize: "11px", color: "var(--muted)", background: "var(--panel2)", border: "1px solid var(--border)", padding: "2px 8px", borderRadius: "6px" }}>
              {data.employee_code}
            </span>
          </div>
          <p style={{ margin: "6px 0 0", fontSize: "12px", color: "var(--muted)" }}>
            {data.designation} · {data.department}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--panel)", border: "1px solid var(--border)", padding: "6px 12px", borderRadius: "8px" }}>
            <Calendar size={14} style={{ color: "var(--neon)" }} />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              style={{ background: "transparent", border: 0, color: "var(--text)", fontSize: "12px", cursor: "pointer", outline: "none" }}
            >
              {[
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
              ].map((m, i) => (
                <option key={m} value={i + 1} style={{ background: "var(--panel)", color: "var(--text)" }}>{m}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{ background: "transparent", border: 0, color: "var(--text)", fontSize: "12px", cursor: "pointer", outline: "none" }}
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y} style={{ background: "var(--panel)", color: "var(--text)" }}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. Prominent KPI Score Block */}
      <div className="panel" style={{ padding: "28px", borderRadius: "12px", marginBottom: "24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px", flexWrap: "wrap", background: "var(--panel)" }}>
        <div>
          <span style={{ fontSize: "10px", letterSpacing: "0.15em", color: "var(--neon)", fontWeight: 700, textTransform: "uppercase" }}>
            EMPLOYEE KPI SCORE
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "4px" }}>
            <span style={{ fontSize: "44px", fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--text)" }}>
              {data.is_evaluated ? data.final_score.toFixed(1) : "N/A"}
            </span>
            {data.is_evaluated && (
              <span style={{ fontSize: "18px", color: "var(--muted)", fontWeight: 600 }}>/ 10</span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
          <span style={{ padding: "6px 16px", borderRadius: "20px", fontSize: "12px", fontWeight: 700, letterSpacing: "0.05em", ...gradeStyle }}>
            {data.grade}
          </span>
          <span style={{ fontSize: "11px", color: "var(--muted)" }}>
            {data.is_evaluated ? `Evaluated for ${selectedMonth}/${selectedYear}` : "No assigned work in selected month"}
          </span>
        </div>
      </div>

      {/* 3. Five Factor Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginBottom: "24px" }}>
        {factorCards.map((card) => {
          const IconComp = card.icon;
          return (
            <div key={card.title} className="panel" style={{ padding: "18px", borderRadius: "10px", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "130px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text)" }}>{card.title}</span>
                <div style={{ width: "28px", height: "28px", borderRadius: "6px", background: "var(--panel2)", border: "1px solid var(--border)", display: "grid", placeItems: "center" }}>
                  <IconComp size={15} style={{ color: card.color }} />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "6px" }}>
                  <strong style={{ fontSize: "24px", fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--text)" }}>
                    {data.is_evaluated ? card.score.toFixed(1) : "0.0"}
                  </strong>
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>/ {card.max.toFixed(1)}</span>
                </div>
                <div style={{ fontSize: "10.5px", color: "var(--muted)", lineHeight: 1.4 }}>
                  {card.detail}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Compact Performance Summary */}
      <div className="panel" style={{ padding: "20px 24px", borderRadius: "10px" }}>
        <div style={{ fontSize: "10px", letterSpacing: "0.12em", color: "var(--neon)", fontWeight: 700, textTransform: "uppercase", marginBottom: "14px" }}>
          MONTHLY PERFORMANCE SUMMARY
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "16px" }}>
          <div>
            <span style={{ fontSize: "10px", color: "var(--muted)", display: "block" }}>Tasks Assigned</span>
            <b style={{ fontSize: "16px", color: "var(--text)", marginTop: "2px", display: "block" }}>
              {comp.work_completion?.total_assignments ?? 0}
            </b>
          </div>
          <div>
            <span style={{ fontSize: "10px", color: "var(--muted)", display: "block" }}>Completed</span>
            <b style={{ fontSize: "16px", color: "var(--text)", marginTop: "2px", display: "block" }}>
              {comp.work_completion?.completed_quantity ?? 0}
            </b>
          </div>
          <div>
            <span style={{ fontSize: "10px", color: "var(--muted)", display: "block" }}>Active / Pending</span>
            <b style={{ fontSize: "16px", color: "var(--text)", marginTop: "2px", display: "block" }}>
              {comp.pending_work?.active_count ?? 0}
            </b>
          </div>
          <div>
            <span style={{ fontSize: "10px", color: "var(--muted)", display: "block" }}>Overdue</span>
            <b style={{ fontSize: "16px", marginTop: "2px", display: "block", color: (comp.pending_work?.overdue_count ?? 0) > 0 ? "var(--red)" : "var(--text)" }}>
              {comp.pending_work?.overdue_count ?? 0}
            </b>
          </div>
          <div>
            <span style={{ fontSize: "10px", color: "var(--muted)", display: "block" }}>On Time</span>
            <b style={{ fontSize: "16px", color: "var(--text)", marginTop: "2px", display: "block" }}>
              {comp.on_time_delivery?.on_time_count ?? 0} / {comp.on_time_delivery?.total_due ?? 0}
            </b>
          </div>
          <div>
            <span style={{ fontSize: "10px", color: "var(--muted)", display: "block" }}>Corrections</span>
            <b style={{ fontSize: "16px", marginTop: "2px", display: "block", color: (comp.rework?.correction_count ?? 0) > 0 ? "#a855f7" : "var(--text)" }}>
              {comp.rework?.correction_count ?? 0}
            </b>
          </div>
          <div>
            <span style={{ fontSize: "10px", color: "var(--muted)", display: "block" }}>Attendance</span>
            <b style={{ fontSize: "16px", color: "var(--text)", marginTop: "2px", display: "block" }}>
              {comp.attendance?.present_days ?? 0} / {comp.attendance?.eligible_days ?? comp.attendance?.total_days ?? 0} days
            </b>
          </div>
        </div>
      </div>
    </div>
  );
}
