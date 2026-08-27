"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  FileSpreadsheet,
  Printer,
  Download,
  Calendar,
  Filter,
  RefreshCw,
  Search,
  CheckCircle,
  Clock,
  Briefcase,
  TrendingUp,
  Users,
  Shield,
  FileText,
  DollarSign,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useShellUser } from "@/components/shell";

interface ReportData {
  success: boolean;
  reportTitle: string;
  type: string;
  generatedAt: string;
  generatedBy: string;
  headers: string[];
  rows: Record<string, any>[];
  summary: Record<string, any>;
}

export function ReportsCenterPage() {
  const user = useShellUser();
  const role = (user?.role || "").toUpperCase();
  const isSuperadmin = Boolean((user as any)?.isSuperuser || (user as any)?.is_superuser || role === "SUPER_ADMIN" || role === "ADMIN");
  const isHR = role === "HR";
  const isAccountant = role === "ACCOUNTANT";
  const isTeamLead = role === "TEAM_LEAD";

  const [activeType, setActiveType] = useState<string>("attendance");
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<ReportData | null>(null);

  // Available report types based on user role
  const availableTabs = [
    { id: "attendance", label: "Attendance & Timesheets", icon: Clock, allowed: true },
    { id: "work", label: "Work & Deliverables", icon: Briefcase, allowed: true },
    { id: "kpi", label: "KPI & Ratings", icon: TrendingUp, allowed: true },
    { id: "leaves", label: "Leaves & Absenteeism", icon: Calendar, allowed: true },
    { id: "employees", label: "Employee Directory", icon: Users, allowed: isSuperadmin || isHR || isTeamLead },
    { id: "clients", label: "Clients & Projects", icon: FileText, allowed: isSuperadmin || isAccountant || isTeamLead },
    { id: "payroll", label: "Payroll & Salary Slips", icon: DollarSign, allowed: isSuperadmin || isHR || isAccountant },
    { id: "audit", label: "Security & Audit Logs", icon: Shield, allowed: isSuperadmin },
  ].filter((t) => t.allowed);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        type: activeType,
        startDate,
        endDate,
      });

      const res = await api<ReportData>(`/reports/?${params.toString()}`);
      setReport(res);
    } catch (err: any) {
      setError(err.message || "Failed to load report data.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [activeType, startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Export to Excel / CSV
  const handleExportExcel = () => {
    if (!report || report.rows.length === 0) return;

    let csvContent = report.headers.join(",") + "\n";
    report.rows.forEach((row) => {
      const values = Object.values(row).map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`);
      csvContent += values.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `FLUMENX_${activeType.toUpperCase()}_REPORT_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to PDF / Print
  const handlePrintPDF = () => {
    window.print();
  };

  // Filtered rows by search term
  const filteredRows = (report?.rows || []).filter((row) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return Object.values(row).some((val) => String(val).toLowerCase().includes(term));
  });

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "16px 20px" }}>
      {/* Header Banner */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "16px", marginBottom: "20px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <FileSpreadsheet size={24} color="#087A5B" />
            <h1 style={{ fontSize: "22px", fontWeight: 800, margin: 0, color: "var(--text)" }}>
              Enterprise Reports Center
            </h1>
          </div>
          <p style={{ fontSize: "12.5px", color: "var(--muted)", margin: "4px 0 0" }}>
            Export comprehensive analytics, attendance timesheets, work deliverables, payroll and KPI reports in Excel &amp; PDF.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            onClick={fetchReport}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "8px",
              background: "var(--panel)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={!report || report.rows.length === 0}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "8px",
              background: "#087A5B",
              border: "none",
              color: "#FFFFFF",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(8, 122, 91, 0.3)",
            }}
          >
            <Download size={14} />
            <span>Export Excel (.csv)</span>
          </button>

          <button
            type="button"
            onClick={handlePrintPDF}
            disabled={!report || report.rows.length === 0}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "8px",
              background: "var(--panel)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Printer size={14} />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "8px", marginBottom: "16px", borderBottom: "1px solid var(--border)" }}>
        {availableTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeType === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveType(tab.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 14px",
                borderRadius: "8px",
                background: isActive ? "rgba(8, 122, 91, 0.15)" : "var(--panel)",
                border: `1px solid ${isActive ? "#087A5B" : "var(--border)"}`,
                color: isActive ? "#087A5B" : "var(--text)",
                fontSize: "12.5px",
                fontWeight: isActive ? 700 : 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >
              <Icon size={15} color={isActive ? "#087A5B" : "var(--muted)"} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filter Toolbar */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "12px", padding: "12px 16px", marginBottom: "16px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--panel2)", color: "var(--text)", fontSize: "12px" }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--panel2)", color: "var(--text)", fontSize: "12px" }}
            />
          </div>
        </div>

        {/* Quick Search */}
        <div style={{ position: "relative", minWidth: "220px" }}>
          <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
          <input
            type="text"
            placeholder="Search report rows..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%", padding: "7px 12px 7px 30px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--panel2)", color: "var(--text)", fontSize: "12px" }}
          />
        </div>
      </div>

      {/* Summary Stat Cards */}
      {report && report.summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", marginBottom: "16px" }}>
          {Object.entries(report.summary).map(([key, val]) => (
            <div key={key} style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "10px", padding: "12px 14px" }}>
              <div style={{ fontSize: "10.5px", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", letterSpacing: "0.5px" }}>
                {key.replace(/([A-Z])/g, " $1")}
              </div>
              <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--text)", marginTop: "4px", fontFamily: "monospace" }}>
                {String(val)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Tabular Data Table */}
      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.03)" }}>
        {loading ? (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 10px", display: "block", color: "#087A5B" }} />
            <span>Compiling enterprise dataset and calculating aggregates...</span>
          </div>
        ) : error ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "#EF4444", fontSize: "13px" }}>
            <AlertCircle size={24} style={{ margin: "0 auto 8px", display: "block" }} />
            <span>{error}</span>
          </div>
        ) : !report || filteredRows.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
            <FileSpreadsheet size={32} style={{ margin: "0 auto 10px", display: "block", opacity: 0.5 }} />
            <span>No records found for the selected date range and filter criteria.</span>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "var(--panel2)", borderBottom: "1px solid var(--border)" }}>
                  {report.headers.map((h, i) => (
                    <th key={i} style={{ padding: "10px 14px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", fontSize: "10.5px", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid var(--border)", transition: "background 0.15s ease" }}>
                    {Object.values(row).map((val, cellIdx) => (
                      <td key={cellIdx} style={{ padding: "10px 14px", color: "var(--text)", whiteSpace: "nowrap" }}>
                        {typeof val === "boolean" ? (
                          val ? "Yes" : "No"
                        ) : String(val).toLowerCase() === "present" || String(val).toLowerCase() === "approved" || String(val).toLowerCase() === "completed" || String(val).toLowerCase() === "active" ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "6px", background: "rgba(0, 232, 137, 0.12)", color: "#087A5B", fontWeight: 700, fontSize: "11px" }}>
                            {String(val)}
                          </span>
                        ) : String(val).toLowerCase() === "absent" || String(val).toLowerCase() === "rejected" ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "6px", background: "rgba(239, 68, 68, 0.12)", color: "#EF4444", fontWeight: 700, fontSize: "11px" }}>
                            {String(val)}
                          </span>
                        ) : (
                          String(val ?? "N/A")
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
