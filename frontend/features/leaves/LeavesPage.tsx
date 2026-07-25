"use client";

import { FormEvent, useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { Leave, Paginated } from "@/lib/types";
import { api } from "@/lib/api";
import { Avatar } from "@/components/icons";
import { Badge, EmptyState, PageHeader, PrimaryButton, Section } from "@/components/ui";
import { Modal } from "@/features/common/Modal";

export function LeavesPage({ employee = false }: { employee?: boolean }) {
  const [items, setItems] = useState<Leave[]>([]);
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitPending, setSubmitPending] = useState(false);
  const [decisionPendingId, setDecisionPendingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const loadLeaves = () => {
    setLoading(true);
    setError("");
    api<Paginated<Leave>>("/leaves/")
      .then(data=>setItems(data.results))
      .catch(err=>{ setItems([]); setError(err instanceof Error ? err.message : "Could not load leave requests."); })
      .finally(()=>setLoading(false));
  };

  useEffect(()=>{loadLeaves()},[]);

  async function decide(id: number, status: "Approved" | "Rejected") {
    if (decisionPendingId !== null) return;
    setDecisionPendingId(id);
    setMessage("");
    setActionError("");
    try {
      const updated = await api<Leave>(`/leaves/${id}/decide/`, { method: "POST", body: JSON.stringify({ status }) });
      setItems(current => current.map(x => x.id === id ? updated : x));
      setMessage(`Leave request ${status.toLowerCase()}.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Could not ${status.toLowerCase()} leave request.`);
    } finally {
      setDecisionPendingId(null);
    }
  }

  async function requestLeave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitPending) return;
    setSubmitPending(true);
    setMessage("");
    setActionError("");
    const data = new FormData(e.currentTarget);
    try {
      await api<Leave>("/leaves/", {
        method: "POST",
        body: JSON.stringify({
          leave_type: data.get("leave_type"),
          start_date: data.get("start_date"),
          end_date: data.get("end_date"),
          reason: data.get("reason"),
        }),
      });
      setModal(false);
      setMessage("Leave request submitted.");
      loadLeaves();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not submit leave request.");
    } finally {
      setSubmitPending(false);
    }
  }

  return <>
    <PageHeader eyebrow={employee ? "TIME OFF / MY LEAVE" : "PEOPLE / LEAVE REQUESTS"} title={employee ? "Time away." : "Leave requests."} subtitle={employee ? "Plan time off and follow every request." : "Review requests with context and care."} action={employee ? <PrimaryButton onClick={() => setModal(true)}>Request leave</PrimaryButton> : undefined} />
    {message && <div className="toast success"><Check size={18} /> {message}</div>}
    {actionError && <div className="toast error">{actionError}</div>}
    <div className="mini-metrics"><div><span>{employee ? "AVAILABLE" : "PENDING"}</span><strong>{employee ? "0" : items.filter(x => x.status === "Pending").length}</strong><small>{employee ? "leave balance unavailable" : "awaiting review"}</small></div><div><span>APPROVED</span><strong>{items.filter(x => x.status === "Approved").length}</strong><small>this year</small></div><div><span>{employee ? "USED" : "REJECTED"}</span><strong>{employee ? items.filter(x => x.status === "Approved").reduce((total, x) => total + (x.days || 0), 0) : items.filter(x => x.status === "Rejected").length}</strong><small>{employee ? "approved days" : "this year"}</small></div></div>
    <Section title={employee ? "Request history" : "Requests in review"} kicker="LEAVE / 2026">
      <div className="data-table leave-table"><div className="table-head">{!employee && <span>Employee</span>}<span>Leave type</span><span>Dates</span><span>Duration</span><span>Reason</span><span>Status</span>{!employee && <span />}</div>
      {!loading && !error && items.map(l => <div className="table-row" key={l.id}>{!employee && <div className="person-cell"><Avatar name={l.employee_name || ""} /><div><b>{l.employee_name}</b><span>{l.employee_code}</span></div></div>}<b>{l.leave_type}</b><span>{new Date(l.start_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} - {new Date(l.end_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span><span>{l.days} day{l.days === 1 ? "" : "s"}</span><span className="truncate">{l.reason}</span><Badge tone={l.status}>{l.status}</Badge>{!employee && <div className="decision-buttons">{l.status === "Pending" && <><button className="approve" disabled={decisionPendingId !== null} onClick={() => decide(l.id, "Approved")}><Check size={16} /></button><button className="reject" disabled={decisionPendingId !== null} onClick={() => decide(l.id, "Rejected")}><X size={16} /></button></>}</div>}</div>)}</div>
      {loading && <EmptyState title="Loading leave requests" text="Fetching the latest leave records." />}
      {error && <EmptyState title="Could not load leave requests" text={error} />}
      {!loading && !error && !items.length && <EmptyState title="No leave requests" text={employee ? "You have not submitted any leave requests yet." : "There are no leave requests to review."} />}
    </Section>
    {modal && <Modal title="Request time off" onClose={() => setModal(false)}><form onSubmit={requestLeave} className="modal-form"><label>Leave type<select name="leave_type"><option>Annual</option><option>Sick</option><option>Personal</option><option>Unpaid</option></select></label><div className="two-col"><label>From<input name="start_date" type="date" required /></label><label>To<input name="end_date" type="date" required /></label></div><label>Reason<textarea name="reason" placeholder="A short note for your manager" required /></label><PrimaryButton type="submit" disabled={submitPending}>{submitPending ? "Submitting..." : "Submit request"}</PrimaryButton></form></Modal>}
  </>;
}
