"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Download,
  Sparkles,
  Calendar,
  Layers,
  Calculator,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
  Trash2,
  Receipt,
  FileSpreadsheet,
  UserCheck,
} from "lucide-react";
import { Employee, Paginated, SalarySlip } from "@/lib/types";
import { api } from "@/lib/api";
import { Avatar } from "@/components/icons";
import { EmptyState, PageHeader, PrimaryButton, Section } from "@/components/ui";
import { Modal } from "@/features/common/Modal";
import { getAttendanceCycleForMonth, getISTDateString } from "@/lib/tzUtils";

const monthName = (m: number) =>
  new Date(2024, m - 1).toLocaleDateString("en-US", { month: "long" });

export function SalaryPage({ employee = false }: { employee?: boolean }) {
  const [activeTab, setActiveTab] = useState<"slips" | "payroll" | "structures" | "holidays">("slips");

  // --- Slips State ---
  const [slipsData, setSlipsData] = useState<SalarySlip[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // --- Payroll Engine Tab State ---
  const [payrollRecords, setPayrollRecords] = useState<any[]>([]);
  const [payrollMonth, setPayrollMonth] = useState(new Date().getMonth() + 1);
  const [payrollYear, setPayrollYear] = useState(new Date().getFullYear());
  const [selectedPreview, setSelectedPreview] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [processingCycle, setProcessingCycle] = useState(false);
  const [payrollError, setPayrollError] = useState("");
  const [payrollSuccess, setPayrollSuccess] = useState("");
  const [genEmployeeId, setGenEmployeeId] = useState("");

  // --- Salary Structures Tab State ---
  const [structures, setStructures] = useState<any[]>([]);
  const [structModal, setStructModal] = useState(false);
  const [selectedEmpForStruct, setSelectedEmpForStruct] = useState("");
  const [structGross, setStructGross] = useState(50000);
  const [structBasic, setStructBasic] = useState(25000);
  const [structHra, setStructHra] = useState(12500);
  const [structConveyance, setStructConveyance] = useState(3000);
  const [structSpecial, setStructSpecial] = useState(9500);
  const [structPfEnabled, setStructPfEnabled] = useState(true);
  const [structEsiEnabled, setStructEsiEnabled] = useState(false);
  const [structProfTax, setStructProfTax] = useState(200);

  // --- Holidays Tab State ---
  const [holidays, setHolidays] = useState<any[]>([]);
  const [holidayModal, setHolidayModal] = useState(false);
  const [newHolidayName, setNewHolidayName] = useState("");
  const [newHolidayDate, setNewHolidayDate] = useState(getISTDateString());
  const [newHolidayType, setNewHolidayType] = useState("Company");
  const [newHolidayDesc, setNewHolidayDesc] = useState("");
  const [newHolidayPaid, setNewHolidayPaid] = useState(true);

  const cycleInfo = getAttendanceCycleForMonth(payrollYear, payrollMonth);

  const loadSlips = () => {
    setLoading(true);
    setError("");
    api<Paginated<SalarySlip> | SalarySlip[]>(`/salary-slips/`)
      .then((result) => {
        const list = Array.isArray(result) ? result : (result as any)?.results || [];
        setSlipsData(list);
      })
      .catch((err) => {
        setSlipsData([]);
        setError(err instanceof Error ? err.message : "Could not load salary slips.");
      })
      .finally(() => setLoading(false));
  };

  const loadPayrollRecords = () => {
    api<{ results: any[] }>(`/payroll/?month=${payrollMonth}&year=${payrollYear}`)
      .then((res) => setPayrollRecords(res.results || []))
      .catch(() => setPayrollRecords([]));
  };

  const loadStructures = () => {
    api<{ results: any[] }>(`/salary-structures/`)
      .then((res) => setStructures(res.results || []))
      .catch(() => setStructures([]));
  };

  const loadHolidays = () => {
    api<{ results: any[] }>(`/holidays/?year=${payrollYear}`)
      .then((res) => setHolidays(res.results || []))
      .catch(() => setHolidays([]));
  };

  useEffect(() => {
    loadSlips();
    if (!employee) {
      api<Paginated<Employee> | Employee[]>("/employees/")
        .then((result) => {
          const list = Array.isArray(result) ? result : (result as any)?.results || [];
          setEmployeeOptions(list);
          if (list.length > 0) {
            const firstId = list[0].id || (list[0] as any)._id;
            setGenEmployeeId(firstId);
            setSelectedEmpForStruct(firstId);
          }
        })
        .catch(() => {});
    }
  }, [employee]);

  useEffect(() => {
    if (activeTab === "payroll") loadPayrollRecords();
    if (activeTab === "structures") loadStructures();
    if (activeTab === "holidays") loadHolidays();
  }, [activeTab, payrollMonth, payrollYear]);

  // Preview Payroll Calculation
  const handleCalculatePreview = async (empId: string) => {
    if (!empId) return;
    setPreviewLoading(true);
    setPayrollError("");
    setPayrollSuccess("");
    try {
      const res = await api<any>("/payroll/preview/", {
        method: "POST",
        body: JSON.stringify({
          employee_id: empId,
          month: payrollMonth,
          year: payrollYear,
        }),
      });
      setSelectedPreview(res);
    } catch (err: any) {
      setPayrollError(err.message || "Failed to calculate preview.");
      setSelectedPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Process Cycle
  const handleProcessCycle = async () => {
    setProcessingCycle(true);
    setPayrollError("");
    setPayrollSuccess("");
    try {
      const res = await api<any>("/payroll/process-cycle/", {
        method: "POST",
        body: JSON.stringify({
          month: payrollMonth,
          year: payrollYear,
        }),
      });
      setPayrollSuccess(res.message || "Payroll cycle processed successfully.");
      loadPayrollRecords();
    } catch (err: any) {
      setPayrollError(err.message || "Failed to process payroll cycle.");
    } finally {
      setProcessingCycle(false);
    }
  };

  // Approve Payroll Record
  const handleApprovePayroll = async (id: string) => {
    try {
      await api(`/payroll/${id}/approve/`, { method: "POST" });
      loadPayrollRecords();
    } catch (err: any) {
      alert(err.message || "Failed to approve payroll.");
    }
  };

  // Save Salary Structure
  const handleSaveStructure = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api("/salary-structures/", {
        method: "POST",
        body: JSON.stringify({
          employee: selectedEmpForStruct,
          grossSalary: structGross,
          basicSalary: structBasic,
          hra: structHra,
          conveyance: structConveyance,
          specialAllowance: structSpecial,
          pfEnabled: structPfEnabled,
          esiEnabled: structEsiEnabled,
          professionalTax: structProfTax,
          tds: 0,
        }),
      });
      setStructModal(false);
      loadStructures();
    } catch (err: any) {
      alert(err.message || "Failed to save salary structure.");
    }
  };

  // Save Holiday
  const handleSaveHoliday = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api("/holidays/", {
        method: "POST",
        body: JSON.stringify({
          name: newHolidayName,
          date: newHolidayDate,
          holiday_type: newHolidayType,
          description: newHolidayDesc,
          is_paid: newHolidayPaid,
        }),
      });
      setHolidayModal(false);
      setNewHolidayName("");
      loadHolidays();
    } catch (err: any) {
      alert(err.message || "Failed to create holiday.");
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    if (!confirm("Are you sure you want to delete this holiday?")) return;
    try {
      await api(`/holidays/${id}/`, { method: "DELETE" });
      loadHolidays();
    } catch (err: any) {
      alert(err.message || "Failed to delete holiday.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <PageHeader
        title={employee ? "My Salary & Payslips" : "Payroll & Salary Management"}
        subtitle={
          employee
            ? "View your attendance-calculated payroll breakdowns and monthly payslips."
            : "Enterprise Attendance-Based Payroll, India (IST) Timezone, Salary Heads & Holiday Calendar."
        }
        action={
          !employee ? (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                background: "#E2E8F0",
                padding: "4px",
                borderRadius: "10px",
                border: "1.5px solid #CBD5E1",
                maxWidth: "100%",
                overflowX: "auto",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab("payroll")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 14px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "12.5px",
                  whiteSpace: "nowrap",
                  fontWeight: activeTab === "payroll" ? 800 : 600,
                  background: activeTab === "payroll" ? "#087A5B" : "transparent",
                  color: activeTab === "payroll" ? "#FFFFFF" : "#334155",
                  boxShadow: activeTab === "payroll" ? "0 2px 8px rgba(8,122,91,0.3)" : "none",
                  transition: "all 0.18s ease",
                }}
              >
                <Calculator size={14} />
                Payroll Engine
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("structures")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 14px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "12.5px",
                  whiteSpace: "nowrap",
                  fontWeight: activeTab === "structures" ? 800 : 600,
                  background: activeTab === "structures" ? "#087A5B" : "transparent",
                  color: activeTab === "structures" ? "#FFFFFF" : "#334155",
                  boxShadow: activeTab === "structures" ? "0 2px 8px rgba(8,122,91,0.3)" : "none",
                  transition: "all 0.18s ease",
                }}
              >
                <Layers size={14} />
                Salary Structure
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("holidays")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 14px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "12.5px",
                  whiteSpace: "nowrap",
                  fontWeight: activeTab === "holidays" ? 800 : 600,
                  background: activeTab === "holidays" ? "#087A5B" : "transparent",
                  color: activeTab === "holidays" ? "#FFFFFF" : "#334155",
                  boxShadow: activeTab === "holidays" ? "0 2px 8px rgba(8,122,91,0.3)" : "none",
                  transition: "all 0.18s ease",
                }}
              >
                <Calendar size={14} />
                Holiday Calendar
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("slips")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 14px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "12.5px",
                  whiteSpace: "nowrap",
                  fontWeight: activeTab === "slips" ? 800 : 600,
                  background: activeTab === "slips" ? "#087A5B" : "transparent",
                  color: activeTab === "slips" ? "#FFFFFF" : "#334155",
                  boxShadow: activeTab === "slips" ? "0 2px 8px rgba(8,122,91,0.3)" : "none",
                  transition: "all 0.18s ease",
                }}
              >
                <Receipt size={14} />
                Payslips
              </button>
            </div>
          ) : null
        }
      />

      {/* --- TAB 1: PAYROLL ENGINE --- */}
      {activeTab === "payroll" && !employee && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Top Calculation Control Strip */}
          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "20px 24px",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                  Cycle Month:
                </span>
                <select
                  value={payrollMonth}
                  onChange={(e) => setPayrollMonth(parseInt(e.target.value, 10))}
                  style={{
                    background: "#FFFFFF",
                    border: "1.5px solid #CBD5E1",
                    borderRadius: "8px",
                    padding: "8px 14px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--text)",
                    outline: "none",
                  }}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {monthName(m)}
                    </option>
                  ))}
                </select>

                <select
                  value={payrollYear}
                  onChange={(e) => setPayrollYear(parseInt(e.target.value, 10))}
                  style={{
                    background: "#FFFFFF",
                    border: "1.5px solid #CBD5E1",
                    borderRadius: "8px",
                    padding: "8px 14px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--text)",
                    outline: "none",
                  }}
                >
                  {[2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  background: "var(--soft-brand-bg)",
                  color: "var(--amber)",
                  border: "1px solid rgba(8,122,91,0.25)",
                  padding: "6px 14px",
                  borderRadius: "20px",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  fontFamily: "monospace",
                }}
              >
                Active Cycle: {cycleInfo.cycleName} ({cycleInfo.startStr} to {cycleInfo.endStr})
              </div>

              <button
                type="button"
                className="primary-button"
                onClick={handleProcessCycle}
                disabled={processingCycle}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 20px",
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, #087A5B 0%, #066349 100%)",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 800,
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(8,122,91,0.3)",
                }}
              >
                <Sparkles size={16} />
                {processingCycle ? "Processing Payroll Cycle..." : "Process Cycle Payroll"}
              </button>
            </div>

            {payrollSuccess && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  background: "rgba(22,133,91,0.1)",
                  border: "1px solid rgba(22,133,91,0.3)",
                  color: "var(--green)",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <CheckCircle2 size={16} /> {payrollSuccess}
              </div>
            )}
            {payrollError && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  background: "rgba(200,75,75,0.1)",
                  border: "1px solid rgba(200,75,75,0.3)",
                  color: "var(--red)",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <AlertCircle size={16} /> {payrollError}
              </div>
            )}
          </div>

          {/* Quick Preview Calculator */}
          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "20px 24px",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <h4
              style={{
                fontSize: "13.5px",
                fontWeight: 700,
                color: "var(--text)",
                margin: "0 0 14px 0",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Calculator size={16} color="var(--amber)" /> Individual Employee Payroll Preview & Attendance Breakdown
            </h4>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <select
                value={genEmployeeId}
                onChange={(e) => setGenEmployeeId(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: "260px",
                  background: "#FFFFFF",
                  border: "1.5px solid #CBD5E1",
                  borderRadius: "8px",
                  padding: "9px 14px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--text)",
                }}
              >
                {employeeOptions.map((e) => (
                  <option key={e.id || (e as any)._id} value={e.id || (e as any)._id}>
                    {e.name} ({e.employee_code || (e as any).employeeCode}) — {e.department}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="secondary-button"
                onClick={() => handleCalculatePreview(genEmployeeId)}
                disabled={previewLoading || !genEmployeeId}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "9px 16px",
                  borderRadius: "8px",
                  background: "#FFFFFF",
                  border: "1.5px solid #CBD5E1",
                  color: "#18231F",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {previewLoading ? "Calculating..." : "Calculate Preview"}
              </button>
            </div>

            {selectedPreview && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "16px 20px",
                  background: "var(--panel2)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "16px",
                }}
              >
                <div>
                  <span style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                    Employee
                  </span>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)", marginTop: "2px" }}>
                    {selectedPreview.employee?.name}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                    Attendance Breakdown
                  </span>
                  <div style={{ fontSize: "12px", fontFamily: "monospace", color: "var(--text)", marginTop: "2px" }}>
                    Working: {selectedPreview.attendanceCycle?.workingDays} | Holidays: {selectedPreview.attendanceCycle?.companyHolidays} | Lates: {selectedPreview.attendanceCycle?.lateArrivalsCount}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                    Late Deductions
                  </span>
                  <div style={{ fontSize: "12px", fontFamily: "monospace", color: "var(--warning)", fontWeight: 700, marginTop: "2px" }}>
                    {selectedPreview.attendanceCycle?.lateHalfDayDeductions} Half-Days (every 3 lates)
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                    Net Calculated Salary
                  </span>
                  <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--green)", fontFamily: "monospace", marginTop: "2px" }}>
                    ₹{selectedPreview.netSalary?.toLocaleString("en-IN")}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Processed Records Table */}
          <Section title={`Cycle Payroll Register (${payrollRecords.length} Records)`}>
            <div style={{ overflowX: "auto", width: "100%" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "var(--panel2)", borderBottom: "1.5px solid var(--border)" }}>
                    <th style={{ padding: "12px 16px", fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Employee</th>
                    <th style={{ padding: "12px 16px", fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Department</th>
                    <th style={{ padding: "12px 16px", fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Gross</th>
                    <th style={{ padding: "12px 16px", fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Payable Days</th>
                    <th style={{ padding: "12px 16px", fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Attendance LOP</th>
                    <th style={{ padding: "12px 16px", fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>PF / PT</th>
                    <th style={{ padding: "12px 16px", fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Net Pay</th>
                    <th style={{ padding: "12px 16px", fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Status</th>
                    <th style={{ padding: "12px 16px", fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: "32px 16px", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
                        No payroll records generated for this cycle yet. Click &quot;Process Cycle Payroll&quot; above.
                      </td>
                    </tr>
                  ) : (
                    payrollRecords.map((r) => (
                      <tr key={r._id} style={{ borderBottom: "1px solid var(--line)" }}>
                        <td style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text)", fontSize: "13px" }}>{r.employee?.name}</td>
                        <td style={{ padding: "12px 16px", color: "var(--muted)", fontSize: "12.5px" }}>{r.employee?.department}</td>
                        <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: "13px", fontWeight: 700 }}>₹{r.grossSalary?.toLocaleString("en-IN")}</td>
                        <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: "12.5px" }}>{r.attendanceCycle?.payableDays} / {r.attendanceCycle?.totalCalendarDays}</td>
                        <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: "12.5px", color: "var(--warning)" }}>₹{r.attendanceDeduction?.toLocaleString("en-IN")}</td>
                        <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: "11.5px", color: "var(--muted)" }}>
                          PF: ₹{r.pfEmployee} | PT: ₹{r.professionalTax}
                        </td>
                        <td style={{ padding: "12px 16px", fontWeight: 800, color: "var(--green)", fontFamily: "monospace", fontSize: "14px" }}>
                          ₹{r.netSalary?.toLocaleString("en-IN")}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span
                            style={{
                              padding: "3px 10px",
                              borderRadius: "20px",
                              fontSize: "11px",
                              fontWeight: 700,
                              background: r.status === "Approved" ? "rgba(22,133,91,0.12)" : "rgba(201,135,23,0.12)",
                              color: r.status === "Approved" ? "var(--green)" : "var(--warning)",
                              border: `1px solid ${r.status === "Approved" ? "rgba(22,133,91,0.3)" : "rgba(201,135,23,0.3)"}`,
                            }}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          {r.status !== "Approved" && (
                            <button
                              type="button"
                              onClick={() => handleApprovePayroll(r._id)}
                              style={{
                                padding: "5px 12px",
                                borderRadius: "6px",
                                background: "#087A5B",
                                color: "#FFFFFF",
                                border: "none",
                                fontSize: "11.5px",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Approve
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      )}

      {/* --- TAB 2: SALARY STRUCTURES --- */}
      {activeTab === "structures" && !employee && (
        <Section
          title="Employee Salary Structures & Heads"
          action={
            <button
              type="button"
              className="primary-button"
              onClick={() => setStructModal(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                borderRadius: "8px",
                background: "linear-gradient(135deg, #087A5B 0%, #066349 100%)",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "12.5px",
                border: "none",
                cursor: "pointer",
              }}
            >
              <Plus size={14} /> Configure Structure
            </button>
          }
        >
          <div style={{ overflowX: "auto", width: "100%" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "var(--panel2)", borderBottom: "1.5px solid var(--border)" }}>
                  <th style={{ padding: "12px 16px", fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Employee</th>
                  <th style={{ padding: "12px 16px", fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Department</th>
                  <th style={{ padding: "12px 16px", fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Gross Salary</th>
                  <th style={{ padding: "12px 16px", fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Basic (₹)</th>
                  <th style={{ padding: "12px 16px", fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>HRA (₹)</th>
                  <th style={{ padding: "12px 16px", fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>PF Status</th>
                  <th style={{ padding: "12px 16px", fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>ESI Status</th>
                  <th style={{ padding: "12px 16px", fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Prof. Tax</th>
                </tr>
              </thead>
              <tbody>
                {structures.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: "32px 16px", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
                      No salary structures configured yet.
                    </td>
                  </tr>
                ) : (
                  structures.map((s) => (
                    <tr key={s._id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text)", fontSize: "13px" }}>{s.employee?.name}</td>
                      <td style={{ padding: "12px 16px", color: "var(--muted)", fontSize: "12.5px" }}>{s.employee?.department}</td>
                      <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: "13.5px", fontWeight: 800, color: "var(--text)" }}>
                        ₹{s.grossSalary?.toLocaleString("en-IN")}
                      </td>
                      <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: "13px" }}>₹{s.basicSalary?.toLocaleString("en-IN")}</td>
                      <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: "13px" }}>₹{s.hra?.toLocaleString("en-IN")}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: 700,
                            background: s.pfEnabled ? "rgba(22,133,91,0.12)" : "rgba(100,116,139,0.12)",
                            color: s.pfEnabled ? "var(--green)" : "var(--muted)",
                          }}
                        >
                          {s.pfEnabled ? `Enabled (${s.pfEmployeePercent}%)` : "Disabled"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: 700,
                            background: s.esiEnabled ? "rgba(22,133,91,0.12)" : "rgba(100,116,139,0.12)",
                            color: s.esiEnabled ? "var(--green)" : "var(--muted)",
                          }}
                        >
                          {s.esiEnabled ? `Enabled (${s.esiEmployeePercent}%)` : "Disabled"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: "13px" }}>₹{s.professionalTax}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* --- TAB 3: HOLIDAY CALENDAR --- */}
      {activeTab === "holidays" && !employee && (
        <Section
          title="Company Holiday Calendar (Asia/Kolkata)"
          action={
            <button
              type="button"
              className="primary-button"
              onClick={() => setHolidayModal(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                borderRadius: "8px",
                background: "linear-gradient(135deg, #087A5B 0%, #066349 100%)",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "12.5px",
                border: "none",
                cursor: "pointer",
              }}
            >
              <Plus size={14} /> Add Holiday
            </button>
          }
        >
          <div
            style={{
              padding: "16px 20px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "16px",
            }}
          >
            {holidays.map((h) => (
              <div
                key={h.id}
                style={{
                  background: "var(--panel)",
                  border: "1.5px solid var(--border)",
                  borderRadius: "10px",
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  position: "relative",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        fontFamily: "monospace",
                        background: "var(--soft-brand-bg)",
                        color: "var(--amber)",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        border: "1px solid rgba(8,122,91,0.2)",
                      }}
                    >
                      {h.date}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteHoliday(h.id)}
                      title="Delete Holiday"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#94A3B8",
                        cursor: "pointer",
                        padding: "4px",
                        borderRadius: "4px",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <h4 style={{ margin: "4px 0", fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>{h.name}</h4>
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>{h.description || "Official Paid Holiday"}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* --- TAB 4: PAYSLIPS LIST --- */}
      {activeTab === "slips" && (
        <Section title={employee ? "My Payslips" : "Generated Payslips"}>
          {slipsData.length === 0 ? (
            <EmptyState
              title="No salary slips found"
              text="Generated salary slips will appear here."
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {slipsData.map((slip) => (
                <div
                  key={slip.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 20px",
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <Avatar name={slip.employee_name} />
                    <div>
                      <h4 style={{ margin: 0, fontSize: "13.5px", fontWeight: 700, color: "var(--text)" }}>{slip.employee_name}</h4>
                      <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: "var(--muted)" }}>
                        {monthName(slip.month)} {slip.year} • Net Pay: <strong style={{ color: "var(--green)" }}>₹{Number(slip.net_salary).toLocaleString("en-IN")}</strong>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
                      window.open(`http://${host}:8000/api/salary-slips/${slip.id}/download/`, "_blank");
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      background: "var(--soft-brand-bg)",
                      color: "var(--amber)",
                      border: "1px solid rgba(8,122,91,0.25)",
                      borderRadius: "6px",
                      padding: "6px 12px",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Download size={14} /> Download PDF
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Modal for Salary Structure Configuration */}
      {structModal && (
        <Modal onClose={() => setStructModal(false)} title="Configure Salary Structure">
          <form onSubmit={handleSaveStructure} className="form-grid">
            <div style={{ gridColumn: "1 / -1" }}>
              <label>Select Employee</label>
              <select
                value={selectedEmpForStruct}
                onChange={(e) => setSelectedEmpForStruct(e.target.value)}
                required
              >
                {employeeOptions.map((e) => (
                  <option key={e.id || (e as any)._id} value={e.id || (e as any)._id}>
                    {e.name} ({e.employee_code || (e as any).employeeCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Monthly Gross (₹)</label>
              <input
                type="number"
                value={structGross}
                onChange={(e) => setStructGross(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label>Basic Salary (₹)</label>
              <input
                type="number"
                value={structBasic}
                onChange={(e) => setStructBasic(Number(e.target.value))}
                required
              />
            </div>

            <div>
              <label>HRA (₹)</label>
              <input
                type="number"
                value={structHra}
                onChange={(e) => setStructHra(Number(e.target.value))}
              />
            </div>
            <div>
              <label>Conveyance (₹)</label>
              <input
                type="number"
                value={structConveyance}
                onChange={(e) => setStructConveyance(Number(e.target.value))}
              />
            </div>
            <div>
              <label>Special Allowance (₹)</label>
              <input
                type="number"
                value={structSpecial}
                onChange={(e) => setStructSpecial(Number(e.target.value))}
              />
            </div>
            <div>
              <label>Professional Tax (₹)</label>
              <input
                type="number"
                value={structProfTax}
                onChange={(e) => setStructProfTax(Number(e.target.value))}
              />
            </div>

            <div style={{ gridColumn: "1 / -1", display: "flex", gap: "20px", marginTop: "10px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "12px" }}>
                <input
                  type="checkbox"
                  checked={structPfEnabled}
                  onChange={(e) => setStructPfEnabled(e.target.checked)}
                />
                PF Enabled (12% capped at ₹15,000 ceiling)
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "12px" }}>
                <input
                  type="checkbox"
                  checked={structEsiEnabled}
                  onChange={(e) => setStructEsiEnabled(e.target.checked)}
                />
                ESI Enabled (0.75% / 3.25% if Gross ≤ ₹21k)
              </label>
            </div>

            <div className="form-actions" style={{ gridColumn: "1 / -1" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setStructModal(false)}
              >
                Cancel
              </button>
              <PrimaryButton type="submit">Save Structure</PrimaryButton>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal for Holiday Creation */}
      {holidayModal && (
        <Modal onClose={() => setHolidayModal(false)} title="Add Company Holiday">
          <form onSubmit={handleSaveHoliday} className="form-grid">
            <div style={{ gridColumn: "1 / -1" }}>
              <label>Holiday Name</label>
              <input
                type="text"
                value={newHolidayName}
                onChange={(e) => setNewHolidayName(e.target.value)}
                placeholder="e.g. Independence Day"
                required
              />
            </div>
            <div>
              <label>Holiday Date (YYYY-MM-DD)</label>
              <input
                type="date"
                value={newHolidayDate}
                onChange={(e) => setNewHolidayDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label>Holiday Type</label>
              <select
                value={newHolidayType}
                onChange={(e) => setNewHolidayType(e.target.value)}
              >
                <option value="Company">Company Holiday</option>
                <option value="Public">Public / National Holiday</option>
                <option value="Restricted">Restricted Holiday</option>
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label>Description (Optional)</label>
              <input
                type="text"
                value={newHolidayDesc}
                onChange={(e) => setNewHolidayDesc(e.target.value)}
                placeholder="e.g. Official Public celebration"
              />
            </div>
            <div className="form-actions" style={{ gridColumn: "1 / -1" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setHolidayModal(false)}
              >
                Cancel
              </button>
              <PrimaryButton type="submit">Create Holiday</PrimaryButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
