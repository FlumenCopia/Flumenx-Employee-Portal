"use client";

import { FormEvent, useEffect, useState } from "react";
import { Check, RotateCcw, Trash2, X, AlertTriangle } from "lucide-react";
import { Leave, Paginated } from "@/lib/types";
import { api } from "@/lib/api";
import { Avatar } from "@/components/icons";
import { Badge, EmptyState, PageHeader, PrimaryButton, Section } from "@/components/ui";
import { Modal } from "@/features/common/Modal";
import { useShellUser } from "@/components/shell";
import { hasPermission } from "@/lib/permissions";

export function LeavesPage({ employee: propEmployee }: { employee?: boolean }) {
  const user = useShellUser();
  const userRole = (user?.portal_role || user?.role || "EMPLOYEE").toUpperCase();
  const userPerms = user?.permissions?.LEAVES || (user as any)?.permissions?.["*"];
  const isSuperUser = Boolean(user?.is_superuser || (user as any)?.isSuperuser || userRole === "SUPER_ADMIN" || (user as any)?.isSuperadminWildcard);
  const hasLeaveEditPerm = userPerms ? Boolean(userPerms.canEdit ?? userPerms.can_edit) : false;
  const canReviewLeaves = isSuperUser || hasPermission(user, "LEAVES", "review_leave") || hasLeaveEditPerm;
  const canDecide = canReviewLeaves;
  const isEmployee = !canDecide;

  const canCreate = isSuperUser || hasPermission(user, "LEAVES", "apply_leave") || (userPerms?.canCreate ?? userPerms?.can_create ?? true);
  const canEdit = canDecide;
  const canDelete = isSuperUser || (canDecide && (userPerms?.canDelete ?? userPerms?.can_delete ?? true));

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
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<"First Half" | "Second Half">("First Half");
  const [balances, setBalances] = useState<{
    totalPaidLeaveBalance: number;
    sickLeaveBalance: number;
    casualLeaveBalance: number;
    monthlyPaidQuota: number;
    availedThisMonth: number;
    carriedForwardBalance: number;
  } | null>(null);

  const [adminView, setAdminView] = useState<"requests" | "balances">("requests");
  const [allBalances, setAllBalances] = useState<any[]>([]);
  const [allBalancesLoading, setAllBalancesLoading] = useState(false);
  const [balanceSearch, setBalanceSearch] = useState("");

  const loadBalances = () => {
    api<any>("/leaves/balances/")
      .then(setBalances)
      .catch(() => {});
  };

  const loadAllBalances = () => {
    setAllBalancesLoading(true);
    api<any>("/leaves/balances/?all=true")
      .then((res) => setAllBalances(res?.results || []))
      .catch(() => setAllBalances([]))
      .finally(() => setAllBalancesLoading(false));
  };

  useEffect(() => {
    loadBalances();
  }, []);

  useEffect(() => {
    if (!isEmployee && adminView === "balances") {
      loadAllBalances();
    }
  }, [adminView, isEmployee]);

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
      loadBalances();
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
      loadBalances();
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
      const startDate = data.get("start_date");
      const endDate = isHalfDay ? startDate : (data.get("end_date") || startDate);

      const payload: any = {
        leave_type: data.get("leave_type"),
        start_date: startDate,
        end_date: endDate,
        is_half_day: isHalfDay,
        half_day_period: isHalfDay ? halfDayPeriod : null,
        reason: data.get("reason"),
      };
      const empId = data.get("employee_id");
      if (empId) payload.employee_id = empId;

      await api<Leave>("/leaves/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setModal(false);
      setIsHalfDay(false);
      setMessage("Leave request submitted.");
      loadLeaves();
      loadBalances();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not submit leave request.");
    } finally {
      setSubmitPending(false);
    }
  }

  const safeItems = items || [];
  const pendingCount = safeItems.filter(x => x.status === "Pending").length;
  const approvedCount = safeItems.filter(x => x.status === "Approved").length;

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
        <span>PAID LEAVE BALANCE</span>
        <strong style={{ color: "#10b981" }}>{balances ? balances.totalPaidLeaveBalance.toFixed(1) : "2.0"}</strong>
        <small>2.0 / month quota</small>
      </div>
      <div>
        <span>CARRIED FORWARD</span>
        <strong style={{ color: "var(--goldD)" }}>{balances ? balances.carriedForwardBalance.toFixed(1) : "0.0"}</strong>
        <small>3-month carry cycle</small>
      </div>
      <div>
        <span>AVAILED THIS MONTH</span>
        <strong style={{ color: "#3b82f6" }}>{balances ? balances.availedThisMonth.toFixed(1) : "0.0"}</strong>
        <small>taken this cycle</small>
      </div>
      <div>
        <span>{isEmployee ? "PENDING" : "PENDING REVIEW"}</span>
        <strong>{pendingCount}</strong>
        <small>{isEmployee ? "awaiting approval" : "awaiting review"}</small>
      </div>
    </div>

    {!isEmployee && (
      <div style={{ display: "flex", gap: "10px", margin: "16px 0 24px" }}>
        <button
          type="button"
          onClick={() => setAdminView("requests")}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 700,
            border: adminView === "requests" ? "1px solid #087A5B" : "1px solid #CBD5E1",
            backgroundColor: adminView === "requests" ? "#087A5B" : "#FFFFFF",
            color: adminView === "requests" ? "#FFFFFF" : "#475569",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          📋 Leave Requests ({count})
        </button>
        <button
          type="button"
          onClick={() => setAdminView("balances")}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 700,
            border: adminView === "balances" ? "1px solid #087A5B" : "1px solid #CBD5E1",
            backgroundColor: adminView === "balances" ? "#087A5B" : "#FFFFFF",
            color: adminView === "balances" ? "#FFFFFF" : "#475569",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          📊 Staff Leave Balances &amp; Carry Forward
        </button>
      </div>
    )}

    {!isEmployee && adminView === "balances" ? (
      <Section title="Staff Leave Balances & 3-Month Carry Forward" kicker="HR & PAYROLL AUDIT / 2026">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ fontSize: "13px", color: "var(--muted)" }}>
            Policy: Permanent employees accrue <strong>2.0 paid leaves/month</strong> (1 Sick + 1 Casual). Unused leaves carry forward across a <strong>3-month rolling window</strong> before converting to salary addition.
          </div>
          <input
            type="text"
            placeholder="Search employee or department..."
            value={balanceSearch}
            onChange={(e) => setBalanceSearch(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid var(--line)",
              fontSize: "13px",
              minWidth: "260px",
            }}
          />
        </div>

        {allBalancesLoading ? (
          <EmptyState title="Loading leave balances" text="Fetching staff leave ledgers." />
        ) : allBalances.length === 0 ? (
          <EmptyState title="No balances found" text="No active employee records available." />
        ) : (
          <div className="data-table leave-table">
            <div className="table-head" style={{ gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr 1fr 1fr" }}>
              <span>Employee</span>
              <span>Status</span>
              <span>Available Paid</span>
              <span>Carried Forward (3-Mo)</span>
              <span>Availed Month</span>
              <span>Sick / Casual</span>
              <span>Converted to Salary</span>
            </div>
            {allBalances
              .filter(
                (b) =>
                  !balanceSearch ||
                  b.employee_name?.toLowerCase().includes(balanceSearch.toLowerCase()) ||
                  b.employee_code?.toLowerCase().includes(balanceSearch.toLowerCase()) ||
                  b.department?.toLowerCase().includes(balanceSearch.toLowerCase())
              )
              .map((b) => (
                <div
                  className="table-row"
                  key={b.employee_id}
                  style={{ gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr 1fr 1fr", alignItems: "center" }}
                >
                  <div className="person-cell">
                    <Avatar name={b.employee_name || ""} />
                    <div>
                      <b>{b.employee_name}</b>
                      <span>{b.employee_code} • {b.department}</span>
                    </div>
                  </div>
                  <span>
                    <Badge tone={b.employmentStatus === "Permanent" ? "success" : "neutral"}>
                      {b.employmentStatus || "Permanent"}
                    </Badge>
                  </span>
                  <div>
                    <strong style={{ color: "#10b981", fontSize: "14px" }}>
                      {(b.totalPaidLeaveBalance || 0).toFixed(1)} Days
                    </strong>
                    <div style={{ fontSize: "10px", color: "var(--muted)" }}>2.0/mo quota</div>
                  </div>
                  <div>
                    <strong style={{ color: "var(--goldD)", fontSize: "14px" }}>
                      {(b.carriedForwardBalance || 0).toFixed(1)} Days
                    </strong>
                    <div style={{ fontSize: "10px", color: "var(--muted)" }}>Rolling 3-Mo</div>
                  </div>
                  <span>{(b.availedThisMonth || 0).toFixed(1)} Days</span>
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                    S: {b.sickLeaveBalance?.toFixed(1) || "0.0"} • C: {b.casualLeaveBalance?.toFixed(1) || "0.0"}
                  </span>
                  <span>
                    {b.convertedToSalary > 0 ? (
                      <span style={{ color: "#2563EB", fontWeight: 700 }}>
                        {b.convertedToSalary.toFixed(1)} Days Encashed
                      </span>
                    ) : (
                      "-"
                    )}
                  </span>
                </div>
              ))}
          </div>
        )}
      </Section>
    ) : (
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
                <Avatar name={l.employee_name || ""} avatar={(l as any).employee_avatar || (l as any).avatar} />
                <div>
                  <b>{l.employee_name}</b>
                  <span>{l.employee_code}</span>
                </div>
              </div>
            )}
            <b>{l.leave_type}</b>
            <span>
              {new Date(l.start_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
              {!l.is_half_day && l.end_date && l.end_date !== l.start_date
                ? ` - ${new Date(l.end_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`
                : ""}
            </span>
            <span>
              {l.is_half_day ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <b style={{ color: "#d97706" }}>0.5 Day</b>
                  <small style={{ color: "var(--muted)", fontWeight: 600 }}>{l.half_day_period || "Half Day"}</small>
                </div>
              ) : (
                `${l.days} day${l.days === 1 ? "" : "s"}`
              )}
            </span>
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
    )}
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
            <div style={{ background: "#FEF3C7", border: "1px solid #FCD34D", color: "#92400E", padding: "10px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, marginBottom: "14px", display: "flex", alignItems: "flex-start", gap: "8px" }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: "1px" }} />
              <div>
                <strong>Probation Period Policy:</strong> Employees on Probation are not eligible for Sick or Casual leave. Only Unpaid (Loss of Pay) or Emergency leave is permitted until formal confirmation.
              </div>
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

          {/* Duration Selector: Full Day vs Half Day */}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "6px" }}>
              Leave Duration
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
              <button
                type="button"
                onClick={() => setIsHalfDay(false)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: !isHalfDay ? "2px solid #2563EB" : "1px solid var(--line)",
                  background: !isHalfDay ? "#EFF6FF" : "var(--surface)",
                  color: !isHalfDay ? "#1D4ED8" : "inherit",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Full Day (1.0 Day)
              </button>
              <button
                type="button"
                onClick={() => setIsHalfDay(true)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: isHalfDay ? "2px solid #2563EB" : "1px solid var(--line)",
                  background: isHalfDay ? "#EFF6FF" : "var(--surface)",
                  color: isHalfDay ? "#1D4ED8" : "inherit",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Half Day (0.5 Day)
              </button>
            </div>
          </div>

          {isHalfDay ? (
            <>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "6px" }}>
                  Select Half-Day Session
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setHalfDayPeriod("First Half")}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: halfDayPeriod === "First Half" ? "2px solid #059669" : "1px solid var(--line)",
                      background: halfDayPeriod === "First Half" ? "#ECFDF5" : "var(--surface)",
                      color: halfDayPeriod === "First Half" ? "#065F46" : "inherit",
                      fontWeight: 600,
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    🌅 First Half (Morning)
                  </button>
                  <button
                    type="button"
                    onClick={() => setHalfDayPeriod("Second Half")}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: halfDayPeriod === "Second Half" ? "2px solid #059669" : "1px solid var(--line)",
                      background: halfDayPeriod === "Second Half" ? "#ECFDF5" : "var(--surface)",
                      color: halfDayPeriod === "Second Half" ? "#065F46" : "inherit",
                      fontWeight: 600,
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    🌇 Second Half (Afternoon)
                  </button>
                </div>
              </div>

              <label>
                Leave Date
                <input name="start_date" type="date" required />
              </label>

              <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534", padding: "8px 12px", borderRadius: "6px", fontSize: "12px" }}>
                💡 <strong>Deduction:</strong> Deducts <strong>0.5 day</strong> from your 2 paid monthly leaves.
              </div>
            </>
          ) : (
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
          )}

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
