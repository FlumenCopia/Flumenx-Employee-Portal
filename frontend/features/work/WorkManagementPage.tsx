"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BriefcaseBusiness, Pencil, Plus, RotateCw, SlidersHorizontal, Trash2 } from "lucide-react";
import { ApiError, api } from "@/lib/api";
import type { Client, Paginated, WorkAssignment, WorkEmployeeOption, WorkPriority, WorkStatus, WorkSummary } from "@/lib/types";
import { Badge, EmptyState, PageHeader, PrimaryButton, StatCard } from "@/components/ui";
import { Modal } from "@/features/common/Modal";

type ManagementWorkspace = "admin" | "hr" | "bdo" | "team-lead";
type WorkFormState = {
  employee: string; client: string; title: string; description: string; priority: WorkPriority;
  assigned_date: string; due_date: string; status: WorkStatus; progress: string;
};
type WorkFilters = {
  employee: string; client: string; status: string; priority: string; due_date: string; assigned_date: string; is_overdue: string;
};

const EMPTY_SUMMARY: WorkSummary = { total: 0, pending: 0, in_progress: 0, blocked: 0, completed: 0, overdue: 0 };
const PRIORITIES: WorkPriority[] = ["Low", "Normal", "High", "Urgent"];
const STATUSES: WorkStatus[] = ["Pending", "In Progress", "Blocked", "Completed"];
const EMPTY_FILTERS: WorkFilters = { employee: "", client: "", status: "", priority: "", due_date: "", assigned_date: "", is_overdue: "" };

function today() {
  return new Date().toISOString().slice(0, 10);
}

function defaultForm(): WorkFormState {
  return {
    employee: "",
    client: "",
    title: "",
    description: "",
    priority: "Normal",
    assigned_date: today(),
    due_date: today(),
    status: "Pending",
    progress: "0",
  };
}

function formFromAssignment(item: WorkAssignment): WorkFormState {
  return {
    employee: String(item.employee),
    client: String(item.client),
    title: item.title,
    description: item.description || "",
    priority: item.priority,
    assigned_date: item.assigned_date,
    due_date: item.due_date,
    status: item.status,
    progress: String(item.progress),
  };
}

