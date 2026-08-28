"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Download,
  FileUp,
  Sparkles,
  Calendar,
  Layers,
  Calculator,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
  Trash2,
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
  const [modal, setModal] = useState(false);
  const [generateModal, setGenerateModal] = useState(false);

  // Generate slip form state
  const [genEmployeeId, setGenEmployeeId] = useState("");
  const [genMonth, setGenMonth] = useState(new Date().getMonth() + 1);
  const [genYear, setGenYear] = useState(new Date().getFullYear());
  const [basicSalary, setBasicSalary] = useState<number>(40000);
  const [hra, setHra] = useState<number>(16000);
  const [conveyance, setConveyance] = useState<number>(4000);
  const [allowances, setAllowances] = useState<number>(5000);
  const [pf, setPf] = useState<number>(2400);
  const [tax, setTax] = useState<number>(1500);
  const [deductions, setDeductions] = useState<number>(0);
  const [generating, setGenerating] = useState(false);

  // --- Payroll Engine Tab State ---
  const [payrollRecords, setPayrollRecords] = useState<any[]>([]);
  const [payrollMonth, setPayrollMonth] = useState(new Date().getMonth() + 1);
  const [payrollYear, setPayrollYear] = useState(new Date().getFullYear());
  const [selectedPreview, setSelectedPreview] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [processingCycle, setProcessingCycle] = useState(false);
  const [payrollError, setPayrollError] = useState("");
  const [payrollSuccess, setPayrollSuccess] = useState("");

  // --- Salary Structures Tab State ---
  const [structures, setStructures] = useState<any[]>([]);
  const [structModal, setStructModal] = useState(false);
  const [selectedEmpForStruct, setSelectedEmpForStruct] = useState("");
  const [structGross, setStructGross] = useState(50000);
  const [structBasic, setStructBasic] = useState(30000);
  const [structHra, setStructHra] = useState(15000);
  const [structConveyance, setStructConveyance] = useState(2000);
  const [structSpecial, setStructSpecial] = useState(3000);
  const [structPfEnabled, setStructPfEnabled] = useState(true);
  const [structEsiEnabled, setStructEsiEnabled] = useState(false);
  const [structProfTax, setStructProfTax] = useState(200);
  const [structTds, setStructTds] = useState(0);

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
            setGenEmployeeId(list[0].id || (list[0] as any)._id);
            setSelectedEmpForStruct(list[0].id || (list[0] as any)._id);
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
          tds: structTds,
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
    <div className="space-y-6">
      <PageHeader
        title={employee ? "My Salary & Payslips" : "Payroll & Salary Management"}
        subtitle={
          employee
            ? "View your attendance-calculated payroll breakdowns and monthly payslips."
            : "Enterprise Attendance-Based Payroll, India (IST) Timezone, Salary Heads & Holiday Calendar."
        }
        action={
          !employee ? (
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab("payroll")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  activeTab === "payroll" ? "bg-primary text-white" : "bg-card hover:bg-muted text-muted-foreground"
                }`}
              >
                <Calculator className="w-4 h-4 inline mr-1.5" />
                Payroll Engine
              </button>
              <button
                onClick={() => setActiveTab("structures")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  activeTab === "structures" ? "bg-primary text-white" : "bg-card hover:bg-muted text-muted-foreground"
                }`}
              >
                <Layers className="w-4 h-4 inline mr-1.5" />
                Salary Structure
              </button>
              <button
                onClick={() => setActiveTab("holidays")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  activeTab === "holidays" ? "bg-primary text-white" : "bg-card hover:bg-muted text-muted-foreground"
                }`}
              >
                <Calendar className="w-4 h-4 inline mr-1.5" />
                Holiday Calendar
              </button>
              <button
                onClick={() => setActiveTab("slips")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  activeTab === "slips" ? "bg-primary text-white" : "bg-card hover:bg-muted text-muted-foreground"
                }`}
              >
                Payslips
              </button>
            </div>
          ) : null
        }
      />

      {/* --- TAB 1: PAYROLL ENGINE --- */}
      {activeTab === "payroll" && !employee && (
        <Section title="Attendance-Based Payroll Calculation (Cycle: 25th to 24th)">
          <div className="bg-card/50 border border-border p-4 rounded-xl space-y-4 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-muted-foreground">Cycle Month:</label>
                <select
                  value={payrollMonth}
                  onChange={(e) => setPayrollMonth(parseInt(e.target.value, 10))}
                  className="bg-background border border-border px-3 py-1.5 rounded-lg text-sm"
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
                  className="bg-background border border-border px-3 py-1.5 rounded-lg text-sm"
                >
                  {[2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-xs text-primary font-mono bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20">
                Active Cycle: {cycleInfo.cycleName}
              </div>

              <div className="flex items-center gap-2">
                <PrimaryButton onClick={handleProcessCycle} disabled={processingCycle}>
                  <Sparkles className="w-4 h-4 mr-2 inline" />
                  {processingCycle ? "Processing..." : "Process Cycle Payroll"}
                </PrimaryButton>
              </div>
            </div>

            {payrollSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> {payrollSuccess}
              </div>
            )}
            {payrollError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {payrollError}
              </div>
            )}
          </div>

          {/* Quick Preview Calculator */}
          <div className="bg-card/40 border border-border p-4 rounded-xl mb-6">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-primary" /> Individual Employee Payroll Preview & Attendance Breakdown
            </h4>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={genEmployeeId}
                onChange={(e) => setGenEmployeeId(e.target.value)}
                className="bg-background border border-border px-3 py-1.5 rounded-lg text-sm flex-1 min-w-[200px]"
              >
                {employeeOptions.map((e) => (
                  <option key={e.id || (e as any)._id} value={e.id || (e as any)._id}>
                    {e.name} ({e.employee_code || (e as any).employeeCode}) - {e.department}
                  </option>
                ))}
              </select>
              <button
                onClick={() => handleCalculatePreview(genEmployeeId)}
                disabled={previewLoading || !genEmployeeId}
                className="px-4 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg text-sm font-medium transition"
              >
                {previewLoading ? "Calculating..." : "Calculate Preview"}
              </button>
            </div>

            {selectedPreview && (
              <div className="mt-4 p-4 bg-background/80 border border-border/80 rounded-xl grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block">Employee</span>
                  <span className="font-semibold">{selectedPreview.employee?.name}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Attendance Breakdown</span>
                  <span className="text-xs font-mono">
                    Working: {selectedPreview.attendanceCycle?.workingDays} | Holidays: {selectedPreview.attendanceCycle?.companyHolidays} | Lates: {selectedPreview.attendanceCycle?.lateArrivalsCount}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Late Deductions</span>
                  <span className="text-xs font-mono text-amber-400">
                    {selectedPreview.attendanceCycle?.lateHalfDayDeductions} Half-Days (every 3 lates)
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Net Calculated Salary</span>
                  <span className="text-base font-bold text-emerald-400">
                    ₹{selectedPreview.netSalary?.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Processed Records Table */}
          <div className="overflow-x-auto border border-border rounded-xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b border-border text-xs text-muted-foreground font-semibold">
                <tr>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Gross</th>
                  <th className="p-3">Payable Days</th>
                  <th className="p-3">Attendance LOP</th>
                  <th className="p-3">PF / ESI / PT</th>
                  <th className="p-3">Net Pay</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {payrollRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      No payroll records generated for this cycle yet. Click &quot;Process Cycle Payroll&quot; above.
                    </td>
                  </tr>
                ) : (
                  payrollRecords.map((r) => (
                    <tr key={r._id} className="hover:bg-muted/20">
                      <td className="p-3 font-medium">{r.employee?.name}</td>
                      <td className="p-3 text-muted-foreground">{r.employee?.department}</td>
                      <td className="p-3 font-mono">₹{r.grossSalary?.toLocaleString("en-IN")}</td>
                      <td className="p-3 font-mono">{r.attendanceCycle?.payableDays} / {r.attendanceCycle?.totalCalendarDays}</td>
                      <td className="p-3 font-mono text-amber-400">₹{r.attendanceDeduction?.toLocaleString("en-IN")}</td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">
                        PF: ₹{r.pfEmployee} | PT: ₹{r.professionalTax}
                      </td>
                      <td className="p-3 font-bold text-emerald-400 font-mono">
                        ₹{r.netSalary?.toLocaleString("en-IN")}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                            r.status === "Approved"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="p-3">
                        {r.status !== "Approved" && (
                          <button
                            onClick={() => handleApprovePayroll(r._id)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium"
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
      )}

      {/* --- TAB 2: SALARY STRUCTURES --- */}
      {activeTab === "structures" && !employee && (
        <Section title="Employee Salary Structures & Heads">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-muted-foreground">
              Define gross earnings, basic, HRA, PF caps (₹15,000 ceiling), and ESI applicability per employee.
            </p>
            <PrimaryButton onClick={() => setStructModal(true)}>
              <Plus className="w-4 h-4 mr-1.5 inline" /> Configure Structure
            </PrimaryButton>
          </div>

          <div className="overflow-x-auto border border-border rounded-xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b border-border text-xs text-muted-foreground font-semibold">
                <tr>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Gross Salary</th>
                  <th className="p-3">Basic (₹)</th>
                  <th className="p-3">HRA (₹)</th>
                  <th className="p-3">PF Status</th>
                  <th className="p-3">ESI Status</th>
                  <th className="p-3">Prof. Tax</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {structures.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      No custom structures configured yet.
                    </td>
                  </tr>
                ) : (
                  structures.map((s) => (
                    <tr key={s._id} className="hover:bg-muted/20">
                      <td className="p-3 font-medium">{s.employee?.name}</td>
                      <td className="p-3 text-muted-foreground">{s.employee?.department}</td>
                      <td className="p-3 font-mono font-bold">₹{s.grossSalary?.toLocaleString("en-IN")}</td>
                      <td className="p-3 font-mono">₹{s.basicSalary?.toLocaleString("en-IN")}</td>
                      <td className="p-3 font-mono">₹{s.hra?.toLocaleString("en-IN")}</td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-0.5 rounded ${s.pfEnabled ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                          {s.pfEnabled ? `Enabled (${s.pfEmployeePercent}%)` : "Disabled"}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-0.5 rounded ${s.esiEnabled ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                          {s.esiEnabled ? `Enabled (${s.esiEmployeePercent}%)` : "Disabled"}
                        </span>
                      </td>
                      <td className="p-3 font-mono">₹{s.professionalTax}</td>
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
        <Section title="Company Holiday Calendar (Asia/Kolkata)">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-muted-foreground">
              Official company holidays for year {payrollYear}. Holidays are automatically recognized by the payroll engine and do not incur attendance deductions.
            </p>
            <PrimaryButton onClick={() => setHolidayModal(true)}>
              <Plus className="w-4 h-4 mr-1.5 inline" /> Add Holiday
            </PrimaryButton>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {holidays.map((h) => (
              <div key={h.id} className="p-4 bg-card border border-border rounded-xl relative group">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                      {h.date}
                    </span>
                    <h4 className="font-semibold text-base mt-2">{h.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{h.description || "Company Paid Holiday"}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteHoliday(h.id)}
                    className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-300 transition p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
            <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
              {slipsData.map((slip) => (
                <div key={slip.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition">
                  <div className="flex items-center gap-3">
                    <Avatar name={slip.employee_name} />
                    <div>
                      <h4 className="font-medium text-sm">{slip.employee_name}</h4>
                      <p className="text-xs text-muted-foreground">
                        {monthName(slip.month)} {slip.year} • Net: ₹{Number(slip.net_salary).toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
                      window.open(`http://${host}:8000/api/salary-slips/${slip.id}/download/`, "_blank");
                    }}
                    className="p-2 text-primary hover:bg-primary/10 rounded-lg transition"
                  >
                    <Download className="w-4 h-4" />
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
          <form onSubmit={handleSaveStructure} className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Select Employee</label>
              <select
                value={selectedEmpForStruct}
                onChange={(e) => setSelectedEmpForStruct(e.target.value)}
                className="w-full bg-background border border-border px-3 py-2 rounded-lg text-sm"
                required
              >
                {employeeOptions.map((e) => (
                  <option key={e.id || (e as any)._id} value={e.id || (e as any)._id}>
                    {e.name} ({e.employee_code || (e as any).employeeCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Monthly Gross (₹)</label>
                <input
                  type="number"
                  value={structGross}
                  onChange={(e) => setStructGross(Number(e.target.value))}
                  className="w-full bg-background border border-border px-3 py-2 rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Basic Salary (₹)</label>
                <input
                  type="number"
                  value={structBasic}
                  onChange={(e) => setStructBasic(Number(e.target.value))}
                  className="w-full bg-background border border-border px-3 py-2 rounded-lg text-sm"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">HRA (₹)</label>
                <input
                  type="number"
                  value={structHra}
                  onChange={(e) => setStructHra(Number(e.target.value))}
                  className="w-full bg-background border border-border px-3 py-2 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Conveyance (₹)</label>
                <input
                  type="number"
                  value={structConveyance}
                  onChange={(e) => setStructConveyance(Number(e.target.value))}
                  className="w-full bg-background border border-border px-3 py-2 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Special (₹)</label>
                <input
                  type="number"
                  value={structSpecial}
                  onChange={(e) => setStructSpecial(Number(e.target.value))}
                  className="w-full bg-background border border-border px-3 py-2 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="flex gap-4 pt-2 border-t border-border">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={structPfEnabled}
                  onChange={(e) => setStructPfEnabled(e.target.checked)}
                  className="rounded"
                />
                PF Enabled (12% capped at ₹15k)
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={structEsiEnabled}
                  onChange={(e) => setStructEsiEnabled(e.target.checked)}
                  className="rounded"
                />
                ESI Enabled (0.75%)
              </label>
            </div>

            <div className="pt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStructModal(false)}
                className="px-4 py-2 text-sm text-muted-foreground"
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
          <form onSubmit={handleSaveHoliday} className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Holiday Name</label>
              <input
                type="text"
                value={newHolidayName}
                onChange={(e) => setNewHolidayName(e.target.value)}
                className="w-full bg-background border border-border px-3 py-2 rounded-lg text-sm"
                placeholder="e.g. Independence Day"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Holiday Date (YYYY-MM-DD)</label>
                <input
                  type="date"
                  value={newHolidayDate}
                  onChange={(e) => setNewHolidayDate(e.target.value)}
                  className="w-full bg-background border border-border px-3 py-2 rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Holiday Type</label>
                <select
                  value={newHolidayType}
                  onChange={(e) => setNewHolidayType(e.target.value)}
                  className="w-full bg-background border border-border px-3 py-2 rounded-lg text-sm"
                >
                  <option value="Company">Company Holiday</option>
                  <option value="Public">Public / National Holiday</option>
                  <option value="Restricted">Restricted Holiday</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Description (Optional)</label>
              <input
                type="text"
                value={newHolidayDesc}
                onChange={(e) => setNewHolidayDesc(e.target.value)}
                className="w-full bg-background border border-border px-3 py-2 rounded-lg text-sm"
                placeholder="e.g. National Holiday celebration"
              />
            </div>
            <div className="pt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setHolidayModal(false)}
                className="px-4 py-2 text-sm text-muted-foreground"
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
