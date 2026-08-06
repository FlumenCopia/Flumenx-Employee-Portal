"use client";

import { Fragment, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BriefcaseBusiness, LayoutDashboard, ListFilter, RotateCw, SlidersHorizontal } from "lucide-react";
import { ApiError, api } from "@/lib/api";
import type { Paginated, WorkAssignment, WorkDeliverable, WorkPriority, WorkStatus, WorkSummary } from "@/lib/types";
import { Badge, EmptyState, PageHeader, PrimaryButton, StatCard } from "@/components/ui";
import { Modal } from "@/features/common/Modal";
import { useShellUser } from "@/components/shell";
import { CommandCenterView } from "./CommandCenterView";



type EmployeeWorkFilters = {
  status: string; priority: string; due_date: string; assigned_date: string; is_overdue: string;
};

const EMPTY_SUMMARY: WorkSummary = { total: 0, pending: 0, in_progress: 0, blocked: 0, completed: 0, overdue: 0 };
const EMPTY_FILTERS: EmployeeWorkFilters = { status: "", priority: "", due_date: "", assigned_date: "", is_overdue: "" };
const PRIORITIES: WorkPriority[] = ["Low", "Normal", "High", "Urgent"];
const STATUSES: WorkStatus[] = ["Pending", "Ongoing", "In Progress", "Blocked", "In Review", "Approved", "Published"];