function queryFromFilters(filters: WorkFilters) {
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

export function WorkManagementPage({ role }: { role: ManagementWorkspace }) {
  const canAddClient = role !== "team-lead";
  const [summary, setSummary] = useState<WorkSummary>(EMPTY_SUMMARY);
  const [items, setItems] = useState<WorkAssignment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<WorkEmployeeOption[]>([]);
  const [filters, setFilters] = useState<WorkFilters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [error, setError] = useState("");
  const [optionsError, setOptionsError] = useState("");
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WorkAssignment | null>(null);
  const [form, setForm] = useState<WorkFormState>(defaultForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPending, setClientPending] = useState(false);
  const [clientError, setClientError] = useState("");
  const requestRef = useRef(0);
  const workAbortRef = useRef<AbortController | null>(null);
  const optionsAbortRef = useRef<AbortController | null>(null);

  const visibleEmployees = useMemo(() => [...employees].sort((a, b) => a.display_name.localeCompare(b.display_name)), [employees]);

  const loadWork = useCallback(async (nextFilters = filters) => {
    workAbortRef.current?.abort();
    const controller = new AbortController();
    workAbortRef.current = controller;
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
        setError(apiError(err, "Could not load work assignments."));
      }
    } finally {
      if (requestRef.current === requestId && !controller.signal.aborted) setLoading(false);
    }
  }, [filters]);

  const loadOptions = useCallback(async () => {
    optionsAbortRef.current?.abort();
    const controller = new AbortController();
    optionsAbortRef.current = controller;
    setOptionsLoading(true);
    setOptionsError("");
    try {
      const [clientData, employeeData] = await Promise.all([
        api<Paginated<Client>>("/clients/", { signal: controller.signal }),
        api<WorkEmployeeOption[]>("/work-employee-options/", { signal: controller.signal }),
      ]);
      if (controller.signal.aborted) return;
      setClients(clientData.results);
      setEmployees(employeeData);
    } catch (err) {
      if (!controller.signal.aborted) setOptionsError(apiError(err, "Could not load form options."));
    } finally {
      if (!controller.signal.aborted) setOptionsLoading(false);
    }
  }, [role]);

  useEffect(() => {
    loadOptions();
    return () => {
      requestRef.current += 1;
      workAbortRef.current?.abort();
      optionsAbortRef.current?.abort();
    };
  }, [loadOptions]);

  useEffect(() => {
    loadWork(filters);
  }, [filters, loadWork]);

  function updateFilter(key: keyof WorkFilters, value: string) {
    setFilters(current => ({ ...current, [key]: value }));
  }

  function openCreate() {
    setEditing(null);
    setForm(defaultForm());
    setFormErrors({});
    setActionError("");
    setModalOpen(true);
  }

  function openEdit(item: WorkAssignment) {
    setEditing(item);
    setForm(formFromAssignment(item));
    setFormErrors({});
    setActionError("");
    setModalOpen(true);
  }

  async function saveAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setActionError("");
    setFormErrors({});
    const payload = {
      employee: Number(form.employee),
      client: Number(form.client),
      title: form.title.trim(),
      description: form.description,
      priority: form.priority,
      assigned_date: form.assigned_date,
      due_date: form.due_date,
      status: form.status,
      progress: Number(form.progress),
    };
    try {
      await api<WorkAssignment>(editing ? `/work-assignments/${editing.id}/` : "/work-assignments/", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      setModalOpen(false);
      setEditing(null);
      setForm(defaultForm());
      setMessage(editing ? "Work assignment updated." : "Work assigned.");
      await loadWork(filters);
    } catch (err) {
      setFormErrors(fieldErrors(err));
      setActionError(apiError(err, "Could not save work assignment."));
    } finally {
      setSubmitting(false);
    }
  }

  async function addClient() {
    if (!canAddClient || clientPending || !clientName.trim()) return;
    setClientPending(true);
    setClientError("");
    try {
      const created = await api<Client>("/clients/", { method: "POST", body: JSON.stringify({ name: clientName }) });
      setClients(current => [...current.filter(client => client.id !== created.id), created].sort((a, b) => a.name.localeCompare(b.name)));
      setForm(current => ({ ...current, client: String(created.id) }));
      setClientName("");
    } catch (err) {
      setClientError(apiError(err, "Could not add client."));
    } finally {
      setClientPending(false);
    }
  }

  async function deleteAssignment(item: WorkAssignment) {
    if (deletingId !== null || !window.confirm(`Delete "${item.title}"?`)) return;
    setDeletingId(item.id);
    setActionError("");
    try {
      await api(`/work-assignments/${item.id}/`, { method: "DELETE" });
      setMessage("Work assignment deleted.");
      await loadWork(filters);
    } catch (err) {
      setActionError(apiError(err, "Could not delete work assignment."));
    } finally {
      setDeletingId(null);
    }
  }

  return <>
    <PageHeader
      eyebrow="WORK / MANAGEMENT"
      title="Work board."
      subtitle="Assign client work and track team progress without leaving the portal."
      action={<PrimaryButton onClick={openCreate}>Assign work</PrimaryButton>}
    />

    {message && <div className="toast success">{message}</div>}
    {actionError && <div className="toast error">{actionError}</div>}
    {optionsError && <div className="toast error">{optionsError}</div>}

    <div className="stats-grid">
      <StatCard label="Total" value={loading ? "--" : summary.total} note="visible assignments" icon={<BriefcaseBusiness />} />
      <StatCard label="Pending" value={loading ? "--" : summary.pending} note="waiting to begin" icon={<BriefcaseBusiness />} />
      <StatCard label="In Progress" value={loading ? "--" : summary.in_progress} note="currently moving" icon={<BriefcaseBusiness />} accent />
      <StatCard label="Blocked" value={loading ? "--" : summary.blocked} note="needs attention" icon={<BriefcaseBusiness />} />
      <StatCard label="Completed" value={loading ? "--" : summary.completed} note="finished work" icon={<BriefcaseBusiness />} />
      <StatCard label="Overdue" value={loading ? "--" : summary.overdue} note="past due date" icon={<BriefcaseBusiness />} />
    </div>

    <div className="toolbar work-toolbar">
      <SlidersHorizontal size={18} />
      <select value={filters.employee} onChange={event => updateFilter("employee", event.target.value)} aria-label="Filter by employee">
        <option value="">All employees</option>
        {visibleEmployees.map(employee => <option key={employee.id} value={employee.id}>{employee.display_name}</option>)}
      </select>
      <select value={filters.client} onChange={event => updateFilter("client", event.target.value)} aria-label="Filter by client">
        <option value="">All clients</option>
        {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
      </select>
      <select value={filters.status} onChange={event => updateFilter("status", event.target.value)} aria-label="Filter by status">
        <option value="">All statuses</option>
        {STATUSES.map(status => <option key={status}>{status}</option>)}
      </select>
      <select value={filters.priority} onChange={event => updateFilter("priority", event.target.value)} aria-label="Filter by priority">
        <option value="">All priorities</option>
        {PRIORITIES.map(priority => <option key={priority}>{priority}</option>)}
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
      <div className="data-table work-table">
        <div className="table-head">
          <span>Employee</span><span>Client</span><span>Work</span><span>Priority</span><span>Status</span>
          <span>Progress</span><span>Assigned</span><span>Due</span><span>Owner</span><span />
        </div>
        {!loading && !error && items.map(item => <div className={`table-row ${item.is_overdue ? "overdue-row" : ""}`} key={item.id}>
          <span>{item.employee_name}</span>
          <span>{item.client_name}</span>
          <div className="work-title"><b>{item.title}</b><small>{item.description || "No description"}</small></div>
          <Badge tone={item.priority}>{item.priority}</Badge>
          <Badge tone={item.status}>{item.status}</Badge>
          <span>{item.progress}%</span>
          <span>{formatDate(item.assigned_date)}</span>
          <span>{formatDate(item.due_date)} {item.is_overdue && <em>Overdue</em>}</span>
          <span>{item.assigned_by_name || "Portal"}</span>
          <div className="row-actions">
            <button type="button" onClick={() => openEdit(item)} aria-label={`Edit ${item.title}`}><Pencil size={16} /></button>
            <button type="button" disabled={deletingId !== null} onClick={() => deleteAssignment(item)} aria-label={`Delete ${item.title}`}><Trash2 size={16} /></button>
          </div>
        </div>)}
      </div>
      {loading && <EmptyState title="Loading work" text="Fetching work assignments and summary." />}
      {error && <EmptyState title="Could not load work" text={error} />}
      {!loading && !error && !items.length && <EmptyState title="No work found" text="Try clearing filters or assign new work." />}
    </div>

    {modalOpen && <Modal title={editing ? "Edit work assignment" : "Assign work"} onClose={() => !submitting && setModalOpen(false)}>
      <form className="modal-form" onSubmit={saveAssignment}>
        <label>Employee<select value={form.employee} onChange={event => setForm(current => ({ ...current, employee: event.target.value }))} required disabled={optionsLoading}>
          <option value="">Select employee</option>
          {visibleEmployees.map(employee => <option key={employee.id} value={employee.id}>{employee.display_name}</option>)}
        </select>{formErrors.employee && <small>{formErrors.employee}</small>}</label>
        <label>Client<select value={form.client} onChange={event => setForm(current => ({ ...current, client: event.target.value }))} required disabled={optionsLoading}>
          <option value="">Select client</option>
          {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>{formErrors.client && <small>{formErrors.client}</small>}</label>
        {canAddClient && <div className="quick-client">
          <label>Quick add client<input value={clientName} onChange={event => setClientName(event.target.value)} placeholder="Client name" /></label>
          <button type="button" onClick={addClient} disabled={clientPending || !clientName.trim()}><Plus size={15} /> Add</button>
          {clientError && <small>{clientError}</small>}
        </div>}
        <label>Work title<input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} required />{formErrors.title && <small>{formErrors.title}</small>}</label>
        <label>Description<textarea value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} rows={4} />{formErrors.description && <small>{formErrors.description}</small>}</label>
        <div className="two-col">
          <label>Priority<select value={form.priority} onChange={event => setForm(current => ({ ...current, priority: event.target.value as WorkPriority }))}>{PRIORITIES.map(priority => <option key={priority}>{priority}</option>)}</select>{formErrors.priority && <small>{formErrors.priority}</small>}</label>
          <label>Status<select value={form.status} onChange={event => setForm(current => ({ ...current, status: event.target.value as WorkStatus }))}>{STATUSES.map(status => <option key={status}>{status}</option>)}</select>{formErrors.status && <small>{formErrors.status}</small>}</label>
        </div>
        <div className="two-col">
          <label>Assigned date<input type="date" value={form.assigned_date} onChange={event => setForm(current => ({ ...current, assigned_date: event.target.value }))} required />{formErrors.assigned_date && <small>{formErrors.assigned_date}</small>}</label>
          <label>Due date<input type="date" value={form.due_date} onChange={event => setForm(current => ({ ...current, due_date: event.target.value }))} required />{formErrors.due_date && <small>{formErrors.due_date}</small>}</label>
        </div>
        <label>Progress<input type="number" min="0" max="100" value={form.progress} onChange={event => setForm(current => ({ ...current, progress: event.target.value }))} required />{formErrors.progress && <small>{formErrors.progress}</small>}</label>
        {actionError && <div className="toast error">{actionError}</div>}
        <PrimaryButton type="submit" disabled={submitting}>{submitting ? "Saving..." : editing ? "Save changes" : "Assign work"}</PrimaryButton>
      </form>
    </Modal>}
  </>;
}
