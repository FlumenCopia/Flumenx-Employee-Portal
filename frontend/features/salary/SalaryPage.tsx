"use client";

import { FormEvent, useEffect, useState } from "react";
import { Download, FileUp } from "lucide-react";
import { Employee, Paginated, SalarySlip } from "@/lib/types";
import { api } from "@/lib/api";
import { Avatar } from "@/components/icons";
import { EmptyState, PageHeader, PrimaryButton, Section } from "@/components/ui";
import { Modal } from "@/features/common/Modal";

const SALARY_SLIPS_ENABLED = false;

const monthName = (m: number) => new Date(2024, m - 1).toLocaleDateString("en-US", { month: "long" });

export function SalaryPage({ employee = false }: { employee?: boolean }) {
  if (!SALARY_SLIPS_ENABLED) {
    return (
      <>
        <PageHeader
          eyebrow="PAYROLL / DOCUMENTS"
          title={employee ? "Your payslips." : "Salary slips."}
          subtitle="Salary slips are temporarily disabled."
        />
        <EmptyState
          title="Feature unavailable"
          text="Salary slip access and document downloads are temporarily disabled while private storage is being configured. Please check back later."
        />
      </>
    );
  }

  const [data,setData]=useState<SalarySlip[]>([]);
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

  const loadSlips = () => {
    setLoading(true);
    setError("");
    const query = page > 1 ? `?page=${page}` : "";
    api<Paginated<SalarySlip>>(`/salary-slips/${query}`)
      .then(result => {
        setData(result.results);
        setCount(result.count);
        setHasNext(Boolean(result.next));
        setHasPrevious(Boolean(result.previous));
      })
      .catch(err => {
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
      setEmployeeError("");
      api<Paginated<Employee>>("/employees/")
        .then(result => setEmployeeOptions(result.results))
        .catch(err => { setEmployeeOptions([]); setEmployeeError(err instanceof Error ? err.message : "Could not load employees."); })
        .finally(() => setEmployeeLoading(false));
    }
  }, [employee]);

  async function uploadSlip(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await api<SalarySlip>("/salary-slips/", { method: "POST", body: form });
    setModal(false);
    loadSlips();
  }

  return <>
    <PageHeader eyebrow="PAYROLL / DOCUMENTS" title={employee ? "Your payslips." : "Salary slips."} subtitle={employee ? "Private, secure, and ready when you need them." : "Upload and manage monthly payroll documents."} action={!employee ? <PrimaryButton onClick={() => setModal(true)}>Upload slips</PrimaryButton> : undefined} />
    <div className="document-banner"><div><span>PAYROLL SUMMARY</span><strong>Not available</strong><p>Payroll summary unavailable.</p></div><div className="progress-ring">--<small>DATA</small></div></div>
    <Section title={employee ? "Payslip archive" : "Recent uploads"} kicker="DOCUMENTS / SECURE">
      <div className="data-table salary-table"><div className="table-head">{!employee && <span>Employee</span>}<span>Pay period</span><span>Gross salary</span><span>Net salary</span><span>Uploaded</span><span /></div>
      {!loading && !error && data.map(s => <div className="table-row" key={s.id}>{!employee && <div className="person-cell"><Avatar name={s.employee_name || ""} /><b>{s.employee_name || "Not assigned"}</b></div>}<b>{monthName(s.month)} {s.year}</b><span>Rs {Number(s.gross_salary).toLocaleString("en-IN")}</span><strong>Rs {Number(s.net_salary).toLocaleString("en-IN")}</strong><span>{new Date(s.uploaded_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span><button className="download-button"><Download size={17} /> Download</button></div>)}</div>
      {loading && <EmptyState title="Loading salary slips" text="Fetching salary documents." />}
      {error && <EmptyState title="Could not load salary slips" text={error} />}
      {!loading && !error && !data.length && <EmptyState title="No salary slips available" text="There are no salary slips to show yet." />}
      {!loading && !error && count > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderTop: "1px solid var(--line)" }}>
          <span className="record-count" style={{ padding: 0 }}>
            Page {page} of {Math.ceil(count / 20) || 1} ({count} total)
          </span>
          <div className="header-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={!hasPrevious || loading}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={!hasNext || loading}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </Section>
    {modal && <Modal title="Upload salary slip" onClose={() => setModal(false)}><form className="modal-form" onSubmit={uploadSlip}><label>Employee<select name="employee" disabled={employeeLoading || Boolean(employeeError)}>{employeeOptions.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>{employeeError && <small>{employeeError}</small>}</label><div className="two-col"><label>Month<select name="month">{Array.from({length:12},(_,i)=><option key={i} value={i+1}>{monthName(i+1)}</option>)}</select></label><label>Year<input name="year" type="number" required /></label></div><div className="two-col"><label>Gross salary<input name="gross_salary" type="number" step=".01" required /></label><label>Net salary<input name="net_salary" type="number" step=".01" required /></label></div><label className="file-drop"><FileUp /><b>Choose PDF payslip</b><span>Maximum file size 10 MB</span><input name="file" type="file" accept=".pdf" /></label><PrimaryButton type="submit">Upload document</PrimaryButton></form></Modal>}
  </>;
}
