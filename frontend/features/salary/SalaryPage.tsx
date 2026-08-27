"use client";

import { FormEvent, useEffect, useState } from "react";
import { Download, FileUp, Sparkles } from "lucide-react";
import { Employee, Paginated, SalarySlip } from "@/lib/types";
import { api } from "@/lib/api";
import { Avatar } from "@/components/icons";
import { EmptyState, PageHeader, PrimaryButton, Section } from "@/components/ui";
import { Modal } from "@/features/common/Modal";

const SALARY_SLIPS_ENABLED = true;

const monthName = (m: number) => new Date(2024, m - 1).toLocaleDateString("en-US", { month: "long" });

export function SalaryPage({ employee = false }: { employee?: boolean }) {
  const [data, setData] = useState<SalarySlip[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<Employee[]>([]);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [loading, setLoading] = useState(true);
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const [error, setError] = useState("");
  const [employeeError, setEmployeeError] = useState("");
  const [modal, setModal] = useState(false);
  const [generateModal, setGenerateModal] = useState(false);

  // Generate form state with live calculations
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

  const grossCalc = (basicSalary || 0) + (hra || 0) + (conveyance || 0) + (allowances || 0);
  const netCalc = grossCalc - ((pf || 0) + (tax || 0) + (deductions || 0));

  const loadSlips = () => {
    setLoading(true);
    setError("");
    const query = page > 1 ? `?page=${page}` : "";
    api<Paginated<SalarySlip> | SalarySlip[]>(`/salary-slips/${query}`)
      .then((result) => {
        const list = Array.isArray(result) ? result : (result as any)?.results || [];
        setData(list);
        setCount(Array.isArray(result) ? result.length : (result as any)?.count || list.length);
        setHasNext(Boolean((result as any)?.next));
        setHasPrevious(Boolean((result as any)?.previous));
      })
      .catch((err) => {
        setData([]);
        setCount(0);
        setHasNext(false);
        setHasPrevious(false);
        setError(err instanceof Error ? err.message : "Could not load salary slips.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSlips();
  }, [page]);

  useEffect(() => {
    if (!employee) {
      setEmployeeLoading(true);
      api<Paginated<Employee> | Employee[]>("/employees/")
        .then((result) => {
          const list = Array.isArray(result) ? result : (result as any)?.results || [];
          setEmployeeOptions(list);
          if (list.length > 0 && !genEmployeeId) {
            setGenEmployeeId(list[0].id || (list[0] as any)._id);
          }
        })
        .catch((err) => setEmployeeError(err instanceof Error ? err.message : "Could not load employees."))
        .finally(() => setEmployeeLoading(false));
    }
  }, [employee]);

  async function uploadSlip(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const selectedEmp = formData.get("employee");
    if (selectedEmp) {
      formData.set("employee_id", String(selectedEmp));
    }
    try {
      await api("/salary-slips/", {
        method: "POST",
        body: formData,
      });
      setModal(false);
      loadSlips();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not upload salary slip.");
    }
  }

  async function generateSlipSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!genEmployeeId) {
      alert("Please select an employee.");
      return;
    }
    setGenerating(true);
    try {
      await api("/salary-slips/generate/", {
        method: "POST",
        body: JSON.stringify({
          employee_id: genEmployeeId,
          month: genMonth,
          year: genYear,
          basic_salary: basicSalary,
          hra,
          conveyance,
          allowances,
          pf,
          tax,
          deductions,
        }),
      });
      setGenerateModal(false);
      loadSlips();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not generate salary slip.");
    } finally {
      setGenerating(false);
    }
  }

  const handleDownload = async (slip: SalarySlip) => {
    try {
      const token = typeof window !== "undefined" ? (localStorage.getItem("flumenx_access_token") || localStorage.getItem("access_token") || "") : "";
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const res = await fetch(`http://${host}:8000/api/salary-slips/${slip.id}/download/`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to download salary slip.");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const disposition = res.headers.get("content-disposition") || res.headers.get("Content-Disposition");
      let filename = "";
      if (disposition && disposition.includes("filename=")) {
        filename = disposition.split("filename=")[1].replace(/["']/g, "").trim();
      }
      if (!filename) {
        const ext = slip.file && slip.file.toLowerCase().endsWith(".pdf") ? ".pdf" : ".pdf";
        filename = `SalarySlip_${slip.month}_${slip.year}${ext}`;
      }
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Download failed.");
    }
  };

  const safeData = data || [];

  return (
    <>
      <PageHeader
        eyebrow="PAYROLL / DOCUMENTS"
        title={employee ? "Your payslips." : "Salary slips."}
        subtitle={employee ? "Private, secure, and ready when you need them." : "Generate dynamic PDF payslips or upload monthly documents."}
        action={
          !employee ? (
            <div style={{ display: "flex", gap: "10px" }}>
              <PrimaryButton onClick={() => setGenerateModal(true)}>
                <Sparkles size={16} style={{ marginRight: "6px" }} /> Generate Salary Slip
              </PrimaryButton>
              <button type="button" className="secondary-button" onClick={() => setModal(true)}>
                Upload File
              </button>
            </div>
          ) : undefined
        }
      />
      <div className="document-banner">
        <div>
          <span>PAYROLL SUMMARY</span>
          <strong>Active Period</strong>
          <p>Monthly salary documents generated and ready for secure download.</p>
        </div>
        <div className="progress-ring">
          {safeData.length}
          <small>SLIPS</small>
        </div>
      </div>
      <Section title={employee ? "Payslip archive" : "Recent uploads & generated slips"} kicker="DOCUMENTS / SECURE">
        <div className="data-table salary-table">
          <div className="table-head">
            {!employee && <span>Employee</span>}
            <span>Pay period</span>
            <span>Gross salary</span>
            <span>Net salary</span>
            <span>Uploaded / Generated</span>
            <span />
          </div>
          {!loading &&
            !error &&
            safeData.map((s) => (
              <div className="table-row" key={s.id}>
                {!employee && (
                  <div className="person-cell">
                    <Avatar name={s.employee_name || ""} />
                    <b>{s.employee_name || "Not assigned"}</b>
                  </div>
                )}
                <b>
                  {monthName(s.month)} {s.year}
                </b>
                <span>Rs {Number(s.gross_salary).toLocaleString("en-IN")}</span>
                <strong>Rs {Number(s.net_salary).toLocaleString("en-IN")}</strong>
                <span>
                  {s.uploaded_at
                    ? new Date(s.uploaded_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                    : ""}
                </span>
                <button type="button" className="download-button" onClick={() => handleDownload(s)}>
                  <Download size={17} /> Download PDF
                </button>
              </div>
            ))}
        </div>
        {loading && <EmptyState title="Loading salary slips" text="Fetching salary documents." />}
        {error && <EmptyState title="Could not load salary slips" text={error} />}
        {!loading && !error && !safeData.length && (
          <EmptyState title="No salary slips available" text="There are no salary slips to show yet." />
        )}
        {!loading && !error && count > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "16px 20px",
              borderTop: "1px solid var(--line)",
            }}
          >
            <span className="record-count" style={{ padding: 0 }}>
              Page {page} of {Math.ceil(count / 20) || 1} ({count} total)
            </span>
            <div className="header-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={!hasPrevious || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={!hasNext || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Section>

      {/* DYNAMIC SALARY SLIP GENERATOR MODAL */}
      {generateModal && (
        <Modal title="Generate Official Salary Slip (PDF)" onClose={() => setGenerateModal(false)}>
          <form className="modal-form" onSubmit={generateSlipSubmit}>
            <label>
              Select Employee
              <select
                value={genEmployeeId}
                onChange={(e) => setGenEmployeeId(e.target.value)}
                disabled={employeeLoading || Boolean(employeeError)}
                required
              >
                <option value="">-- Choose Employee --</option>
                {employeeOptions.map((e) => (
                  <option key={e.id || (e as any)._id} value={e.id || (e as any)._id}>
                    {e.name} ({e.employee_code || (e as any).employeeCode || "N/A"}) — {e.department || "General"}
                  </option>
                ))}
              </select>
              {employeeError && <small>{employeeError}</small>}
            </label>

            <div className="two-col">
              <label>
                Pay Month
                <select value={genMonth} onChange={(e) => setGenMonth(Number(e.target.value))}>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i + 1}>
                      {monthName(i + 1)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Pay Year
                <input
                  type="number"
                  value={genYear}
                  onChange={(e) => setGenYear(Number(e.target.value))}
                  required
                />
              </label>
            </div>

            <div style={{ margin: "10px 0 4px", fontSize: "11px", fontWeight: 800, color: "var(--neon)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              1. EARNINGS BREAKDOWN (INR ₹)
            </div>
            <div className="two-col">
              <label>
                Basic Salary
                <input
                  type="number"
                  step="any"
                  value={basicSalary}
                  onChange={(e) => setBasicSalary(Number(e.target.value))}
                  required
                />
              </label>
              <label>
                House Rent Allowance (HRA)
                <input
                  type="number"
                  step="any"
                  value={hra}
                  onChange={(e) => setHra(Number(e.target.value))}
                />
              </label>
            </div>

            <div className="two-col">
              <label>
                Conveyance Allowance
                <input
                  type="number"
                  step="any"
                  value={conveyance}
                  onChange={(e) => setConveyance(Number(e.target.value))}
                />
              </label>
              <label>
                Special / Performance Allowance
                <input
                  type="number"
                  step="any"
                  value={allowances}
                  onChange={(e) => setAllowances(Number(e.target.value))}
                />
              </label>
            </div>

            <div style={{ margin: "12px 0 4px", fontSize: "11px", fontWeight: 800, color: "#E11D48", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              2. DEDUCTIONS BREAKDOWN (INR ₹)
            </div>
            <div className="two-col">
              <label>
                Provident Fund (PF)
                <input
                  type="number"
                  step="any"
                  value={pf}
                  onChange={(e) => setPf(Number(e.target.value))}
                />
              </label>
              <label>
                Income Tax / TDS
                <input
                  type="number"
                  step="any"
                  value={tax}
                  onChange={(e) => setTax(Number(e.target.value))}
                />
              </label>
            </div>

            <label>
              Other Deductions
              <input
                type="number"
                step="any"
                value={deductions}
                onChange={(e) => setDeductions(Number(e.target.value))}
              />
            </label>

            {/* LIVE COMPUTATION PREVIEW CARD */}
            <div
              style={{
                background: "var(--panel2)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "14px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                margin: "10px 0 6px",
              }}
            >
              <div>
                <div style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 700 }}>GROSS EARNINGS</div>
                <div style={{ fontSize: "15px", fontWeight: 800, color: "var(--text)" }}>Rs {grossCalc.toLocaleString("en-IN")}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 700 }}>NET PAYABLE SALARY</div>
                <div style={{ fontSize: "18px", fontWeight: 900, color: "var(--neon)" }}>Rs {netCalc.toLocaleString("en-IN")}</div>
              </div>
            </div>

            <PrimaryButton type="submit" disabled={generating}>
              {generating ? "Generating PDF Payslip..." : "Generate & Save PDF Salary Slip"}
            </PrimaryButton>
          </form>
        </Modal>
      )}

      {/* UPLOAD EXISTING SALARY SLIP MODAL */}
      {modal && (
        <Modal title="Upload salary slip file" onClose={() => setModal(false)}>
          <form className="modal-form" onSubmit={uploadSlip}>
            <label>
              Employee
              <select name="employee" disabled={employeeLoading || Boolean(employeeError)}>
                {employeeOptions.map((e) => (
                  <option key={e.id || (e as any)._id} value={e.id || (e as any)._id}>
                    {e.name}
                  </option>
                ))}
              </select>
              {employeeError && <small>{employeeError}</small>}
            </label>
            <div className="two-col">
              <label>
                Month
                <select name="month" defaultValue={new Date().getMonth() + 1}>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i + 1}>
                      {monthName(i + 1)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Year
                <input name="year" type="number" defaultValue={new Date().getFullYear()} required />
              </label>
            </div>
            <div className="two-col">
              <label>
                Gross salary
                <input name="gross_salary" type="number" step=".01" required />
              </label>
              <label>
                Net salary
                <input name="net_salary" type="number" step=".01" required />
              </label>
            </div>
            <label className="file-drop">
              <FileUp />
              <b>Choose PDF payslip</b>
              <span>Maximum file size 10 MB</span>
              <input name="file" type="file" accept=".pdf" />
            </label>
            <PrimaryButton type="submit">Upload document</PrimaryButton>
          </form>
        </Modal>
      )}
    </>
  );
}
