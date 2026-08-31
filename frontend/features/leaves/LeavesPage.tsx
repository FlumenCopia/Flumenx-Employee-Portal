"use client";

import { FormEvent, useEffect, useState } from "react";
import { Check, RotateCcw, Trash2, X } from "lucide-react";
import { Leave, Paginated } from "@/lib/types";
import { api } from "@/lib/api";
import { Avatar } from "@/components/icons";
import { Badge, EmptyState, PageHeader, PrimaryButton, Section } from "@/components/ui";
import { Modal } from "@/features/common/Modal";
import { useShellUser } from "@/components/shell";

export function LeavesPage({ employee: propEmployee }: { employee?: boolean }) {
  const user = useShellUser();
  const userRole = (user?.portal_role || user?.role || "EMPLOYEE").toUpperCase();
  const userPerms = (user as any)?.permissions?.LEAVES;
  const isManagementRole = ["SUPER_ADMIN", "ADMIN", "HR", "OPERATIONS_HEAD", "ACCOUNTANT"].includes(userRole);
  const canDecide = isManagementRole || Boolean(userPerms?.can_edit);
  const isEmployee = propEmployee !== undefined ? propEmployee : (!isManagementRole || userRole === "EMPLOYEE" || userRole.includes("MEMBER") || userRole.includes("TEAM_MEMBER"));

  const canCreate = userPerms?.can_create ?? true;
  const canEdit = canDecide;
  const canDelete = canDecide && (userPerms?.can_delete ?? true);

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
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => {
    if (!isEmployee) {
      api<any[]>("/employees/").then(data => {
        setEmployees(Array.isArray(data) ? data : (data as any)?.results || []);
      }).catch(() => {});
    }
  }, [isEmployee]);

  const loadLeaves = () => {
    setLoading(true);
    setError("");
    const query = page > 1 ? `?page=${page}` : "";
    api<Paginated<Leave> | Leave[]>(`/leaves/${query}`)
      .then(data => {
        const list = Array.isArray(data) ? data : (data as any)?.results || [];
        setItems(list);
        setCount(Array.isArray(data) ? data.length : (data as any)?.count || list.length);
        setHasNext(Boolean((data as any)?.next));
        setHasPrevious(Boolean((data as any)?.previous));
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

  async function decide(id: number, status: "Approved" | "Rejected" | "Pending") {
    if (decisionPendingId !== null) return;
    setDecisionPendingId(id);
    setMessage("");
    setActionError("");
    try {
      const updated = await api<Leave>(`/leaves/${id}/decide/`, { method: "POST", body: JSON.stringify({ status }) });
      setItems(current => current.map(x => x.id === id ? updated : x));
      setMessage(`Leave request status updated to ${status}.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Could not update leave request to ${status}.`);
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
      const payload: any = {
        leave_type: data.get("leave_type"),
        start_date: data.get("start_date"),
        end_date: data.get("end_date"),
        reason: data.get("reason"),
      };
      const empId = data.get("employee_id");
      if (empId) payload.employee_id = empId;

      await api<Leave>("/leaves/", {
        method: "POST",
        body: JSON.stringify(payload),
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

  const safeItems = items || [];
  const pendingCount = safeItems.filter(x => x.status === "Pending").length;
  const approvedCount = safeItems.filter(x => x.status === "Approved").length;
  const rejectedCount = safeItems.filter(x => x.status === "Rejected").length;

  return <>
    <PageHeader
      eyebrow={isEmployee ? "TIME OFF / MY LEAVE" : "PEOPLE / LEAVE REQUESTS"}
      title={isEmployee ? "Time away." : "Leave requests."}
      subtitle={isEmployee ? "Plan time off and follow every request." : "Review requests with context and care."}
      action={canCreate ? <PrimaryButton onClick={() => setModal(true)}>+ Request Leave</PrimaryButton> : undefined}
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
              <div className="decision-buttons" style={{ display: "flex", gap: "5px", alignItems: "center", justifyContent: "flex-end" }}>
                {canEdit && (
                  <>
                    {l.status !== "Approved" && (
                      <button
                        className="approve"
                        title={l.status === "Rejected" ? "Re-Approve Leave" : "Approve Leave"}
                        disabled={decisionPendingId !== null}
                        onClick={() => decide(l.id, "Approved")}
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "6px",
                          border: "1px solid rgba(16, 185, 129, 0.4)",
                          background: "rgba(16, 185, 129, 0.1)",
                          color: "#10b981",
                          cursor: decisionPendingId !== null ? "not-allowed" : "pointer",
                          display: "grid",
                          placeItems: "center",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <Check size={15} />
                      </button>
                    )}

                    {l.status !== "Rejected" && (
                      <button
                        className="reject"
                        title={l.status === "Approved" ? "Revoke / Reject Leave" : "Reject Leave"}
                        disabled={decisionPendingId !== null}
                        onClick={() => decide(l.id, "Rejected")}
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "6px",
                          border: "1px solid rgba(239, 68, 68, 0.4)",
                          background: "rgba(239, 68, 68, 0.1)",
                          color: "#ef4444",
                          cursor: decisionPendingId !== null ? "not-allowed" : "pointer",
                          display: "grid",
                          placeItems: "center",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <X size={15} />
                      </button>
                    )}

                    {l.status !== "Pending" && (
                      <button
                        title="Reset to Pending"
                        disabled={decisionPendingId !== null}
                        onClick={() => decide(l.id, "Pending")}
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "6px",
                          border: "1px solid rgba(245, 158, 11, 0.4)",
                          background: "rgba(245, 158, 11, 0.1)",
                          color: "#f59e0b",
                          cursor: decisionPendingId !== null ? "not-allowed" : "pointer",
                          display: "grid",
                          placeItems: "center",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <RotateCcw size={13} />
                      </button>
                    )}
                  </>
                )}

                {canDelete && (
                  <button
                    className="reject"
                    title="Delete Leave Request"
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "6px",
                      color: "#ff5f6d",
                      borderColor: "rgba(255,95,109,0.3)",
                      background: "rgba(255,95,109,0.08)",
                      cursor: decisionPendingId !== null ? "not-allowed" : "pointer",
                      display: "grid",
                      placeItems: "center",
                    }}
                    disabled={decisionPendingId !== null}
                    onClick={() => deleteLeave(l.id)}
                  >
                    <Trash2 size={14} />
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
          {!isEmployee && employees.length > 0 && (
            <label>
              Employee
              <select name="employee_id" defaultValue="">
                <option value="">Myself / Default</option>
                {employees.map(e => (
                  <option key={e.id || e._id} value={e.id || e._id}>
                    {e.name || e.display_name} ({e.employee_code || e.employeeCode || "EMP"})
                  </option>
                ))}
              </select>
            </label>
          )}

          {user?.employee?.employment_status === "Probation" && (
            <div style={{ background: "#FEF3C7", border: "1px solid #FCD34D", color: "#92400E", padding: "10px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, marginBottom: "14px" }}>
              ⚠️ <strong>Probation Period Policy:</strong> Employees on Probation are not eligible for Sick or Casual leave. Only Unpaid (Loss of Pay) or Emergency leave is permitted until formal confirmation.
            </div>
          )}
          <label>
            Leave type
            <select name="leave_type">
              <option value="Casual">Casual Leave</option>
              <option value="Sick">Sick Leave</option>
              <option value="Annual">Annual / Earned Leave</option>
              <option value="Unpaid">Unpaid / Loss of Pay (LOP)</option>
              <option value="Emergency">Emergency Leave</option>
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
