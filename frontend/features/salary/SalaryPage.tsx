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
  RefreshCw,
  Lock,
  Unlock,
  Eye,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Info,
  DollarSign,
  Briefcase,
  Sliders,
  History,
  FileText,
} from "lucide-react";
import { Employee, Paginated, SalarySlip } from "@/lib/types";
import { api } from "@/lib/api";
import { toast } from "@/components/ToastContext";
import { Avatar } from "@/components/icons";
import { EmptyState, PageHeader, PrimaryButton, Section } from "@/components/ui";
import { Modal } from "@/features/common/Modal";
import { getAttendanceCycleForMonth, getISTDateString } from "@/lib/tzUtils";

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function SalaryPage({ employee = false }: { employee?: boolean }) {
  const [activeTab, setActiveTab] = useState<"slips" | "payroll" | "structures" | "heads" | "holidays" | "reports">("slips");

  // --- Slips State ---
  const [slipsData, setSlipsData] = useState<SalarySlip[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSlipDetail, setSelectedSlipDetail] = useState<SalarySlip | null>(null);

  // --- Payroll Engine Tab State ---
  const [payrollRecords, setPayrollRecords] = useState<any[]>([]);
  const [payrollMonth, setPayrollMonth] = useState(new Date().getMonth() + 1);
  const [payrollYear, setPayrollYear] = useState(new Date().getFullYear());
  const [selectedPreview, setSelectedPreview] = useState<any | null>(null);
  const [processingCycle, setProcessingCycle] = useState(false);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [payrollError, setPayrollError] = useState("");
  const [payrollSuccess, setPayrollSuccess] = useState("");
  
  // Unlock Modal
  const [unlockModal, setUnlockModal] = useState(false);
  const [unlockRecordId, setUnlockRecordId] = useState("");
  const [unlockReason, setUnlockReason] = useState("");

  // --- Salary Structures Tab State ---
  const [structures, setStructures] = useState<any[]>([]);
  const [structModal, setStructModal] = useState(false);
  const [selectedEmpForStruct, setSelectedEmpForStruct] = useState("");
  const [structEffectiveFrom, setStructEffectiveFrom] = useState(getISTDateString());
  const [structGross, setStructGross] = useState(50000);
  const [structBasic, setStructBasic] = useState(25000);
  const [structHra, setStructHra] = useState(12500);
  const [structConveyance, setStructConveyance] = useState(3000);
  const [structSpecial, setStructSpecial] = useState(9500);
  const [structOther, setStructOther] = useState(0);
  const [structPfApplicable, setStructPfApplicable] = useState(true);
  const [structVoluntaryPf, setStructVoluntaryPf] = useState(false);
  const [structEsiApplicable, setStructEsiApplicable] = useState(false);
  const [structProfTaxApplicable, setStructProfTaxApplicable] = useState(true);
  const [structProfTax, setStructProfTax] = useState(200);
  const [structTdsApplicable, setStructTdsApplicable] = useState(false);
  const [structTds, setStructTds] = useState(0);
  const [structNotes, setStructNotes] = useState("");
  const [historyModal, setHistoryModal] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<any[]>([]);

  // --- Salary Heads Master State ---
  const [salaryHeads, setSalaryHeads] = useState<any[]>([]);
  const [headModal, setHeadModal] = useState(false);
  const [headName, setHeadName] = useState("");
  const [headCode, setHeadCode] = useState("");
  const [headType, setHeadType] = useState<"Earning" | "Deduction" | "EmployerContribution">("Earning");
  const [headCalcType, setHeadCalcType] = useState<"Fixed" | "Percentage" | "Formula">("Fixed");
  const [headFormula, setHeadFormula] = useState("");
  const [headPercentage, setHeadPercentage] = useState(0);
  const [headAmount, setHeadAmount] = useState(0);
  const [headTaxable, setHeadTaxable] = useState(true);
  const [headPfEligible, setHeadPfEligible] = useState(false);
  const [headEsiEligible, setHeadEsiEligible] = useState(false);

  // --- Holidays Tab State (Visual Calendar) ---
  const [holidays, setHolidays] = useState<any[]>([]);
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [holidayModal, setHolidayModal] = useState(false);
  const [editHolidayId, setEditHolidayId] = useState<string | null>(null);
  const [newHolidayName, setNewHolidayName] = useState("");
  const [newHolidayDate, setNewHolidayDate] = useState(getISTDateString());
  const [newHolidayType, setNewHolidayType] = useState("Company");
  const [newHolidayDesc, setNewHolidayDesc] = useState("");
  const [newHolidayPaid, setNewHolidayPaid] = useState(true);
  const [newHolidayAll, setNewHolidayAll] = useState(true);
  const [newHolidayRecurring, setNewHolidayRecurring] = useState(false);

  // --- Reports Tab State ---
  const [reportType, setReportType] = useState<"summary" | "statutory" | "attendance" | "leave">("summary");
  const [reportData, setReportData] = useState<any | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

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

  const loadSalaryHeads = () => {
    api<{ results: any[] }>(`/salary-heads/`)
      .then((res) => setSalaryHeads(res.results || []))
      .catch(() => setSalaryHeads([]));
  };

  const loadHolidays = () => {
    api<{ results: any[] }>(`/holidays/?year=${calYear}`)
      .then((res) => setHolidays(res.results || []))
      .catch(() => setHolidays([]));
  };

  const loadReport = () => {
    setReportLoading(true);
    let endpoint = `/payroll/reports/summary/?month=${payrollMonth}&year=${payrollYear}`;
    if (reportType === "statutory") endpoint = `/payroll/reports/statutory/?month=${payrollMonth}&year=${payrollYear}`;
    if (reportType === "attendance") endpoint = `/payroll/reports/attendance-impact/?month=${payrollMonth}&year=${payrollYear}`;
    if (reportType === "leave") endpoint = `/payroll/reports/leave-conversion/?month=${payrollMonth}&year=${payrollYear}`;

    api<any>(endpoint)
      .then((res) => setReportData(res))
      .catch(() => setReportData(null))
      .finally(() => setReportLoading(false));
  };

  useEffect(() => {
    loadSlips();
    api<Paginated<Employee> | Employee[]>("/employees/?limit=100")
      .then((res) => setEmployeeOptions(Array.isArray(res) ? res : res.results || []))
      .catch(() => setEmployeeOptions([]));
  }, []);

  useEffect(() => {
    if (activeTab === "payroll") loadPayrollRecords();
    if (activeTab === "structures") loadStructures();
    if (activeTab === "heads") loadSalaryHeads();
    if (activeTab === "holidays") loadHolidays();
    if (activeTab === "reports") loadReport();
  }, [activeTab, payrollMonth, payrollYear, calYear, reportType]);

  // Actions: Process Cycle
  const handleProcessCycle = async () => {
    setProcessingCycle(true);
    setPayrollError("");
    setPayrollSuccess("");
    try {
      const res = await api<any>("/payroll/process-cycle/", {
        method: "POST",
        body: JSON.stringify({ month: payrollMonth, year: payrollYear }),
      });
      setPayrollSuccess(`Payroll computed successfully for ${res.cycle} (${res.total_processed} processed)`);
      loadPayrollRecords();
    } catch (err: any) {
      setPayrollError(err.message || "Failed to process payroll cycle");
    } finally {
      setProcessingCycle(false);
    }
  };

  // Actions: Reprocess Single Employee
  const handleReprocessSingle = async (recordId: string) => {
    setReprocessingId(recordId);
    setPayrollError("");
    setPayrollSuccess("");
    try {
      const res = await api<any>(`/payroll/${recordId}/reprocess/`, {
        method: "POST",
      });
      setPayrollSuccess(res.message || "Salary reprocessed successfully");
      loadPayrollRecords();
    } catch (err: any) {
      setPayrollError(err.message || "Failed to reprocess salary");
    } finally {
      setReprocessingId(null);
    }
  };

  // Actions: Approve Record
  const handleApproveRecord = async (recordId: string) => {
    try {
      await api(`/payroll/${recordId}/approve/`, { method: "POST" });
      setPayrollSuccess("Payroll record approved successfully");
      loadPayrollRecords();
    } catch (err: any) {
      setPayrollError(err.message || "Failed to approve payroll record");
    }
  };

  // Actions: Mark Paid
  const handleMarkPaid = async (recordId: string) => {
    try {
      await api(`/payroll/${recordId}/mark-paid/`, { method: "POST" });
      setPayrollSuccess("Payroll record marked as PAID and payslip generated");
      loadPayrollRecords();
      loadSlips();
    } catch (err: any) {
      setPayrollError(err.message || "Failed to mark as paid");
    }
  };

  // Actions: Unlock Reopen
  const handleUnlockRecord = async (e: FormEvent) => {
    e.preventDefault();
    if (!unlockReason.trim()) {
      toast.warning("Mandatory reason is required for unlocking payroll record.");
      return;
    }
    try {
      await api(`/payroll/${unlockRecordId}/unlock/`, {
        method: "POST",
        body: JSON.stringify({ reason: unlockReason.trim() }),
      });
      setUnlockModal(false);
      setUnlockReason("");
      setPayrollSuccess("Payroll record unlocked successfully and reverted to Calculated status.");
      toast.success("Payroll record unlocked successfully.");
      loadPayrollRecords();
    } catch (err: any) {
      toast.error(err.message || "Failed to unlock record");
    }
  };

  // Save Salary Structure
  const handleSaveStructure = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedEmpForStruct) return;
    try {
      await api("/salary-structures/", {
        method: "POST",
        body: JSON.stringify({
          employee: selectedEmpForStruct,
          effectiveFrom: structEffectiveFrom,
          grossSalary: structGross,
          basicSalary: structBasic,
          hra: structHra,
          conveyance: structConveyance,
          specialAllowance: structSpecial,
          otherAllowances: structOther,
          pfApplicable: structPfApplicable,
          voluntaryPfAboveCeiling: structVoluntaryPf,
          esiApplicable: structEsiApplicable,
          professionalTaxApplicable: structProfTaxApplicable,
          professionalTax: structProfTax,
          tdsApplicable: structTdsApplicable,
          tds: structTds,
          notes: structNotes,
        }),
      });
      setStructModal(false);
      toast.success("Salary structure saved successfully.");
      loadStructures();
    } catch (err: any) {
      toast.error(err.message || "Failed to save salary structure");
    }
  };

  // Save Salary Head
  const handleSaveSalaryHead = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api("/salary-heads/", {
        method: "POST",
        body: JSON.stringify({
          name: headName,
          code: headCode.toUpperCase(),
          type: headType,
          calculation_type: headCalcType,
          percentage: headPercentage,
          formula: headFormula,
          default_amount: headAmount,
          taxable: headTaxable,
          pf_eligible: headPfEligible,
          esi_eligible: headEsiEligible,
        }),
      });
      setHeadModal(false);
      setHeadName("");
      setHeadCode("");
      setHeadFormula("");
      toast.success("Salary head created successfully.");
      loadSalaryHeads();
    } catch (err: any) {
      toast.error(err.message || "Failed to create salary head");
    }
  };

  // Save / Update Holiday
  const handleSaveHoliday = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editHolidayId) {
        await api(`/holidays/${editHolidayId}/`, {
          method: "PUT",
          body: JSON.stringify({
            name: newHolidayName,
            date: newHolidayDate,
            holiday_type: newHolidayType,
            description: newHolidayDesc,
            is_paid: newHolidayPaid,
            applicable_to_all: newHolidayAll,
            recurring_annually: newHolidayRecurring,
          }),
        });
      } else {
        await api("/holidays/", {
          method: "POST",
          body: JSON.stringify({
            name: newHolidayName,
            date: newHolidayDate,
            holiday_type: newHolidayType,
            description: newHolidayDesc,
            is_paid: newHolidayPaid,
            applicable_to_all: newHolidayAll,
            recurring_annually: newHolidayRecurring,
          }),
        });
      }
      setHolidayModal(false);
      setEditHolidayId(null);
      setNewHolidayName("");
      toast.success("Company holiday saved successfully.");
      loadHolidays();
    } catch (err: any) {
      toast.error(err.message || "Failed to save holiday");
    }
  };

  // Delete Holiday
  const handleDeleteHoliday = async (holidayId: string) => {
    if (!confirm("Are you sure you want to delete this company holiday?")) return;
    try {
      await api(`/holidays/${holidayId}/`, { method: "DELETE" });
      toast.success("Holiday deleted.");
      loadHolidays();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete holiday");
    }
  };

  // Visual Calendar Generator for Company Holidays
  const renderVisualCalendar = () => {
    const firstDay = new Date(calYear, calMonth - 1, 1);
    const startingDayOfWeek = firstDay.getDay(); // 0 is Sunday
    const daysInMonth = new Date(calYear, calMonth, 0).getDate();

    const holidayMap = new Map<string, any>();
    holidays.forEach((h) => {
      const d = h.dateStr || (h.date ? h.date.split("T")[0] : "");
      if (d) holidayMap.set(d, h);
    });

    const days = [];
    // Leading empty cells
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} style={{ height: "90px", backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "6px" }} />);
    }

    // Actual month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayDate = new Date(calYear, calMonth - 1, d);
      const isSunday = dayDate.getDay() === 0;
      const holiday = holidayMap.get(dateStr);

      days.push(
        <div
          key={dateStr}
          onClick={() => {
            if (!employee) {
              if (holiday) {
                setEditHolidayId(holiday.id || holiday._id);
                setNewHolidayName(holiday.name);
                setNewHolidayDate(holiday.dateStr || dateStr);
                setNewHolidayType(holiday.holiday_type || holiday.holidayType || "Company");
                setNewHolidayDesc(holiday.description || "");
                setNewHolidayPaid(holiday.is_paid !== undefined ? holiday.is_paid : holiday.isPaid !== undefined ? holiday.isPaid : true);
                setHolidayModal(true);
              } else {
                setEditHolidayId(null);
                setNewHolidayName("");
                setNewHolidayDate(dateStr);
                setHolidayModal(true);
              }
            }
          }}
          style={{
            height: "90px",
            padding: "8px",
            backgroundColor: holiday ? "#F0FDF4" : isSunday ? "#FEF2F2" : "#FFFFFF",
            border: holiday ? "1.5px solid #087A5B" : isSunday ? "1px solid #FECACA" : "1px solid #E2E8F0",
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            cursor: !employee ? "pointer" : "default",
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "14px", fontWeight: 700, color: isSunday ? "#DC2626" : "#0F172A" }}>
              {d}
            </span>
            {isSunday && (
              <span style={{ fontSize: "10px", fontWeight: 600, color: "#DC2626", backgroundColor: "#FEE2E2", padding: "1px 6px", borderRadius: "10px" }}>
                Sunday
              </span>
            )}
            {holiday && (
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#087A5B", backgroundColor: "#D1FAE5", padding: "2px 6px", borderRadius: "10px" }}>
                {holiday.holiday_type || holiday.holidayType || "Holiday"}
              </span>
            )}
          </div>
          {holiday && (
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#065F46", lineHeight: 1.2 }}>
                {holiday.name}
              </div>
              <div style={{ fontSize: "10px", color: holiday.is_paid || holiday.isPaid ? "#059669" : "#DC2626", marginTop: "2px" }}>
                {holiday.is_paid || holiday.isPaid ? "● Paid Holiday" : "○ Unpaid"}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="table-responsive-wrapper" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ minWidth: "640px", display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "8px" }}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName, idx) => (
            <div
              key={dayName}
              style={{
                textAlign: "center",
                padding: "8px",
                fontWeight: 700,
                fontSize: "13px",
                color: idx === 0 ? "#DC2626" : "#475569",
                backgroundColor: idx === 0 ? "#FEE2E2" : "#F1F5F9",
                borderRadius: "6px",
              }}
            >
              {dayName}
            </div>
          ))}
          {days}
        </div>
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="Enterprise Payroll & Salary Operations"
        subtitle={`Canonical Cycle: 26th of Previous Month → 25th of Current Month (Asia/Kolkata IST)`}
        action={
          !employee && activeTab === "payroll" ? (
            <PrimaryButton onClick={handleProcessCycle} disabled={processingCycle}>
              <Calculator style={{ width: "16px", height: "16px", marginRight: "8px" }} />
              {processingCycle ? "Computing Payroll..." : `Process ${monthNames[payrollMonth - 1]} ${payrollYear}`}
            </PrimaryButton>
          ) : !employee && activeTab === "structures" ? (
            <PrimaryButton onClick={() => setStructModal(true)}>
              <Plus style={{ width: "16px", height: "16px", marginRight: "8px" }} />
              Configure Salary Profile
            </PrimaryButton>
          ) : !employee && activeTab === "heads" ? (
            <PrimaryButton onClick={() => setHeadModal(true)}>
              <Plus style={{ width: "16px", height: "16px", marginRight: "8px" }} />
              New Salary Head
            </PrimaryButton>
          ) : !employee && activeTab === "holidays" ? (
            <PrimaryButton onClick={() => setHolidayModal(true)}>
              <Plus style={{ width: "16px", height: "16px", marginRight: "8px" }} />
              Add Company Holiday
            </PrimaryButton>
          ) : undefined
        }
      />

      {/* Horizontal Tabs Header */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #E2E8F0", paddingBottom: "8px", marginBottom: "24px", overflowX: "auto", whiteSpace: "nowrap" }}>
        {[
          { key: "slips", label: "Payslips & History", icon: Receipt },
          ...(!employee
            ? [
                { key: "payroll", label: "Payroll Engine", icon: Calculator },
                { key: "structures", label: "Salary Master & Structures", icon: Sliders },
                { key: "heads", label: "Salary Head Library", icon: Layers },
                { key: "reports", label: "Statutory & Payroll Reports", icon: FileSpreadsheet },
              ]
            : []),
          { key: "holidays", label: "Holiday Calendar", icon: Calendar },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: isActive ? 700 : 500,
                color: isActive ? "#FFFFFF" : "#475569",
                backgroundColor: isActive ? "#087A5B" : "transparent",
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <Icon style={{ width: "16px", height: "16px" }} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {payrollSuccess && (
        <div style={{ padding: "12px 16px", backgroundColor: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: "8px", color: "#065F46", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
          <CheckCircle2 style={{ width: "18px", height: "18px", flexShrink: 0 }} />
          <span>{payrollSuccess}</span>
        </div>
      )}

      {payrollError && (
        <div style={{ padding: "12px 16px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", color: "#991B1B", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertCircle style={{ width: "18px", height: "18px", flexShrink: 0 }} />
          <span>{payrollError}</span>
        </div>
      )}

      {/* TAB 1: PAYSLIPS */}
      {activeTab === "slips" && (
        <Section title="Employee Salary Slips" kicker="Itemized monthly payslips with verified attendance and statutory breakdown">
          {loading ? (
            <div style={{ padding: "32px", textAlign: "center", color: "#64748B" }}>Loading payslips...</div>
          ) : slipsData.length === 0 ? (
            <EmptyState title="No salary slips issued" text="Payslips will appear here once payroll cycles are processed and finalized." />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
              {slipsData.map((slip) => (
                <div
                  key={slip.id}
                  style={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: "12px",
                    padding: "20px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
                        {monthNames[slip.month - 1]} {slip.year}
                      </h4>
                      <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748B" }}>
                        Period: {slip.cycle_start_date || "26th"} → {slip.cycle_end_date || "25th"}
                      </p>
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "12px", backgroundColor: "#D1FAE5", color: "#065F46" }}>
                      {slip.status || "Finalized"}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", margin: "16px 0", padding: "12px", backgroundColor: "#F8FAFC", borderRadius: "8px" }}>
                    <div>
                      <div style={{ fontSize: "11px", color: "#64748B" }}>Gross Pay</div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A" }}>₹{slip.gross_salary?.toLocaleString()}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", color: "#64748B" }}>Deductions</div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "#DC2626" }}>₹{slip.total_deductions?.toLocaleString()}</div>
                    </div>
                    <div style={{ gridColumn: "span 2", borderTop: "1px solid #E2E8F0", paddingTop: "8px" }}>
                      <div style={{ fontSize: "11px", color: "#64748B" }}>Net Payable Salary</div>
                      <div style={{ fontSize: "18px", fontWeight: 800, color: "#087A5B" }}>₹{slip.net_salary?.toLocaleString()}</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    {slip.pdf_url && (
                      <a
                        href={slip.pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                          padding: "8px",
                          backgroundColor: "#087A5B",
                          color: "#FFFFFF",
                          borderRadius: "6px",
                          fontSize: "13px",
                          fontWeight: 600,
                          textDecoration: "none",
                        }}
                      >
                        <Download style={{ width: "14px", height: "14px" }} />
                        Download PDF
                      </a>
                    )}
                    <button
                      onClick={() => setSelectedSlipDetail(slip)}
                      style={{
                        padding: "8px 12px",
                        backgroundColor: "#F1F5F9",
                        border: "1px solid #CBD5E1",
                        borderRadius: "6px",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#334155",
                        cursor: "pointer",
                      }}
                    >
                      <Eye style={{ width: "14px", height: "14px" }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* TAB 2: PAYROLL ENGINE */}
      {activeTab === "payroll" && !employee && (
        <div>
          {/* Month & Cycle Selector Banner */}
          <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "20px", marginBottom: "24px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>
                  {monthNames[payrollMonth - 1]} {payrollYear}
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748B" }}>
                  Cycle Period: <strong style={{ color: "#0F172A" }}>{cycleInfo.readablePeriod || `${cycleInfo.startStr} → ${cycleInfo.endStr}`}</strong> • Total Calendar Days: {cycleInfo.totalCalendarDays} • Week Offs (Sundays): {cycleInfo.weekOffs} • <strong>Salary Days: {cycleInfo.salaryDays}</strong>
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <select
                  value={payrollMonth}
                  onChange={(e) => setPayrollMonth(Number(e.target.value))}
                  style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px", fontWeight: 600 }}
                >
                  {monthNames.map((name, idx) => (
                    <option key={name} value={idx + 1}>{name}</option>
                  ))}
                </select>

                <select
                  value={payrollYear}
                  onChange={(e) => setPayrollYear(Number(e.target.value))}
                  style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px", fontWeight: 600 }}
                >
                  {[2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>

                <button
                  onClick={loadPayrollRecords}
                  style={{ padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1", backgroundColor: "#F8FAFC", cursor: "pointer" }}
                >
                  <RefreshCw style={{ width: "16px", height: "16px", color: "#475569" }} />
                </button>
              </div>
            </div>
          </div>

          {/* Records Table */}
          <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "12px", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                <thead>
                  <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Employee</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Present / Payable</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Gross Pay</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Deductions</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Net Salary</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Status</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "#64748B" }}>
                        No payroll computed for this cycle yet. Click "Process {monthNames[payrollMonth - 1]} {payrollYear}" above.
                      </td>
                    </tr>
                  ) : (
                    payrollRecords.map((r) => {
                      const hasZeroAttendance =
                        (r.attendanceCycle?.presentDays || 0) === 0 &&
                        (r.attendanceCycle?.halfDays || 0) === 0 &&
                        (r.attendanceCycle?.paidLeaveDays || 0) === 0;

                      return (
                        <tr key={r._id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                          <td style={{ padding: "12px 16px" }}>
                            <div style={{ fontWeight: 700, color: "#0F172A" }}>{r.employee?.name}</div>
                            <div style={{ fontSize: "11px", color: "#64748B" }}>{r.employee?.employeeCode} • {r.employee?.department}</div>
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            {hasZeroAttendance ? (
                              <div>
                                <div style={{ fontWeight: 700, color: "#DC2626" }}>0 Days (0 Present)</div>
                                <span style={{ fontSize: "10px", fontWeight: 700, color: "#DC2626", backgroundColor: "#FEE2E2", padding: "2px 6px", borderRadius: "4px", display: "inline-block", marginTop: "2px" }}>
                                  Zero Attendance
                                </span>
                              </div>
                            ) : (
                              <div>
                                <div style={{ fontWeight: 600, color: "#087A5B" }}>{r.attendanceCycle?.payableDays} Days</div>
                                <div style={{ fontSize: "11px", color: "#64748B" }}>Present: {r.attendanceCycle?.presentDays} | LOP: {r.attendanceCycle?.unpaidDays}</div>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "12px 16px", fontWeight: 600 }}>₹{r.grossSalary?.toLocaleString()}</td>
                          <td style={{ padding: "12px 16px", fontWeight: 600, color: "#DC2626" }}>₹{r.totalDeductions?.toLocaleString()}</td>
                          <td style={{ padding: "12px 16px", fontWeight: 800, color: hasZeroAttendance ? "#94A3B8" : "#087A5B", fontSize: "15px" }}>
                            {hasZeroAttendance ? "₹0" : `₹${r.netSalary?.toLocaleString()}`}
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 700,
                                padding: "3px 8px",
                                borderRadius: "12px",
                                backgroundColor: r.status === "Paid" ? "#D1FAE5" : r.status === "Approved" ? "#DBEAFE" : "#FEF3C7",
                                color: r.status === "Paid" ? "#065F46" : r.status === "Approved" ? "#1E40AF" : "#92400E",
                              }}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: "6px" }}>
                              {/* Reprocess Single Employee */}
                              <button
                                onClick={() => handleReprocessSingle(r._id)}
                                disabled={reprocessingId === r._id || r.status === "Paid"}
                                title="Reprocess Single Employee"
                                style={{
                                  padding: "6px 10px",
                                  backgroundColor: "#F1F5F9",
                                  border: "1px solid #CBD5E1",
                                  borderRadius: "6px",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  color: "#334155",
                                  cursor: "pointer",
                                }}
                              >
                                <RefreshCw style={{ width: "12px", height: "12px", marginRight: "4px" }} />
                                {reprocessingId === r._id ? "Calculating..." : "Reprocess"}
                              </button>

                              {/* Approve */}
                              {r.status === "Calculated" && (
                                hasZeroAttendance ? (
                                  <span
                                    title="Cannot approve: Employee has 0 attendance records for this cycle. Record or regularize attendance first."
                                    style={{
                                      padding: "6px 10px",
                                      backgroundColor: "#FEE2E2",
                                      color: "#991B1B",
                                      border: "1px solid #FECACA",
                                      borderRadius: "6px",
                                      fontSize: "11px",
                                      fontWeight: 700,
                                      cursor: "not-allowed",
                                      display: "inline-flex",
                                      alignItems: "center",
                                    }}
                                  >
                                    No Attendance
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleApproveRecord(r._id)}
                                    style={{
                                      padding: "6px 10px",
                                      backgroundColor: "#087A5B",
                                      border: "none",
                                      borderRadius: "6px",
                                      fontSize: "12px",
                                      fontWeight: 600,
                                      color: "#FFFFFF",
                                      cursor: "pointer",
                                    }}
                                  >
                                    Approve
                                  </button>
                                )
                              )}

                              {/* Mark Paid */}
                              {r.status === "Approved" && (
                                <button
                                  onClick={() => handleMarkPaid(r._id)}
                                  style={{
                                    padding: "6px 10px",
                                    backgroundColor: "#2563EB",
                                    border: "none",
                                    borderRadius: "6px",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    color: "#FFFFFF",
                                    cursor: "pointer",
                                  }}
                                >
                                  Mark Paid
                                </button>
                              )}

                              {/* Super Admin Unlock */}
                              {(r.status === "Approved" || r.status === "Paid") && (
                                <button
                                  onClick={() => {
                                    setUnlockRecordId(r._id);
                                    setUnlockModal(true);
                                  }}
                                  title="Super Admin Unlock"
                                  style={{
                                    padding: "6px 10px",
                                    backgroundColor: "#FEF2F2",
                                    border: "1px solid #FECACA",
                                    borderRadius: "6px",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    color: "#DC2626",
                                    cursor: "pointer",
                                  }}
                                >
                                  <Unlock style={{ width: "12px", height: "12px" }} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SALARY MASTER & STRUCTURES */}
      {activeTab === "structures" && !employee && (
        <Section title="Employee Salary Profiles" kicker="Manage effective-dated structures with explicit PF, ESI, PT, TDS statutory flags">
          {structures.length === 0 ? (
            <EmptyState
              title="No salary profiles configured"
              text="Click 'Configure Salary Profile' above to set up an employee's compensation breakdown."
            />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
              {structures.map((s) => (
                <div key={s._id} style={{ backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "12px" }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#0F172A" }}>{s.employee?.name}</h4>
                      <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: "#64748B" }}>{s.employee?.employeeCode} • {s.employee?.department}</p>
                    </div>
                    <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "3px 8px", borderRadius: "12px", backgroundColor: "#D1FAE5", color: "#065F46", whiteSpace: "nowrap", flexShrink: 0 }}>
                      Active Structure
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", padding: "10px", backgroundColor: "#F8FAFC", borderRadius: "8px", margin: "12px 0" }}>
                    <div>
                      <div style={{ fontSize: "10.5px", color: "#64748B" }}>Fixed Gross</div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>₹{s.grossSalary?.toLocaleString()}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "10.5px", color: "#64748B" }}>Basic Salary</div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>₹{s.basicSalary?.toLocaleString()}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "10.5px", color: "#64748B" }}>HRA</div>
                      <div style={{ fontSize: "12.5px", fontWeight: 600 }}>₹{s.hra?.toLocaleString()}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "10.5px", color: "#64748B" }}>Special Allowance</div>
                      <div style={{ fontSize: "12.5px", fontWeight: 600 }}>₹{s.specialAllowance?.toLocaleString()}</div>
                    </div>
                  </div>

                  {/* Statutory Badges */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px" }}>
                    <span style={{ fontSize: "10.5px", fontWeight: 600, padding: "2px 7px", borderRadius: "6px", backgroundColor: s.pfApplicable !== false && s.pfEnabled !== false ? "#ECFDF5" : "#F1F5F9", color: s.pfApplicable !== false && s.pfEnabled !== false ? "#065F46" : "#94A3B8" }}>
                      PF: {s.pfApplicable !== false && s.pfEnabled !== false ? "Yes (12%)" : "No"}
                    </span>
                    <span style={{ fontSize: "10.5px", fontWeight: 600, padding: "2px 7px", borderRadius: "6px", backgroundColor: s.esiApplicable || s.esiEnabled ? "#ECFDF5" : "#F1F5F9", color: s.esiApplicable || s.esiEnabled ? "#065F46" : "#94A3B8" }}>
                      ESI: {s.esiApplicable || s.esiEnabled ? "Yes" : "No"}
                    </span>
                    <span style={{ fontSize: "10.5px", fontWeight: 600, padding: "2px 7px", borderRadius: "6px", backgroundColor: s.professionalTaxApplicable !== false ? "#ECFDF5" : "#F1F5F9", color: s.professionalTaxApplicable !== false ? "#065F46" : "#94A3B8" }}>
                      PT: {s.professionalTaxApplicable !== false ? `₹${s.professionalTax || 200}` : "No"}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => {
                        setSelectedEmpForStruct(s.employee?._id || s.employee);
                        setStructGross(s.grossSalary || 50000);
                        setStructBasic(s.basicSalary || 25000);
                        setStructHra(s.hra || 12500);
                        setStructConveyance(s.conveyance || 3000);
                        setStructSpecial(s.specialAllowance || 9500);
                        setStructOther(s.otherAllowances || 0);
                        setStructPfApplicable(s.pfApplicable !== undefined ? s.pfApplicable : s.pfEnabled !== false);
                        setStructVoluntaryPf(Boolean(s.voluntaryPfAboveCeiling));
                        setStructEsiApplicable(s.esiApplicable !== undefined ? s.esiApplicable : Boolean(s.esiEnabled));
                        setStructProfTaxApplicable(s.professionalTaxApplicable !== undefined ? s.professionalTaxApplicable : true);
                        setStructProfTax(s.professionalTax || 200);
                        setStructTdsApplicable(Boolean(s.tdsApplicable));
                        setStructTds(s.tds || 0);
                        setStructModal(true);
                      }}
                      style={{ flex: 1, padding: "8px", backgroundColor: "#F1F5F9", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "13px", fontWeight: 600, color: "#334155", cursor: "pointer" }}
                    >
                      Edit Profile
                    </button>

                    {s.salaryHistory && s.salaryHistory.length > 0 && (
                      <button
                        onClick={() => {
                          setSelectedHistory(s.salaryHistory);
                          setHistoryModal(true);
                        }}
                        style={{ padding: "8px 12px", backgroundColor: "#F1F5F9", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "13px", fontWeight: 600, color: "#334155", cursor: "pointer" }}
                      >
                        <History style={{ width: "14px", height: "14px" }} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* TAB 4: SALARY HEAD LIBRARY */}
      {activeTab === "heads" && !employee && (
        <Section title="Reusable Salary Head Master" kicker="Configure universal earnings, deductions, and formula-driven allowances">
          {salaryHeads.length === 0 ? (
            <EmptyState
              title="No salary heads configured"
              text="Click 'New Salary Head' above to define earning, deduction, or employer contribution heads."
            />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
              {salaryHeads.map((h) => (
                <div key={h.id} style={{ backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", backgroundColor: "#F1F5F9", color: "#334155" }}>
                      {h.code}
                    </span>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: h.type === "Earning" ? "#087A5B" : "#DC2626" }}>
                      {h.type}
                    </span>
                  </div>
                  <h4 style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: 700, color: "#0F172A" }}>{h.name}</h4>
                  <div style={{ fontSize: "12px", color: "#64748B", marginBottom: "12px" }}>
                    Type: <strong>{h.calculation_type}</strong>
                    {h.formula && <span> • Formula: <code>{h.formula}</code></span>}
                    {h.percentage > 0 && <span> • {h.percentage}% of {h.percentage_base_head}</span>}
                    {h.default_amount > 0 && <span> • Default: ₹{h.default_amount}</span>}
                  </div>
                  <div style={{ display: "flex", gap: "6px", fontSize: "10px", color: "#64748B" }}>
                    <span>Taxable: {h.taxable ? "Yes" : "No"}</span>
                    <span>• PF: {h.pf_eligible ? "Yes" : "No"}</span>
                    <span>• ESI: {h.esi_eligible ? "Yes" : "No"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* TAB 5: HOLIDAY CALENDAR */}
      {activeTab === "holidays" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Month/Year Calendar Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#FFFFFF", padding: "16px 20px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button
                onClick={() => {
                  if (calMonth === 1) {
                    setCalMonth(12);
                    setCalYear(calYear - 1);
                  } else {
                    setCalMonth(calMonth - 1);
                  }
                }}
                style={{ padding: "6px", border: "1px solid #CBD5E1", borderRadius: "6px", backgroundColor: "#FFFFFF", cursor: "pointer" }}
              >
                <ChevronLeft style={{ width: "16px", height: "16px" }} />
              </button>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>
                {monthNames[calMonth - 1]} {calYear}
              </h3>
              <button
                onClick={() => {
                  if (calMonth === 12) {
                    setCalMonth(1);
                    setCalYear(calYear + 1);
                  } else {
                    setCalMonth(calMonth + 1);
                  }
                }}
                style={{ padding: "6px", border: "1px solid #CBD5E1", borderRadius: "6px", backgroundColor: "#FFFFFF", cursor: "pointer" }}
              >
                <ChevronRight style={{ width: "16px", height: "16px" }} />
              </button>
            </div>

            <div style={{ display: "flex", gap: "8px", fontSize: "12px", alignItems: "center" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#DC2626" }}>
                <span style={{ width: "10px", height: "10px", backgroundColor: "#FEE2E2", border: "1px solid #FECACA", borderRadius: "2px" }} />
                Sunday (Weekly Off)
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#087A5B", marginLeft: "12px" }}>
                <span style={{ width: "10px", height: "10px", backgroundColor: "#D1FAE5", border: "1px solid #A7F3D0", borderRadius: "2px" }} />
                Company Paid Holiday
              </span>
            </div>
          </div>

          {/* Real Calendar Grid */}
          <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "16px" }}>
            <div style={{ fontSize: "12px", color: "#64748B", marginBottom: "12px" }}>
              💡 Click on any date or holiday card below to add or edit company holidays.
            </div>
            {renderVisualCalendar()}
          </div>

          {/* Manage Company Holidays List */}
          {!employee && (
            <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>Company Holidays ({calYear})</h4>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748B" }}>
                    Official declared holidays for the year with paid status
                  </p>
                </div>
                <PrimaryButton
                  onClick={() => {
                    setEditHolidayId(null);
                    setNewHolidayName("");
                    setNewHolidayDate(getISTDateString());
                    setHolidayModal(true);
                  }}
                >
                  <Plus style={{ width: "14px", height: "14px", marginRight: "6px" }} />
                  Add Holiday
                </PrimaryButton>
              </div>

              {holidays.length === 0 ? (
                <div style={{ padding: "24px", textAlign: "center", color: "#64748B" }}>
                  No holidays listed for {calYear}.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                        <th style={{ padding: "10px 14px", color: "#475569" }}>Date</th>
                        <th style={{ padding: "10px 14px", color: "#475569" }}>Holiday Name</th>
                        <th style={{ padding: "10px 14px", color: "#475569" }}>Category</th>
                        <th style={{ padding: "10px 14px", color: "#475569" }}>Paid Status</th>
                        <th style={{ padding: "10px 14px", color: "#475569", textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holidays.map((h) => (
                        <tr key={h.id || h._id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                          <td style={{ padding: "10px 14px", fontWeight: 600, color: "#0F172A" }}>
                            {h.dateStr || (h.date ? h.date.split("T")[0] : "")}
                          </td>
                          <td style={{ padding: "10px 14px", fontWeight: 700, color: "#0F172A" }}>{h.name}</td>
                          <td style={{ padding: "10px 14px" }}>
                            <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "6px", backgroundColor: "#F1F5F9", color: "#334155" }}>
                              {h.holiday_type || h.holidayType || "Company"}
                            </span>
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            <span style={{ fontSize: "11px", fontWeight: 700, color: h.is_paid || h.isPaid ? "#065F46" : "#DC2626" }}>
                              {h.is_paid || h.isPaid ? "● Paid Holiday" : "○ Unpaid"}
                            </span>
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: "6px" }}>
                              <button
                                onClick={() => {
                                  setEditHolidayId(h.id || h._id);
                                  setNewHolidayName(h.name);
                                  setNewHolidayDate(h.dateStr || (h.date ? h.date.split("T")[0] : ""));
                                  setNewHolidayType(h.holiday_type || h.holidayType || "Company");
                                  setNewHolidayDesc(h.description || "");
                                  setNewHolidayPaid(h.is_paid !== undefined ? h.is_paid : h.isPaid !== undefined ? h.isPaid : true);
                                  setHolidayModal(true);
                                }}
                                style={{ padding: "6px 10px", backgroundColor: "#F1F5F9", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteHoliday(h.id || h._id)}
                                style={{ padding: "6px 10px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "6px", fontSize: "12px", color: "#DC2626", cursor: "pointer" }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: REPORTS */}
      {activeTab === "reports" && !employee && (
        <div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
            {[
              { id: "summary", label: "Payroll Summary" },
              { id: "statutory", label: "Statutory PF / ESI / PT" },
              { id: "attendance", label: "Attendance Impact & LOP" },
              { id: "leave", label: "3-Month Leave Conversion" },
            ].map((r) => (
              <button
                key={r.id}
                onClick={() => setReportType(r.id as any)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: reportType === r.id ? 700 : 500,
                  backgroundColor: reportType === r.id ? "#087A5B" : "#FFFFFF",
                  color: reportType === r.id ? "#FFFFFF" : "#475569",
                  border: "1px solid #CBD5E1",
                  cursor: "pointer",
                }}
              >
                {r.label}
              </button>
            ))}
          </div>

          {reportLoading ? (
            <div style={{ padding: "32px", textAlign: "center", color: "#64748B" }}>Loading report data...</div>
          ) : reportData?.summary ? (
            <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
                <div style={{ padding: "16px", backgroundColor: "#F8FAFC", borderRadius: "8px" }}>
                  <div style={{ fontSize: "12px", color: "#64748B" }}>Total Employees</div>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: "#0F172A" }}>{reportData.summary.total_employees}</div>
                </div>
                <div style={{ padding: "16px", backgroundColor: "#F8FAFC", borderRadius: "8px" }}>
                  <div style={{ fontSize: "12px", color: "#64748B" }}>Total Gross Payroll</div>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: "#0F172A" }}>₹{reportData.summary.total_gross?.toLocaleString()}</div>
                </div>
                <div style={{ padding: "16px", backgroundColor: "#F8FAFC", borderRadius: "8px" }}>
                  <div style={{ fontSize: "12px", color: "#64748B" }}>Total Deductions</div>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: "#DC2626" }}>₹{reportData.summary.total_deductions?.toLocaleString()}</div>
                </div>
                <div style={{ padding: "16px", backgroundColor: "#F0FDF4", borderRadius: "8px", border: "1px solid #A7F3D0" }}>
                  <div style={{ fontSize: "12px", color: "#065F46" }}>Total Net Payout</div>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: "#087A5B" }}>₹{reportData.summary.total_net_payroll?.toLocaleString()}</div>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState title="No report data" text="Process payroll for this cycle to generate real-time reports." />
          )}
        </div>
      )}

      {/* MODAL: Salary Structure Form */}
      {structModal && (
        <Modal onClose={() => setStructModal(false)} title="Configure Employee Salary Structure">
          <form onSubmit={handleSaveStructure} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>Employee *</label>
              <select
                value={selectedEmpForStruct}
                onChange={(e) => setSelectedEmpForStruct(e.target.value)}
                required
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }}
              >
                <option value="">Select Employee...</option>
                {employeeOptions.map((e) => (
                  <option key={e.id} value={e.id}>{e.name} ({e.employee_code || String(e.id).slice(-4)})</option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>Monthly Fixed Gross (₹) *</label>
                <input
                  type="number"
                  value={structGross}
                  onChange={(e) => setStructGross(Number(e.target.value))}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>Basic Salary (₹) *</label>
                <input
                  type="number"
                  value={structBasic}
                  onChange={(e) => setStructBasic(Number(e.target.value))}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>HRA (₹)</label>
                <input
                  type="number"
                  value={structHra}
                  onChange={(e) => setStructHra(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Conveyance (₹)</label>
                <input
                  type="number"
                  value={structConveyance}
                  onChange={(e) => setStructConveyance(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Special Allowance (₹)</label>
                <input
                  type="number"
                  value={structSpecial}
                  onChange={(e) => setStructSpecial(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>
            </div>

            {/* Statutory Flags Box */}
            <div style={{ padding: "12px", backgroundColor: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
              <h5 style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: 700, color: "#0F172A" }}>Explicit Statutory Applicability</h5>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input type="checkbox" checked={structPfApplicable} onChange={(e) => setStructPfApplicable(e.target.checked)} />
                  <span>PF Applicable (12% of Basic, ₹15,000 ceiling)</span>
                </label>

                {structPfApplicable && (
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "20px", fontSize: "12px", color: "#475569", cursor: "pointer" }}>
                    <input type="checkbox" checked={structVoluntaryPf} onChange={(e) => setStructVoluntaryPf(e.target.checked)} />
                    <span>Voluntary PF Above Ceiling (Uncapped 12% on full basic)</span>
                  </label>
                )}

                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input type="checkbox" checked={structEsiApplicable} onChange={(e) => setStructEsiApplicable(e.target.checked)} />
                  <span>ESI Applicable (0.75% Employee / 3.25% Employer if Gross ≤ ₹21,000)</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input type="checkbox" checked={structProfTaxApplicable} onChange={(e) => setStructProfTaxApplicable(e.target.checked)} />
                  <span>Professional Tax Applicable (Kerala Standard ₹200)</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input type="checkbox" checked={structTdsApplicable} onChange={(e) => setStructTdsApplicable(e.target.checked)} />
                  <span>TDS Applicable (Income Tax Deduction)</span>
                </label>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
              <button
                type="button"
                onClick={() => setStructModal(false)}
                style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #CBD5E1", backgroundColor: "#FFFFFF", cursor: "pointer" }}
              >
                Cancel
              </button>
              <PrimaryButton type="submit">Save Salary Profile</PrimaryButton>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Salary Head Form */}
      {headModal && (
        <Modal onClose={() => setHeadModal(false)} title="Create Master Salary Head">
          <form onSubmit={handleSaveSalaryHead} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>Head Name *</label>
              <input
                type="text"
                value={headName}
                onChange={(e) => setHeadName(e.target.value)}
                placeholder="e.g. Performance Incentive"
                required
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>Head Code *</label>
                <input
                  type="text"
                  value={headCode}
                  onChange={(e) => setHeadCode(e.target.value.toUpperCase())}
                  placeholder="e.g. INCENTIVE"
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>Type</label>
                <select
                  value={headType}
                  onChange={(e) => setHeadType(e.target.value as any)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                >
                  <option value="Earning">Earning</option>
                  <option value="Deduction">Deduction</option>
                  <option value="EmployerContribution">Employer Contribution</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>Calculation Model</label>
              <select
                value={headCalcType}
                onChange={(e) => setHeadCalcType(e.target.value as any)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }}
              >
                <option value="Fixed">Fixed Amount</option>
                <option value="Percentage">Percentage of Base</option>
                <option value="Formula">Mathematical Formula</option>
              </select>
            </div>

            {headCalcType === "Formula" && (
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>Formula Expression</label>
                <input
                  type="text"
                  value={headFormula}
                  onChange={(e) => setHeadFormula(e.target.value)}
                  placeholder="e.g. BASIC * 0.40 or (BASIC + HRA) * 0.10"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
                <span style={{ fontSize: "11px", color: "#64748B" }}>Variables: BASIC, GROSS, HRA, SPECIAL, CONVEYANCE</span>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
              <button type="button" onClick={() => setHeadModal(false)} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #CBD5E1", backgroundColor: "#FFFFFF", cursor: "pointer" }}>
                Cancel
              </button>
              <PrimaryButton type="submit">Create Salary Head</PrimaryButton>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Holiday Form */}
      {holidayModal && (
        <Modal onClose={() => setHolidayModal(false)} title="Add Company Holiday">
          <form onSubmit={handleSaveHoliday} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>Holiday Name *</label>
              <input
                type="text"
                value={newHolidayName}
                onChange={(e) => setNewHolidayName(e.target.value)}
                placeholder="e.g. Kerala Piravi / Onam"
                required
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>Holiday Date *</label>
                <input
                  type="date"
                  value={newHolidayDate}
                  onChange={(e) => setNewHolidayDate(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>Category</label>
                <select
                  value={newHolidayType}
                  onChange={(e) => setNewHolidayType(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                >
                  <option value="Company">Company Holiday</option>
                  <option value="National">National Holiday</option>
                  <option value="Regional">Kerala / Regional</option>
                  <option value="Public">Public Holiday</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <input type="checkbox" checked={newHolidayPaid} onChange={(e) => setNewHolidayPaid(e.target.checked)} />
                <span>Paid Holiday (Does not impact employee salary / LOP)</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <input type="checkbox" checked={newHolidayRecurring} onChange={(e) => setNewHolidayRecurring(e.target.checked)} />
                <span>Recurring Annually (Applies every year)</span>
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
              <button type="button" onClick={() => setHolidayModal(false)} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #CBD5E1", backgroundColor: "#FFFFFF", cursor: "pointer" }}>
                Cancel
              </button>
              <PrimaryButton type="submit">Save Holiday</PrimaryButton>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Super Admin Unlock */}
      {unlockModal && (
        <Modal onClose={() => setUnlockModal(false)} title="Super Admin Payroll Unlock">
          <form onSubmit={handleUnlockRecord} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ padding: "12px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", color: "#991B1B", fontSize: "13px" }}>
              <ShieldAlert style={{ width: "18px", height: "18px", marginBottom: "4px" }} />
              <div>Unlocking this payroll record will revert it to <strong>Calculated (Draft)</strong> state and create an audit log.</div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>Mandatory Reason for Unlock *</label>
              <textarea
                value={unlockReason}
                onChange={(e) => setUnlockReason(e.target.value)}
                placeholder="e.g. Correcting retroactive attendance punch error approved by HR..."
                rows={3}
                required
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button type="button" onClick={() => setUnlockModal(false)} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #CBD5E1", backgroundColor: "#FFFFFF", cursor: "pointer" }}>
                Cancel
              </button>
              <button type="submit" style={{ padding: "8px 16px", borderRadius: "6px", backgroundColor: "#DC2626", color: "#FFFFFF", border: "none", fontWeight: 600, cursor: "pointer" }}>
                Confirm Unlock & Revert
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Salary History Viewer */}
      {historyModal && (
        <Modal onClose={() => setHistoryModal(false)} title="Effective Salary Structure History">
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {selectedHistory.map((h, i) => (
              <div key={i} style={{ padding: "12px", backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#64748B", marginBottom: "4px" }}>
                  <span>Effective: {new Date(h.effectiveFrom).toLocaleDateString()} {h.effectiveUntil ? `to ${new Date(h.effectiveUntil).toLocaleDateString()}` : "to Present"}</span>
                  <span>Logged: {new Date(h.createdAt).toLocaleDateString()}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginTop: "6px" }}>
                  <div><strong>Gross:</strong> ₹{h.grossSalary?.toLocaleString()}</div>
                  <div><strong>Basic:</strong> ₹{h.basicSalary?.toLocaleString()}</div>
                  <div><strong>PF:</strong> {h.pfApplicable ? "Yes" : "No"}</div>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
