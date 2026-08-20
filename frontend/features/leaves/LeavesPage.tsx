"use client";

import { FormEvent, useEffect, useState } from "react";
import { Check, Trash2, X } from "lucide-react";
import { Leave, Paginated } from "@/lib/types";
import { api } from "@/lib/api";
import { Avatar } from "@/components/icons";
import { Badge, EmptyState, PageHeader, PrimaryButton, Section } from "@/components/ui";
import { Modal } from "@/features/common/Modal";
import { useShellUser } from "@/components/shell";

export function LeavesPage({ employee: propEmployee }: { employee?: boolean }) {
  const user = useShellUser();
  const userRole = (user?.portal_role || user?.role || "EMPLOYEE").toUpperCase();
  const isManagement = ["SUPER_ADMIN", "ADMIN", "HR", "OPERATIONS_HEAD"].includes(userRole);
  const isEmployee = propEmployee !== undefined ? propEmployee : !isManagement;

  const userPerms = (user as any)?.permissions?.LEAVES;
  const canCreate = userPerms?.can_create ?? true;
  const canEdit = userPerms?.can_edit ?? isManagement;
  const canDelete = userPerms?.can_delete ?? isManagement;

  const [items, setItems] = useState<Leave[]>([]);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
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
    const query = page > 1 ? `?page=${page}` : "";
    api<Paginated<Leave>>(`/leaves/${query}`)
      .then(data => {
        setItems(data.results);
        setCount(data.count);
        setHasNext(Boolean(data.next));
        setHasPrevious(Boolean(data.previous));
      })
      .catch(err => {
        setItems([]);
        setCount(0);
        setHasNext(false);
        setHasPrevious(false);
        setError(err instanceof Error ? err.message : "Could not load leave requests.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadLeaves(); }, [page]);

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

  async function deleteLeave(id: number) {
    if (decisionPendingId !== null) return;
    if (!window.confirm("Are you sure you want to delete this leave request?")) return;
    setDecisionPendingId(id);
    setMessage("");
    setActionError("");
    try {
      await api(`/leaves/${id}/`, { method: "DELETE" });
      setItems(current => current.filter(x => x.id !== id));
      setMessage("Leave request deleted successfully.");
      setCount(c => Math.max(0, c - 1));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not delete leave request.");
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

  const pendingCount = items.filter(x => x.status === "Pending").length;
  const approvedCount = items.filter(x => x.status === "Approved").length;
  const rejectedCount = items.filter(x => x.status === "Rejected").length;

  return <>
    <PageHeader
      eyebrow={isEmployee ? "TIME OFF / MY LEAVE" : "PEOPLE / LEAVE REQUESTS"}
      title={isEmployee ? "Time away." : "Leave requests."}
      subtitle={isEmployee ? "Plan time off and follow every request." : "Review requests with context and care."}
      action={isEmployee && canCreate ? <PrimaryButton onClick={() => setModal(true)}>+ Request Leave</PrimaryButton> : undefined}
    />
    {message && <div className="toast success"><Check size={18} /> {message}</div>}
    {actionError && <div className="toast error">{actionError}</div>}
    <div className="mini-metrics">
      <div>
        <span>{isEmployee ? "PENDING" : "PENDING REVIEW"}</span>
        <strong>{pendingCount}</strong>
        <small>{isEmployee ? "awaiting approval" : "awaiting review"}</small>
      </div>
      <div>
        <span>APPROVED</span>
        <strong>{approvedCount}</strong>
        <small>this year</small>
      </div>
      <div>
        <span>REJECTED</span>
        <strong>{rejectedCount}</strong>
        <small>this year</small>
      </div>
    </div>
    <Section title={isEmployee ? "Request history" : "Requests in review"} kicker={isEmployee ? "MY LEAVE / 2026" : "LEAVE REVIEW / 2026"}>
      <div className="data-table leave-table">
        <div className="table-head">
          {!isEmployee && <span>Employee</span>}
          <span>Leave type</span>
          <span>Dates</span>
          <span>Duration</span>
          <span>Reason</span>
          <span>Status</span>
          {!isEmployee && (canEdit || canDelete) && <span />}
        </div>
        {!loading && !error && items.map(l => (
          <div className="table-row" key={l.id}>
            {!isEmployee && (
              <div className="person-cell">
                <Avatar name={l.employee_name || ""} />
                <div>
                  <b>{l.employee_name}</b>
                  <span>{l.employee_code}</span>
                </div>
              </div>
            )}
            <b>{l.leave_type}</b>
            <span>
              {new Date(l.start_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} - {new Date(l.end_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
            </span>
            <span>{l.days} day{l.days === 1 ? "" : "s"}</span>
            <span className="truncate">{l.reason}</span>
            <Badge tone={l.status}>{l.status}</Badge>
            {!isEmployee && (canEdit || canDelete) && (
              <div className="decision-buttons" style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                {canEdit && l.status === "Pending" && (
                  <>
                    <button className="approve" title="Approve Leave" disabled={decisionPendingId !== null} onClick={() => decide(l.id, "Approved")}>
                      <Check size={16} />
                    </button>
                    <button className="reject" title="Reject Leave" disabled={decisionPendingId !== null} onClick={() => decide(l.id, "Rejected")}>
                      <X size={16} />
                    </button>
                  </>
                )}
                {canDelete && (
                  <button className="reject" title="Delete Leave Request" style={{ color: "#ff5f6d", borderColor: "rgba(255,95,109,0.3)" }} disabled={decisionPendingId !== null} onClick={() => deleteLeave(l.id)}>
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {loading && <EmptyState title="Loading leave requests" text="Fetching leave records." />}
      {error && <EmptyState title="Could not load leave requests" text={error} />}
      {!loading && !error && !items.length && <EmptyState title="No leave requests" text={isEmployee ? "You have not submitted any leave requests yet." : "There are no leave requests to review."} />}
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
    {modal && (
      <Modal title="Request time off" onClose={() => setModal(false)}>
        <form onSubmit={requestLeave} className="modal-form">
          <label>
            Leave type
            <select name="leave_type">
              <option>Annual</option>
              <option>Sick</option>
              <option>Personal</option>
              <option>Unpaid</option>
            </select>
          </label>
          <div className="two-col">
            <label>
              From
              <input name="start_date" type="date" required />
            </label>
            <label>
              To
              <input name="end_date" type="date" required />
            </label>
          </div>
          <label>
            Reason
            <textarea name="reason" placeholder="A short note for your manager" required />
          </label>
          <PrimaryButton type="submit" disabled={submitPending}>
            {submitPending ? "Submitting..." : "Submit request"}
          </PrimaryButton>
        </form>
      </Modal>
    )}
  </>;
}