function queryFromFilters(filters: EmployeeWorkFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function apiError(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function fieldErrors(err: unknown) {
  return err instanceof ApiError ? err.fields : {};
}

function quantityLabel(item: WorkAssignment) {
  return `${item.completed_quantity}/${item.assigned_quantity} ${item.unit}`;
}

function ProgressMeter({ value }: { value: number }) {
  const width = Math.max(0, Math.min(100, value));
  return <div className="work-progress"><div><i style={{ width: `${width}%` }} /></div><span>{value}%</span></div>;
}

function groupedDeliverables(deliverables: WorkDeliverable[]) {
  return deliverables.reduce<Array<{ client: string; items: WorkDeliverable[]; completed: number }>>((groups, deliverable) => {
    const client = deliverable.client_name || "Client";
    let group = groups.find(item => item.client === client);
    if (!group) {
      group = { client, items: [], completed: 0 };
      groups.push(group);
    }
    group.items.push(deliverable);
    if (deliverable.status === "Completed") group.completed += 1;
    return groups;
  }, []);
}

export function EmployeeWorkPage() {
  const [summary, setSummary] = useState<WorkSummary>(EMPTY_SUMMARY);
  const [items, setItems] = useState<WorkAssignment[]>([]);
  const [filters, setFilters] = useState<EmployeeWorkFilters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [editing, setEditing] = useState<WorkAssignment | null>(null);
  const [editingDeliverable, setEditingDeliverable] = useState<WorkDeliverable | null>(null);
  const [statusMode, setStatusMode] = useState<"AUTO" | "Blocked">("AUTO");
  const [deliverableStatus, setDeliverableStatus] = useState<WorkStatus>("Pending");
  const [selectedStatus, setSelectedStatus] = useState<WorkStatus>("Pending");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [collapsedDeliverables, setCollapsedDeliverables] = useState<Record<number, boolean>>({});
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const loadWork = useCallback(async (nextFilters = filters) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setError("");
    try {
      const query = queryFromFilters(nextFilters);
      const [list, nextSummary] = await Promise.all([
        api<Paginated<WorkAssignment>>(`/work-assignments/${query}`, { signal: controller.signal }),
        api<WorkSummary>(`/work-assignments/summary/${query}`, { signal: controller.signal }),
      ]);
      if (requestRef.current !== requestId || controller.signal.aborted) return;
      setItems(list.results);
      setSummary(nextSummary);
    } catch (err) {
      if (!controller.signal.aborted) {
        setItems([]);
        setSummary(EMPTY_SUMMARY);
        setError(apiError(err, "Could not load your work."));
      }
    } finally {
      if (requestRef.current === requestId && !controller.signal.aborted) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadWork(filters);
    return () => {
      requestRef.current += 1;
      abortRef.current?.abort();
    };
  }, [filters, loadWork]);

  useEffect(() => {
    if (!editing && !editingDeliverable) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) {
        setEditing(null);
        setEditingDeliverable(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [editing, editingDeliverable, submitting]);

  function updateFilter(key: keyof EmployeeWorkFilters, value: string) {
    setFilters(current => ({ ...current, [key]: value }));
  }

  function openUpdate(item: WorkAssignment) {
    setEditing(item);
    setEditingDeliverable(null);
    setSelectedStatus(item.status === "Blocked" ? "In Progress" : item.status);
    setFormErrors({});
    setActionError("");
  }

  function openDeliverableUpdate(deliverable: WorkDeliverable) {
    setEditing(null);
    setEditingDeliverable(deliverable);
    setDeliverableStatus(deliverable.status);
    setFormErrors({});
    setActionError("");
  }

  function toggleDeliverables(id: number) {
    setCollapsedDeliverables(current => ({ ...current, [id]: !current[id] }));
  }

  const statusProgressMap: Record<string, number> = {
    "Pending": 0,
    "In Progress": 25,
    "Ongoing": 75,
    "Completed": 100,
    "Blocked": 0,
  };

  const liveProgress = statusProgressMap[selectedStatus] ?? 0;

  async function submitUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || submitting) return;
    setSubmitting(true);
    setActionError("");
    setFormErrors({});
    try {
      await api<WorkAssignment>(`/work-assignments/${editing.id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          status: selectedStatus,
        }),
      });
      setEditing(null);
      setMessage("Work status updated.");
      await loadWork(filters);
    } catch (err) {
      setFormErrors(fieldErrors(err));
      setActionError(apiError(err, "Could not update work status."));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitDeliverableUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingDeliverable || submitting) return;
    setSubmitting(true);
    setActionError("");
    setFormErrors({});
    try {
      await api<WorkDeliverable>(`/work-deliverables/${editingDeliverable.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ status: deliverableStatus }),
      });
      setEditingDeliverable(null);
      setMessage(deliverableStatus === "Completed" ? "Deliverable completed." : "Deliverable blocked.");
      await loadWork(filters);
    } catch (err) {
      setFormErrors(fieldErrors(err));
      setActionError(apiError(err, "Could not update deliverable."));
    } finally {
      setSubmitting(false);
    }
  }

  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");
  const initialTab =
    viewParam === "kanban"
      ? "kanban"
      : viewParam === "timeline"
      ? "timeline"
      : viewParam === "deliverables"
      ? "deliverables"
      : viewParam === "approvals"
      ? "approvals"
      : viewParam === "team"
      ? "team"
      : viewParam === "kpis"
      ? "kpis"
      : viewParam === "budget"
      ? "budget"
      : "overview";

  const [activeViewMode, setActiveViewMode] = useState<"COMMAND_CENTER" | "LIST">("COMMAND_CENTER");


  const handleStatusChange = async (id: number, status: WorkStatus) => {
    try {
      const updated = await api<WorkAssignment>(`/work-assignments/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
      await loadWork(filters);
    } catch (err) {
      const msg = apiError(err, "Could not update status.");
      setActionError(msg);
      throw new Error(msg);
    }
  };

  const shellUser = useShellUser();

  return <>
    <PageHeader
      eyebrow="WORK / EXECUTION COMMAND CENTER"
      title="My Work & Command Center."
      subtitle="Track assigned client work, taskboards, timeline phases, and KPI targets in real time."
      action={
        <div className="flex bg-[#0F2218] border border-[rgba(77,255,160,0.14)] rounded-xl p-1 gap-1">
          <button
            type="button"
            onClick={() => setActiveViewMode("COMMAND_CENTER")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeViewMode === "COMMAND_CENTER"
                ? "bg-[#4DFFA0] text-[#020806] shadow-[0_0_10px_rgba(77,255,160,0.3)]"
                : "text-[#89ACA0] hover:text-white"
            }`}
          >
            <LayoutDashboard size={14} /> Command Center
          </button>
          <button
            type="button"
            onClick={() => setActiveViewMode("LIST")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeViewMode === "LIST"
                ? "bg-[#4DFFA0] text-[#020806] shadow-[0_0_10px_rgba(77,255,160,0.3)]"
                : "text-[#89ACA0] hover:text-[#E8F5EF]"
            }`}
          >
            <ListFilter size={14} /> List View
          </button>
        </div>
      }
    />

    {message && <div className="toast success">{message}</div>}
    {actionError && !editing && <div className="toast error">{actionError}</div>}

    {activeViewMode === "COMMAND_CENTER" ? (
      <CommandCenterView
        assignments={items}
        clients={[]}
        userRole="EMPLOYEE"
        currentUser={shellUser ? { id: shellUser.id, name: shellUser.first_name || shellUser.username, username: shellUser.username, role: shellUser.portal_role } : undefined}
        onStatusChange={handleStatusChange}
        initialTab={initialTab}
      />
    ) : (

      <>
      <div className="stats-grid">


      <StatCard label="Total" value={loading ? "--" : summary.total} note="assigned to you" icon={<BriefcaseBusiness />} />
      <StatCard label="Pending" value={loading ? "--" : summary.pending} note="waiting to begin" icon={<BriefcaseBusiness />} />
      <StatCard label="In Progress" value={loading ? "--" : summary.in_progress} note="currently moving" icon={<BriefcaseBusiness />} accent />
      <StatCard label="Blocked" value={loading ? "--" : summary.blocked} note="needs attention" icon={<BriefcaseBusiness />} />
      <StatCard label="Completed" value={loading ? "--" : summary.completed} note="finished work" icon={<BriefcaseBusiness />} />
      <StatCard label="Overdue" value={loading ? "--" : summary.overdue} note="past due date" icon={<BriefcaseBusiness />} />
    </div>

    <div className="toolbar work-toolbar">
      <SlidersHorizontal size={18} />
      <select value={filters.status} onChange={event => updateFilter("status", event.target.value)} aria-label="Filter by status">
        <option value="">All statuses</option>
        {STATUSES.map(option => <option key={option}>{option}</option>)}
      </select>
      <select value={filters.priority} onChange={event => updateFilter("priority", event.target.value)} aria-label="Filter by priority">
        <option value="">All priorities</option>
        {PRIORITIES.map(option => <option key={option}>{option}</option>)}
      </select>
      <input type="date" value={filters.assigned_date} onChange={event => updateFilter("assigned_date", event.target.value)} aria-label="Filter by assigned date" />
      <input type="date" value={filters.due_date} onChange={event => updateFilter("due_date", event.target.value)} aria-label="Filter by due date" />
      <select value={filters.is_overdue} onChange={event => updateFilter("is_overdue", event.target.value)} aria-label="Filter by overdue">
        <option value="">Any due state</option>
        <option value="true">Overdue</option>
        <option value="false">Not overdue</option>
      </select>
      <button type="button" className="secondary-button" onClick={() => setFilters(EMPTY_FILTERS)}>Reset</button>
      <button type="button" className="secondary-button" onClick={() => loadWork(filters)} disabled={loading}><RotateCw size={15} /> Refresh</button>
    </div>

    <div className="data-card work-card">
      <div className="data-table employee-work-table">
        <div className="table-head">
          <span>Client</span><span>Work</span><span>Quantity</span><span>Priority</span><span>Status</span><span>Progress</span><span>Assigned</span><span>Due</span><span>Assigned by</span><span />
        </div>
        {!loading && !error && items.map(item => {
          const groups = groupedDeliverables(item.deliverables);
          const collapsed = collapsedDeliverables[item.id] === true;
          return <Fragment key={item.id}>
            <div className={`table-row ${item.is_overdue ? "overdue-row" : ""}`}>
              <span>{item.client_name}</span>
              <div className="work-title">
                <b>{item.title}</b>
                <small>{item.description || "No description"}</small>
                {item.deliverables.length > 0 && <small>{item.deliverables.length} deliverable items</small>}
              </div>
              <div className="quantity-cell"><b>{quantityLabel(item)}</b><small>{item.remaining_quantity} {item.unit} remaining</small></div>
              <Badge tone={item.priority}>{item.priority}</Badge>
              <Badge tone={item.status}>{item.status}</Badge>
              <ProgressMeter value={item.progress} />
              <span>{formatDate(item.assigned_date)}</span>
              <span>{formatDate(item.due_date)} {item.is_overdue && <em>Overdue</em>}</span>
              <span>{item.assigned_by_name || "Portal"}</span>
              <div className="row-actions">
                {item.deliverables.length === 0
                  ? <button type="button" disabled={submitting} onClick={() => openUpdate(item)}>Update</button>
                  : <button type="button" onClick={() => toggleDeliverables(item.id)}>{collapsed ? "View Items" : "Hide Items"}</button>}
              </div>
            </div>
            {item.deliverables.length > 0 && !collapsed && <div className="employee-deliverables-panel">
              {groups.map(group => <section className="employee-deliverable-group" key={group.client}>
                <div className="employee-deliverable-group-head">
                  <div><b>{group.client}</b><span>{group.items.length} deliverables</span></div>
                  <span>{group.completed} completed / {group.items.length - group.completed} remaining</span>
                </div>
                <div className="employee-deliverable-rows">
                  {group.items.map(deliverable => <div className="employee-deliverable-row" key={deliverable.id}>
                    <div>
                      <b>{deliverable.title}</b>
                      <small>{deliverable.brief || "No brief added"}</small>
                    </div>
                    <span>{deliverable.work_type}</span>
                    <span>{formatDate(deliverable.due_date)} {deliverable.is_overdue && <em>Overdue</em>}</span>
                    <Badge tone={deliverable.status}>{deliverable.status}</Badge>
                    <button type="button" disabled={submitting} onClick={() => openDeliverableUpdate(deliverable)}>Update Item</button>
                  </div>)}
                </div>
              </section>)}
            </div>}
          </Fragment>;
        })}
      </div>
      {loading && <EmptyState title="Loading your work" text="Fetching your assigned work." />}
      {error && <EmptyState title="Could not load your work" text={error} />}
      {!loading && !error && !items.length && <EmptyState title="No work assigned" text="There are no assignments to show for these filters." />}
    </div>
    </>
    )}


    {editing && <Modal title="Update work status" onClose={() => !submitting && setEditing(null)}>
      <form className="modal-form" onSubmit={submitUpdate}>
        <label>Work title<input value={editing.title} readOnly /></label>

        <div className="quantity-preview" style={{ background: "#141414", border: "1px solid #282828", padding: "14px 16px", borderRadius: "6px", marginBottom: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "10px", color: "#888", textTransform: "uppercase", letterSpacing: ".08em" }}>Target Quantity</span>
            <b style={{ fontSize: "13px", color: "#eee" }}>{editing.assigned_quantity} {editing.unit}</b>
          </div>
        </div>

        <label>
          Work Status
          <select
            value={selectedStatus}
            onChange={event => setSelectedStatus(event.target.value as WorkStatus)}
            required
          >
            {!["Pending", "Ongoing", "In Progress", "Blocked", "In Review"].includes(selectedStatus) && (
              <option value={selectedStatus} disabled>
                {selectedStatus}
              </option>
            )}
            <option value="Pending">Pending (0%)</option>
            <option value="In Progress">In Progress (25%)</option>
            <option value="Ongoing">Ongoing (75%)</option>
            <option value="Blocked">Blocked</option>
            <option value="In Review">In Review (Submit for Review)</option>
          </select>
          {formErrors.status && <small>{formErrors.status}</small>}
        </label>

        <ProgressMeter value={liveProgress} />
        {actionError && <div className="toast error">{actionError}</div>}
        <PrimaryButton type="submit" disabled={submitting}>{submitting ? "Updating..." : "Update Status"}</PrimaryButton>
      </form>
    </Modal>}

    {editingDeliverable && <Modal title="Update deliverable" onClose={() => !submitting && setEditingDeliverable(null)}>
      <form className="modal-form" onSubmit={submitDeliverableUpdate}>
        <label>Deliverable<input value={editingDeliverable.title} readOnly /></label>
        <label>Client<input value={editingDeliverable.client_name} readOnly /></label>
        <label>Brief<textarea value={editingDeliverable.brief || "No brief"} readOnly rows={3} /></label>
        <div className="quantity-preview">
          <span>Current status</span>
          <b>{editingDeliverable.status}</b>
          <small>Changing this item status automatically refreshes the parent assignment completed count, remaining count, progress, and status.</small>
        </div>
        <label>Status<select value={deliverableStatus} onChange={event => setDeliverableStatus(event.target.value as WorkStatus)}>
          <option value="Pending">Pending</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
          <option value="Blocked">Blocked</option>
        </select>{formErrors.status && <small>{formErrors.status}</small>}</label>
        {actionError && <div className="toast error">{actionError}</div>}
        <PrimaryButton type="submit" disabled={submitting}>{submitting ? "Updating..." : "Update Deliverable"}</PrimaryButton>
      </form>
    </Modal>}
  </>;
}
