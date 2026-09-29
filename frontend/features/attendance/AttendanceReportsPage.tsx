"use client";

import { useEffect, useState, useMemo } from "react";
import {
  CalendarCheck,
  Clock3,
  ShieldCheck,
  TimerOff,
  Download,
  FileSpreadsheet,
  Printer,
  Calendar,
  Users,
  Search,
  Layers,
  Table as TableIcon,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Building2,
} from "lucide-react";
import { api, apiBlob } from "@/lib/api";
import { PageHeader, PrimaryButton, Button, Section, StatCard } from "@/components/ui";
import { AttendanceChart } from "./AttendanceChart";
import { defaultSummary, getCurrentISTMonthString } from "./helpers";
import { MonthlyStatistics, AttendanceMatrixReport } from "./types";

export function AttendanceReportsPage() {
  const [viewMode, setViewMode] = useState<"daily" | "muster" | "chart">("daily");
  const [cycleType, setCycleType] = useState<"salary" | "calendar">("salary");
  const [month, setMonth] = useState<string>(() => getCurrentISTMonthString());
  const [department, setDepartment] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const [matrixData, setMatrixData] = useState<AttendanceMatrixReport | null>(null);
  const [loadingMatrix, setLoadingMatrix] = useState<boolean>(true);
  const [monthly, setMonthly] = useState<MonthlyStatistics | null>(null);

  // Fetch Matrix Report
  useEffect(() => {
    let isMounted = true;
    setLoadingMatrix(true);

    const deptQuery = department !== "All" ? `&department=${encodeURIComponent(department)}` : "";
    api<AttendanceMatrixReport>(
      `/attendance/matrix-report/?month=${month}&cycleType=${cycleType}${deptQuery}`
    )
      .then((data) => {
        if (isMounted) {
          setMatrixData(data);
          setLoadingMatrix(false);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch matrix report:", err);
        if (isMounted) setLoadingMatrix(false);
      });

    return () => {
      isMounted = false;
    };
  }, [month, cycleType, department]);

  // Fetch Chart Statistics
  useEffect(() => {
    const controller = new AbortController();
    api<MonthlyStatistics>(`/attendance/monthly-statistics/?month=${month}`, {
      signal: controller.signal,
    })
      .then(setMonthly)
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [month]);

  // Export functions
  async function downloadCSV(layout: "muster" | "daily" | "flat") {
    try {
      setIsExporting(true);
      const deptQuery = department !== "All" ? `&department=${encodeURIComponent(department)}` : "";
      const blob = await apiBlob(
        `/attendance/export/?month=${month}&cycleType=${cycleType}&layout=${layout}${deptQuery}`
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const fileLabel =
        layout === "muster"
          ? `Salary_Muster_Roll_${cycleType}_${month}`
          : layout === "daily"
          ? `Daily_Attendance_${cycleType}_${month}`
          : `Attendance_Log_${month}`;
      a.download = `${fileLabel}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export attendance CSV:", err);
      alert("Failed to export attendance CSV.");
    } finally {
      setIsExporting(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  // Filtered employees by search
  const filteredEmployees = useMemo(() => {
    if (!matrixData?.employees) return [];
    if (!searchQuery.trim()) return matrixData.employees;
    const q = searchQuery.toLowerCase();
    return matrixData.employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q) ||
        e.designation.toLowerCase().includes(q)
    );
  }, [matrixData?.employees, searchQuery]);

  // Unique departments for filter
  const departments = useMemo(() => {
    if (!matrixData?.employees) return ["All"];
    const set = new Set<string>();
    matrixData.employees.forEach((e) => {
      if (e.department) set.add(e.department);
    });
    return ["All", ...Array.from(set).sort()];
  }, [matrixData?.employees]);

  // Quick summary numbers
  const reportSummary = monthly?.summary || defaultSummary;
  const cycleInfo = matrixData?.cycle;
  const overall = matrixData?.overallSummary;

  return (
    <div className="attendance-reports-page">
      {/* Page Header */}
      <PageHeader
        eyebrow="ATTENDANCE & SALARY CALCULATION"
        title="Attendance Reports & Muster Roll"
        subtitle="Review daily attendance registers, salary calculation cycles (26th–25th or calendar month), and export payroll-ready muster rolls."
        action={
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <Button variant="secondary" onClick={handlePrint} title="Print or save as PDF">
              <Printer size={15} style={{ marginRight: "6px" }} />
              Print / PDF
            </Button>
            <Button
              variant="secondary"
              onClick={() => downloadCSV("daily")}
              disabled={isExporting}
              title="Download Daily Attendance Register (as in screenshot)"
            >
              <Download size={15} style={{ marginRight: "6px" }} />
              Export Daily (CSV)
            </Button>
            <PrimaryButton
              onClick={() => downloadCSV("muster")}
              disabled={isExporting}
            >
              <FileSpreadsheet size={15} style={{ marginRight: "6px" }} />
              Export Salary Muster (CSV)
            </PrimaryButton>
          </div>
        }
      />

      {/* Top Filter and Controls Bar */}
      <div
        className="report-filter-bar no-print"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          padding: "16px 20px",
          marginBottom: "20px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        {/* Left Side: Cycle Toggle & View Mode Toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          {/* Cycle Mode */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Cycle:
            </span>
            <div
              style={{
                display: "inline-flex",
                background: "#f1f5f9",
                borderRadius: "6px",
                padding: "3px",
              }}
            >
              <button
                type="button"
                onClick={() => setCycleType("salary")}
                style={{
                  border: "none",
                  background: cycleType === "salary" ? "#087a5b" : "transparent",
                  color: cycleType === "salary" ? "#ffffff" : "#475569",
                  padding: "6px 12px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Building2 size={13} /> Salary Cycle (26th–25th)
              </button>
              <button
                type="button"
                onClick={() => setCycleType("calendar")}
                style={{
                  border: "none",
                  background: cycleType === "calendar" ? "#087a5b" : "transparent",
                  color: cycleType === "calendar" ? "#ffffff" : "#475569",
                  padding: "6px 12px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Calendar size={13} /> Calendar Month (1st–31st)
              </button>
            </div>
          </div>

          {/* View Mode Toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Layout:
            </span>
            <div
              style={{
                display: "inline-flex",
                background: "#f1f5f9",
                borderRadius: "6px",
                padding: "3px",
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode("daily")}
                style={{
                  border: "none",
                  background: viewMode === "daily" ? "#1e293b" : "transparent",
                  color: viewMode === "daily" ? "#ffffff" : "#475569",
                  padding: "6px 12px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <TableIcon size={14} />
                Daily Register
              </button>
              <button
                type="button"
                onClick={() => setViewMode("muster")}
                style={{
                  border: "none",
                  background: viewMode === "muster" ? "#1e293b" : "transparent",
                  color: viewMode === "muster" ? "#ffffff" : "#475569",
                  padding: "6px 12px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Layers size={14} />
                Salary Muster Roll
              </button>
              <button
                type="button"
                onClick={() => setViewMode("chart")}
                style={{
                  border: "none",
                  background: viewMode === "chart" ? "#1e293b" : "transparent",
                  color: viewMode === "chart" ? "#ffffff" : "#475569",
                  padding: "6px 12px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <BarChart3 size={14} />
                Analytics Chart
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Month, Dept, Search */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Month Input */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Calendar size={15} color="#64748b" />
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={{
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
                borderRadius: "6px",
                padding: "6px 10px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#1e293b",
                outline: "none",
              }}
            />
          </div>

          {/* Department Filter */}
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            style={{
              border: "1px solid #cbd5e1",
              background: "#f8fafc",
              borderRadius: "6px",
              padding: "6px 10px",
              fontSize: "12px",
              fontWeight: 600,
              color: "#1e293b",
              outline: "none",
            }}
          >
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept === "All" ? "All Departments" : dept}
              </option>
            ))}
          </select>

          {/* Search Box */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              border: "1px solid #cbd5e1",
              background: "#f8fafc",
              borderRadius: "6px",
              padding: "6px 10px",
            }}
          >
            <Search size={14} color="#64748b" />
            <input
              type="text"
              placeholder="Filter employee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: "none",
                background: "transparent",
                fontSize: "12px",
                outline: "none",
                width: "130px",
                color: "#1e293b",
              }}
            />
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="stats-grid no-print" style={{ marginBottom: "24px" }}>
        <StatCard
          label="Active Period"
          value={cycleInfo ? `${cycleInfo.totalCalendarDays} Days` : "31 Days"}
          note={cycleInfo?.readablePeriod || `${month} Salary Cycle`}
          icon={<CalendarCheck />}
        />
        <StatCard
          label="Employees"
          value={String(overall?.totalEmployees ?? matrixData?.employees.length ?? 0)}
          note={department === "All" ? "Across all departments" : department}
          icon={<Users />}
        />
        <StatCard
          label="Avg. Payable Days"
          value={overall ? `${overall.avgPayableDays} Days` : "-"}
          note="Per employee for salary calculation"
          icon={<ShieldCheck />}
          accent
        />
        <StatCard
          label="Attendance Rate"
          value={`${reportSummary.attendance_percentage}%`}
          note={`${reportSummary.present} Present / ${reportSummary.absent} Absent`}
          icon={<Clock3 />}
        />
      </div>

      {/* VIEW MODE 1: DAILY ATTENDANCE REGISTER (Matches the user's reference screenshot) */}
      {viewMode === "daily" && (
        <div
          className="daily-attendance-section"
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            padding: "24px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            marginBottom: "24px",
          }}
        >
          {/* Header styled like the image */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: "20px",
                  fontWeight: 800,
                  color: "#542111", // Warm deep brown matching user's image
                  letterSpacing: "0.03em",
                  textTransform: "uppercase",
                  margin: 0,
                  fontFamily: "inherit",
                }}
              >
                DAILY ATTENDANCE
              </h2>
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                Period: <b>{cycleInfo?.readablePeriod || month}</b> &bull; Cycle:{" "}
                <b>{cycleType === "salary" ? "26th–25th Salary Cycle" : "Calendar Month"}</b>
                {department !== "All" && (
                  <span>
                    {" "}
                    &bull; Dept: <b>{department}</b>
                  </span>
                )}
              </div>
            </div>

            {/* Quick Export Button */}
            <div className="no-print">
              <Button variant="secondary" onClick={() => downloadCSV("daily")} disabled={isExporting}>
                <Download size={14} style={{ marginRight: "6px" }} />
                Export Register CSV
              </Button>
            </div>
          </div>

          {loadingMatrix ? (
            <div style={{ padding: "60px", textAlign: "center", color: "#64748b" }}>
              Loading attendance register...
            </div>
          ) : !matrixData || !matrixData.days.length || !filteredEmployees.length ? (
            <div style={{ padding: "60px", textAlign: "center", color: "#64748b" }}>
              No attendance records found for the selected cycle and department.
            </div>
          ) : (
            <div
              style={{
                border: "2px solid #334155", // Solid crisp frame matching the screenshot
                borderRadius: "2px",
                overflowX: "auto",
                background: "#ffffff",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "13px",
                  textAlign: "center",
                }}
              >
                {/* Table Header */}
                <thead>
                  <tr
                    style={{
                      background: "#ffffff",
                      borderBottom: "2px solid #334155",
                    }}
                  >
                    <th
                      style={{
                        padding: "12px 14px",
                        fontWeight: 700,
                        color: "#0f172a",
                        textAlign: "center",
                        minWidth: "75px",
                        position: "sticky",
                        left: 0,
                        background: "#ffffff",
                        zIndex: 2,
                      }}
                    >
                      Day
                    </th>
                    <th
                      style={{
                        padding: "12px 12px",
                        fontWeight: 700,
                        color: "#0f172a",
                        textAlign: "center",
                        minWidth: "100px",
                        borderRight: "1px solid #e2e8f0",
                      }}
                    >
                      Date
                    </th>
                    {filteredEmployees.map((emp) => (
                      <th
                        key={emp.id}
                        style={{
                          padding: "12px 14px",
                          fontWeight: 700,
                          color: "#0f172a",
                          minWidth: "90px",
                          whiteSpace: "nowrap",
                        }}
                        title={`${emp.name} (${emp.employeeCode}) - ${emp.designation}`}
                      >
                        <div>{emp.name}</div>
                        <div style={{ fontSize: "10px", color: "#64748b", fontWeight: 500 }}>
                          {emp.employeeCode}
                        </div>
                      </th>
                    ))}
                    <th
                      style={{
                        padding: "12px 14px",
                        fontWeight: 700,
                        color: "#047857",
                        minWidth: "85px",
                        borderLeft: "2px solid #334155",
                        background: "#f0fdf4",
                      }}
                    >
                      Present
                    </th>
                    <th
                      style={{
                        padding: "12px 14px",
                        fontWeight: 700,
                        color: "#dc2626",
                        minWidth: "85px",
                        background: "#fef2f2",
                      }}
                    >
                      Absent
                    </th>
                    <th
                      style={{
                        padding: "12px 14px",
                        fontWeight: 700,
                        color: "#2563eb",
                        minWidth: "85px",
                        background: "#eff6ff",
                      }}
                    >
                      Leave
                    </th>
                    <th
                      style={{
                        padding: "12px 14px",
                        fontWeight: 700,
                        color: "#7c3aed",
                        minWidth: "95px",
                        background: "#faf5ff",
                      }}
                    >
                      Holiday / Off
                    </th>
                  </tr>
                </thead>

                {/* Table Body with alternating peach/salmon row striping */}
                <tbody>
                  {matrixData.days.map((day, idx) => {
                    // Exact alternating peach color from reference image
                    const isPeachRow = idx % 2 === 1;
                    const rowBg = isPeachRow ? "#fdf0e6" : "#ffffff";

                    return (
                      <tr
                        key={day.dateStr}
                        style={{
                          background: rowBg,
                          borderBottom: "1px solid rgba(0,0,0,0.06)",
                          height: "36px",
                        }}
                      >
                        {/* Day Number */}
                        <td
                          style={{
                            padding: "6px 10px",
                            fontWeight: 600,
                            color: "#1e293b",
                            position: "sticky",
                            left: 0,
                            background: rowBg,
                            zIndex: 1,
                          }}
                        >
                          {day.dayNumber}
                        </td>

                        {/* Date & Weekday */}
                        <td
                          style={{
                            padding: "6px 10px",
                            fontSize: "11px",
                            color: day.isSunday ? "#94a3b8" : day.isHoliday ? "#7c3aed" : "#475569",
                            borderRight: "1px solid rgba(0,0,0,0.06)",
                            whiteSpace: "nowrap",
                            fontWeight: day.isHoliday ? 600 : 400,
                          }}
                        >
                          <div>{day.dayName}, {day.dateStr.slice(5)}</div>
                          {day.isHoliday && (
                            <div style={{ fontSize: "9.5px", color: "#7c3aed", fontWeight: 700 }}>
                              {day.holidayName || "Holiday"}
                            </div>
                          )}
                        </td>

                        {/* Employee status cells */}
                        {filteredEmployees.map((emp) => {
                          const status = emp.dailyStatuses[day.dateStr];
                          const code = status?.code || "-";

                          return (
                            <td
                              key={emp.id}
                              style={{
                                padding: "6px 10px",
                                textAlign: "center",
                              }}
                              title={
                                status?.checkIn
                                  ? `${emp.name} on ${day.dateStr}: In: ${status.checkIn}, Out: ${
                                      status.checkOut || "-"
                                    }`
                                  : `${emp.name} on ${day.dateStr}: ${status?.label || code}`
                              }
                            >
                              <span style={getStatusStyle(code)}>{code}</span>
                            </td>
                          );
                        })}

                        {/* Daily Summary Columns */}
                        <td
                          style={{
                            padding: "6px 10px",
                            fontWeight: 700,
                            color: "#047857",
                            borderLeft: "2px solid #334155",
                            background: isPeachRow ? "#faeedd" : "#f0fdf4",
                          }}
                        >
                          {day.totals.present}
                        </td>
                        <td
                          style={{
                            padding: "6px 10px",
                            fontWeight: 700,
                            color: "#dc2626",
                            background: isPeachRow ? "#fce8e8" : "#fef2f2",
                          }}
                        >
                          {day.totals.absent}
                        </td>
                        <td
                          style={{
                            padding: "6px 10px",
                            fontWeight: 700,
                            color: "#2563eb",
                            background: isPeachRow ? "#eaf2fb" : "#eff6ff",
                          }}
                        >
                          {day.totals.leave}
                        </td>
                        <td
                          style={{
                            padding: "6px 10px",
                            fontWeight: 700,
                            color: "#7c3aed",
                            background: isPeachRow ? "#f3e8ff" : "#faf5ff",
                          }}
                        >
                          {day.totals.holiday + (day.isSunday ? day.totals.weekOff : 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Footer Totals */}
                <tfoot>
                  <tr
                    style={{
                      background: "#f8fafc",
                      borderTop: "2px solid #334155",
                      fontWeight: 700,
                      color: "#0f172a",
                    }}
                  >
                    <td
                      colSpan={2}
                      style={{
                        padding: "10px 14px",
                        textAlign: "left",
                        position: "sticky",
                        left: 0,
                        background: "#f8fafc",
                        zIndex: 1,
                      }}
                    >
                      TOTAL PRESENT (P)
                    </td>
                    {filteredEmployees.map((emp) => (
                      <td
                        key={emp.id}
                        style={{
                          padding: "10px 8px",
                          fontSize: "12px",
                          color: "#047857",
                        }}
                      >
                        {emp.summary.presentDays}P / {emp.summary.absentDays}A
                      </td>
                    ))}
                    <td
                      style={{
                        padding: "10px 8px",
                        color: "#047857",
                        borderLeft: "2px solid #334155",
                        background: "#dcfce7",
                      }}
                    >
                      {matrixData.days.reduce((s, d) => s + d.totals.present, 0)}
                    </td>
                    <td
                      style={{
                        padding: "10px 8px",
                        color: "#dc2626",
                        background: "#fee2e2",
                      }}
                    >
                      {matrixData.days.reduce((s, d) => s + d.totals.absent, 0)}
                    </td>
                    <td
                      style={{
                        padding: "10px 8px",
                        color: "#2563eb",
                        background: "#dbeafe",
                      }}
                    >
                      {matrixData.days.reduce((s, d) => s + d.totals.leave, 0)}
                    </td>
                    <td
                      style={{
                        padding: "10px 8px",
                        color: "#7c3aed",
                        background: "#f3e8ff",
                      }}
                    >
                      {matrixData.days.reduce((s, d) => s + d.totals.holiday + (d.isSunday ? d.totals.weekOff : 0), 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Legend Bar */}
          <div
            className="attendance-legend-bar"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "20px",
              alignItems: "center",
              marginTop: "18px",
              padding: "12px 16px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              fontSize: "12px",
            }}
          >
            <span style={{ fontWeight: 700, color: "#475569" }}>LEGEND:</span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={getStatusStyle("P")}>P</span>
              <span style={{ color: "#334155" }}>Present (Full Day)</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={getStatusStyle("A")}>A</span>
              <span style={{ color: "#334155" }}>Absent (Unpaid)</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={getStatusStyle("W")}>W</span>
              <span style={{ color: "#334155" }}>Week Off (Sunday)</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={getStatusStyle("L")}>L</span>
              <span style={{ color: "#334155" }}>Approved Leave</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={getStatusStyle("HD")}>HD</span>
              <span style={{ color: "#334155" }}>Half Day (0.5 Day)</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={getStatusStyle("H")}>H</span>
              <span style={{ color: "#334155" }}>Company Holiday</span>
            </span>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: SALARY MUSTER ROLL (Employees on Side, Days Across Top, Salary Totals on Right) */}
      {viewMode === "muster" && (
        <div
          className="muster-roll-section"
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            padding: "24px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: "18px",
                  fontWeight: 800,
                  color: "#0f172a",
                  margin: 0,
                  letterSpacing: "-0.01em",
                }}
              >
                SALARY CALCULATION MUSTER ROLL
              </h2>
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                Period: <b>{cycleInfo?.readablePeriod || month}</b> &bull; Cycle:{" "}
                <b>{cycleType === "salary" ? "26th–25th Salary Cycle" : "Calendar Month"}</b> &bull; Rule:{" "}
                <span style={{ color: "#087a5b", fontWeight: 600 }}>
                  Salary Days = Total Days - Sundays &bull; Payable Days = Present + Holidays + Paid Leave + 0.5*HalfDays - Late Deductions
                </span>
              </div>
            </div>

            <div className="no-print">
              <PrimaryButton onClick={() => downloadCSV("muster")} disabled={isExporting}>
                <FileSpreadsheet size={15} style={{ marginRight: "6px" }} />
                Export Salary Muster (CSV)
              </PrimaryButton>
            </div>
          </div>

          {loadingMatrix ? (
            <div style={{ padding: "60px", textAlign: "center", color: "#64748b" }}>
              Calculating salary muster roll...
            </div>
          ) : !matrixData || !filteredEmployees.length ? (
            <div style={{ padding: "60px", textAlign: "center", color: "#64748b" }}>
              No employees found for this cycle.
            </div>
          ) : (
            <div
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                overflowX: "auto",
                background: "#ffffff",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "12px",
                  textAlign: "center",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#f8fafc",
                      borderBottom: "2px solid #cbd5e1",
                    }}
                  >
                    <th
                      style={{
                        padding: "10px 12px",
                        textAlign: "left",
                        minWidth: "180px",
                        position: "sticky",
                        left: 0,
                        background: "#f8fafc",
                        zIndex: 2,
                        borderRight: "1px solid #cbd5e1",
                      }}
                    >
                      Employee
                    </th>
                    <th
                      style={{
                        padding: "10px 10px",
                        textAlign: "left",
                        minWidth: "110px",
                        borderRight: "2px solid #cbd5e1",
                      }}
                    >
                      Department
                    </th>

                    {/* Day Columns */}
                    {matrixData.days.map((d) => (
                      <th
                        key={d.dateStr}
                        style={{
                          padding: "8px 6px",
                          minWidth: "36px",
                          background: d.isSunday ? "#f1f5f9" : "transparent",
                          color: d.isSunday ? "#64748b" : "#0f172a",
                          borderRight: "1px solid #f1f5f9",
                        }}
                        title={`${d.dateStr} (${d.dayName})`}
                      >
                        <div style={{ fontWeight: 700 }}>{d.dayNumber}</div>
                        <div style={{ fontSize: "9px", color: "#94a3b8" }}>{d.dayName}</div>
                      </th>
                    ))}

                    {/* Salary Calculation Summary Headers */}
                    <th
                      style={{
                        padding: "10px 8px",
                        minWidth: "55px",
                        borderLeft: "2px solid #cbd5e1",
                        background: "#f8fafc",
                      }}
                      title="Total Calendar Days"
                    >
                      Days
                    </th>
                    <th
                      style={{
                        padding: "10px 8px",
                        minWidth: "45px",
                        color: "#047857",
                        background: "#f0fdf4",
                      }}
                      title="Present Days"
                    >
                      P
                    </th>
                    <th
                      style={{
                        padding: "10px 8px",
                        minWidth: "45px",
                        color: "#d97706",
                        background: "#fffbeb",
                      }}
                      title="Half Days"
                    >
                      HD
                    </th>
                    <th
                      style={{
                        padding: "10px 8px",
                        minWidth: "45px",
                        color: "#dc2626",
                        background: "#fef2f2",
                      }}
                      title="Absent Days"
                    >
                      A
                    </th>
                    <th
                      style={{
                        padding: "10px 8px",
                        minWidth: "45px",
                        color: "#2563eb",
                        background: "#eff6ff",
                      }}
                      title="Paid Leaves"
                    >
                      L
                    </th>
                    <th
                      style={{
                        padding: "10px 8px",
                        minWidth: "45px",
                        color: "#64748b",
                        background: "#f8fafc",
                      }}
                      title="Week Offs (Sundays)"
                    >
                      W
                    </th>
                    <th
                      style={{
                        padding: "10px 8px",
                        minWidth: "45px",
                        color: "#7c3aed",
                        background: "#faf5ff",
                      }}
                      title="Company Holidays"
                    >
                      H
                    </th>
                    <th
                      style={{
                        padding: "10px 8px",
                        minWidth: "60px",
                        color: "#b45309",
                        background: "#fffbeb",
                      }}
                      title="Late Arrivals & 3-late half day deductions"
                    >
                      Late
                    </th>
                    <th
                      style={{
                        padding: "10px 8px",
                        minWidth: "75px",
                        fontWeight: 700,
                        color: "#0f172a",
                        background: "#f1f5f9",
                        borderLeft: "1px solid #cbd5e1",
                      }}
                      title="Salary Days = Total Calendar Days - Sundays"
                    >
                      Salary Days
                    </th>
                    <th
                      style={{
                        padding: "10px 10px",
                        minWidth: "90px",
                        fontWeight: 800,
                        color: "#ffffff",
                        background: "#087a5b", // Highlighted for Salary Calculation
                      }}
                      title="Calculated Payable Days for Payroll"
                    >
                      Payable Days
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredEmployees.map((emp, idx) => {
                    const isEven = idx % 2 === 0;
                    const rowBg = isEven ? "#ffffff" : "#fdf0e6"; // alternating peach striping!

                    return (
                      <tr
                        key={emp.id}
                        style={{
                          background: rowBg,
                          borderBottom: "1px solid #e2e8f0",
                          height: "38px",
                        }}
                      >
                        {/* Employee Name & Code */}
                        <td
                          style={{
                            padding: "6px 12px",
                            textAlign: "left",
                            fontWeight: 600,
                            color: "#0f172a",
                            position: "sticky",
                            left: 0,
                            background: rowBg,
                            zIndex: 1,
                            borderRight: "1px solid #cbd5e1",
                          }}
                        >
                          <div>{emp.name}</div>
                          <div style={{ fontSize: "10px", color: "#64748b", fontWeight: 500 }}>
                            {emp.employeeCode}
                          </div>
                        </td>

                        <td
                          style={{
                            padding: "6px 10px",
                            textAlign: "left",
                            fontSize: "11px",
                            color: "#475569",
                            borderRight: "2px solid #cbd5e1",
                          }}
                        >
                          {emp.department}
                        </td>

                        {/* Day Statuses */}
                        {matrixData.days.map((d) => {
                          const status = emp.dailyStatuses[d.dateStr];
                          const code = status?.code || "-";
                          return (
                            <td
                              key={d.dateStr}
                              style={{
                                padding: "4px 2px",
                                borderRight: "1px solid rgba(0,0,0,0.04)",
                              }}
                              title={
                                status?.checkIn
                                  ? `${emp.name} on ${d.dateStr}: Check-in ${status.checkIn}`
                                  : `${emp.name} on ${d.dateStr}: ${status?.label || code}`
                              }
                            >
                              <span style={getStatusStyle(code)}>{code}</span>
                            </td>
                          );
                        })}

                        {/* Summary Columns */}
                        <td
                          style={{
                            padding: "6px 4px",
                            fontWeight: 600,
                            color: "#475569",
                            borderLeft: "2px solid #cbd5e1",
                          }}
                        >
                          {emp.summary.totalCalendarDays}
                        </td>
                        <td
                          style={{
                            padding: "6px 4px",
                            fontWeight: 700,
                            color: "#047857",
                            background: isEven ? "#f0fdf4" : "#e6f8ec",
                          }}
                        >
                          {emp.summary.presentDays}
                        </td>
                        <td
                          style={{
                            padding: "6px 4px",
                            fontWeight: 700,
                            color: "#d97706",
                            background: isEven ? "#fffbeb" : "#fef3c7",
                          }}
                        >
                          {emp.summary.halfDays}
                        </td>
                        <td
                          style={{
                            padding: "6px 4px",
                            fontWeight: 700,
                            color: "#dc2626",
                            background: isEven ? "#fef2f2" : "#fde8e8",
                          }}
                        >
                          {emp.summary.absentDays}
                        </td>
                        <td
                          style={{
                            padding: "6px 4px",
                            fontWeight: 600,
                            color: "#2563eb",
                            background: isEven ? "#eff6ff" : "#e5f0fe",
                          }}
                        >
                          {emp.summary.paidLeaveDays}
                        </td>
                        <td
                          style={{
                            padding: "6px 4px",
                            color: "#64748b",
                          }}
                        >
                          {emp.summary.weekOffs}
                        </td>
                        <td
                          style={{
                            padding: "6px 4px",
                            color: "#7c3aed",
                            fontWeight: 600,
                          }}
                        >
                          {emp.summary.holidays}
                        </td>
                        <td
                          style={{
                            padding: "6px 4px",
                            fontSize: "11px",
                            color: emp.summary.lateArrivals > 0 ? "#b45309" : "#64748b",
                          }}
                          title={`${emp.summary.lateArrivals} late arrivals. Deduction: -${emp.summary.lateHalfDayDeductions} day`}
                        >
                          {emp.summary.lateArrivals}
                          {emp.summary.lateHalfDayDeductions > 0 && (
                            <span style={{ color: "#dc2626", fontSize: "10px", marginLeft: "2px" }}>
                              (-{emp.summary.lateHalfDayDeductions}d)
                            </span>
                          )}
                        </td>
                        <td
                          style={{
                            padding: "6px 6px",
                            fontWeight: 700,
                            color: "#0f172a",
                            borderLeft: "1px solid #cbd5e1",
                            background: isEven ? "#f8fafc" : "#f1f5f9",
                          }}
                        >
                          {emp.summary.salaryDays}
                        </td>
                        <td
                          style={{
                            padding: "6px 8px",
                            fontWeight: 800,
                            fontSize: "13px",
                            color: "#087a5b",
                            background: isEven ? "#ecfdf5" : "#d1fae5",
                          }}
                        >
                          {emp.summary.payableDays}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 3: MONTHLY ANALYTICS CHART */}
      {viewMode === "chart" && (
        <Section title="Monthly Attendance Analytics" kicker={`${month} / GENERATED VIEW`}>
          <AttendanceChart days={monthly?.days} />
          <div className="report-summary-grid">
            <div>
              <span>PRESENT RECORDS</span>
              <b>{reportSummary.present}</b>
              <small>Total check-in records</small>
            </div>
            <div>
              <span>LATE ARRIVALS</span>
              <b>{reportSummary.late}</b>
              <small>Based on company grace policy</small>
            </div>
            <div>
              <span>EARLY EXITS</span>
              <b>{reportSummary.early_exits}</b>
              <small>Departed before work hours</small>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}

/**
 * Returns inline styling for attendance status codes matching the uploaded image:
 * P: Regular dark charcoal
 * A: Bold Red
 * W: Italicized Light Gray
 * L: Vibrant Blue
 * HD: Amber
 * H: Purple
 */
function getStatusStyle(code: string): React.CSSProperties {
  switch (code) {
    case "P":
      return {
        fontWeight: 600,
        color: "#1e293b",
        display: "inline-block",
      };
    case "A":
      return {
        fontWeight: 800,
        color: "#dc2626", // Bold Red
        display: "inline-block",
      };
    case "W":
      return {
        fontStyle: "italic",
        fontWeight: 400,
        color: "#94a3b8", // Italic Light Gray
        display: "inline-block",
      };
    case "L":
      return {
        fontWeight: 700,
        color: "#2563eb", // Blue
        display: "inline-block",
      };
    case "HD":
      return {
        fontWeight: 700,
        color: "#d97706", // Amber
        display: "inline-block",
        fontSize: "11px",
      };
    case "H":
      return {
        fontWeight: 700,
        color: "#7c3aed", // Purple
        display: "inline-block",
      };
    default:
      return {
        color: "#cbd5e1",
        fontWeight: 400,
      };
  }
}
