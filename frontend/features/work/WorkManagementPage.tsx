"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BriefcaseBusiness, Pencil, Plus, RotateCw, SlidersHorizontal, Trash2 } from "lucide-react";
import { ApiError, api } from "@/lib/api";
import type { Client, Paginated, WorkAssignment, WorkDeliverable, WorkEmployeeOption, WorkPriority, WorkStatus, WorkSummary } from "@/lib/types";
import { Badge, EmptyState, PageHeader, PrimaryButton, StatCard } from "@/components/ui";
import { Modal } from "@/features/common/Modal";

type ManagementWorkspace = "admin" | "hr" | "bdo" | "team-lead";
type WorkFormState = {
  employee: string; client: string; title: string; description: string; priority: WorkPriority;
  assigned_date: string; due_date: string; assigned_quantity: string; completed_quantity: string;
  unit: string; statusMode: "AUTO" | "Blocked"; deliverables: DeliverableFormState[];
};
type DeliverableFormState = {
  id?: number; client: string; title: string; brief: string; work_type: string; due_date: string; status: WorkStatus;
};
type WorkFilters = {
  employee: string; client: string; status: string; priority: string; due_date: string; assigned_date: string; is_overdue: string;
};

const EMPTY_SUMMARY: WorkSummary = { total: 0, pending: 0, in_progress: 0, blocked: 0, completed: 0, overdue: 0 };
const PRIORITIES: WorkPriority[] = ["Low", "Normal", "High", "Urgent"];
const STATUSES: WorkStatus[] = ["Pending", "In Progress", "Ongoing", "Blocked", "Completed"];
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
    assigned_quantity: "1",
    completed_quantity: "0",
    unit: "tasks",
    statusMode: "AUTO",
    deliverables: [],
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
    assigned_quantity: String(item.assigned_quantity),
    completed_quantity: String(item.completed_quantity),
    unit: item.unit,
    statusMode: item.status === "Blocked" ? "Blocked" : "AUTO",
    deliverables: item.deliverables.map(deliverable => ({
      id: deliverable.id,
      client: String(deliverable.client),
      title: deliverable.title,
      brief: deliverable.brief || "",
      work_type: deliverable.work_type,
      due_date: deliverable.due_date,
      status: deliverable.status,
    })),
  };
}

function defaultDeliverable(client = "", dueDate = today()): DeliverableFormState {
  return { client, title: "", brief: "", work_type: "", due_date: dueDate, status: "Pending" };
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

function quantityLabel(item: WorkAssignment) {
  return `${item.completed_quantity}/${item.assigned_quantity} ${item.unit}`;
}

function ProgressMeter({ value }: { value: number }) {
  const width = Math.max(0, Math.min(100, value));
  return <div className="work-progress"><div><i style={{ width: `${width}%` }} /></div><span>{value}%</span></div>;
}

export function WorkManagementPage({ role }: { role: ManagementWorkspace }) {
  const canAddClient = role !== "team-lead";
  const [summary, setSummary] = useState<WorkSummary>(EMPTY_SUMMARY);
  const [items, setItems] = useState<WorkAssignment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<WorkEmployeeOption[]>([]);
  const [filters, setFilters] = useState<WorkFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
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
  const [deliverablePanelOpen, setDeliverablePanelOpen] = useState(false);
  const [deliverableEditingIndex, setDeliverableEditingIndex] = useState<number | null>(null);
  const [deliverableDraft, setDeliverableDraft] = useState<DeliverableFormState>(defaultDeliverable());
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPending, setClientPending] = useState(false);
  const [clientError, setClientError] = useState("");
  const requestRef = useRef(0);
  const workAbortRef = useRef<AbortController | null>(null);
  const optionsAbortRef = useRef<AbortController | null>(null);

  const visibleEmployees = useMemo(() => [...employees].sort((a, b) => a.display_name.localeCompare(b.display_name)), [employees]);
  const selectedEmployee = useMemo(() => employees.find(employee => String(employee.id) === form.employee), [employees, form.employee]);
  const isDeliverableWorkflow = selectedEmployee?.department === "Design" || selectedEmployee?.department === "Video Editing" || form.deliverables.length > 0;

  const updateFilters = (nextFilters: WorkFilters) => {
    setFilters(nextFilters);
    setPage(1);
  };

  const loadWork = useCallback(async (nextFilters = filters, nextPage = page) => {
    workAbortRef.current?.abort();
    const controller = new AbortController();
    workAbortRef.current = controller;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setError("");
    try {
      const listQuery = queryFromFilters({ ...nextFilters, ...(nextPage > 1 ? { page: String(nextPage) } : {}) });
      const summaryQuery = queryFromFilters(nextFilters);
      const [list, nextSummary] = await Promise.all([
        api<Paginated<WorkAssignment>>(`/work-assignments/${listQuery}`, { signal: controller.signal }),
        api<WorkSummary>(`/work-assignments/summary/${summaryQuery}`, { signal: controller.signal }),
      ]);
      if (requestRef.current !== requestId || controller.signal.aborted) return;
      setItems(list.results);
      setCount(list.count);
      setHasNext(Boolean(list.next));
      setHasPrevious(Boolean(list.previous));
      setSummary(nextSummary);
    } catch (err) {
      if (!controller.signal.aborted) {
        setItems([]);
        setCount(0);
        setHasNext(false);
        setHasPrevious(false);
        setSummary(EMPTY_SUMMARY);
        setError(apiError(err, "Could not load work assignments."));
      }
    } finally {
      if (requestRef.current === requestId && !controller.signal.aborted) setLoading(false);
    }
  }, [filters, page]);

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
    setPage(1);
  }

  function openCreate() {
    setEditing(null);
    setForm(defaultForm());
    setFormErrors({});
    setActionError("");
    setDeliverablePanelOpen(false);
    setDeliverableEditingIndex(null);
    setDeliverableDraft(defaultDeliverable());
    setModalOpen(true);
  }

  function openEdit(item: WorkAssignment) {
    setEditing(item);
    setForm(formFromAssignment(item));
    setFormErrors({});
    setActionError("");
    setDeliverablePanelOpen(false);
    setDeliverableEditingIndex(null);
    setDeliverableDraft(defaultDeliverable(String(item.client), item.due_date));
    setModalOpen(true);
  }

  function changeEmployee(employeeId: string) {
    const employee = employees.find(option => String(option.id) === employeeId);
    setForm(current => ({ ...current, employee: employeeId }));
    if (employee?.department === "Design" || employee?.department === "Video Editing") {
      setDeliverableDraft(defaultDeliverable(form.client, form.due_date));
    }
  }

  function openAddDeliverable() {
    setDeliverableEditingIndex(null);
    setDeliverableDraft(defaultDeliverable(form.client, form.due_date));
    setActionError("");
    setDeliverablePanelOpen(true);
  }

  function openEditDeliverable(index: number) {
    const deliverable = form.deliverables[index];
    setDeliverableEditingIndex(index);
    setDeliverableDraft({ ...deliverable, client: deliverable.client || form.client });
    setActionError("");
    setDeliverablePanelOpen(true);
  }

  function closeDeliverablePanel() {
    setDeliverablePanelOpen(false);
    setDeliverableEditingIndex(null);
    setDeliverableDraft(defaultDeliverable(form.client, form.due_date));
  }

  function saveDeliverableDraft() {
    if (!deliverableDraft.client || !deliverableDraft.title.trim() || !deliverableDraft.work_type.trim() || !deliverableDraft.due_date) {
      setActionError("Each deliverable needs a client, title, work type, and due date.");
      return;
    }
    setActionError("");
    setForm(current => {
      const next = {
        ...deliverableDraft,
        title: deliverableDraft.title.trim(),
        work_type: deliverableDraft.work_type.trim(),
      };
      if (deliverableEditingIndex === null) {
        return { ...current, deliverables: [...current.deliverables, next] };
      }
      return {
        ...current,
        deliverables: current.deliverables.map((deliverable, index) => index === deliverableEditingIndex ? next : deliverable),
      };
    });
    closeDeliverablePanel();
  }

  function removeDeliverable(index: number) {
    setForm(current => ({
      ...current,
      deliverables: current.deliverables.filter((_, rowIndex) => rowIndex !== index),
    }));
  }

  async function syncDeliverables(assignmentId: number, deliverables: DeliverableFormState[]) {
    if (!isDeliverableWorkflow) return;
    const existingIds = new Set(deliverables.map(deliverable => deliverable.id).filter(Boolean));
    const original = editing?.deliverables || [];
    await Promise.all(original
      .filter(deliverable => !existingIds.has(deliverable.id))
      .map(deliverable => api(`/work-deliverables/${deliverable.id}/`, { method: "DELETE" })));
    for (const deliverable of deliverables) {
      const payload = {
        assignment: assignmentId,
        client: Number(deliverable.client),
        title: deliverable.title.trim(),
        brief: deliverable.brief,
        work_type: deliverable.work_type.trim(),
        due_date: deliverable.due_date,
        status: deliverable.status,
      };
      await api<WorkDeliverable>(deliverable.id ? `/work-deliverables/${deliverable.id}/` : "/work-deliverables/", {
        method: deliverable.id ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
    }
  }

  async function saveAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setActionError("");
    setFormErrors({});
    const assignedQuantity = Number(form.assigned_quantity);
    const completedQuantity = Number(form.completed_quantity);
    if (!Number.isFinite(assignedQuantity) || assignedQuantity <= 0) {
      setFormErrors({ assigned_quantity: "Assigned quantity must be greater than 0." });
      setActionError("Assigned quantity must be greater than 0.");
      setSubmitting(false);
      return;
    }
    if (!Number.isFinite(completedQuantity) || completedQuantity < 0 || completedQuantity > assignedQuantity) {
      setFormErrors({ completed_quantity: "Completed quantity must be between 0 and assigned quantity." });
      setActionError("Completed quantity must be between 0 and assigned quantity.");
      setSubmitting(false);
      return;
    }
    if (!form.unit.trim()) {
      setFormErrors({ unit: "Unit is required." });
      setActionError("Unit is required.");
      setSubmitting(false);
      return;
    }
    if (isDeliverableWorkflow) {
      if (form.deliverables.length === 0) {
        setActionError("Add at least one deliverable item.");
        setSubmitting(false);
        return;
      }
      const invalidDeliverable = form.deliverables.find(deliverable => !deliverable.client || !deliverable.title.trim() || !deliverable.work_type.trim() || !deliverable.due_date);
      if (invalidDeliverable) {
        setActionError("Each deliverable needs a client, title, work type, and due date.");
        setSubmitting(false);
        return;
      }
    }
    const effectiveAssigned = isDeliverableWorkflow ? Math.max(1, form.deliverables.length) : assignedQuantity;
    const effectiveCompleted = isDeliverableWorkflow ? form.deliverables.filter(deliverable => deliverable.status === "Completed").length : completedQuantity;
    const effectiveClient = isDeliverableWorkflow ? form.client || form.deliverables[0]?.client || "" : form.client;
    if (!effectiveClient) {
      setFormErrors({ client: "Client is required." });
      setActionError("Client is required.");
      setSubmitting(false);
      return;
    }
    const payload = {
      employee: Number(form.employee),
      client: Number(effectiveClient),
      title: form.title.trim(),
      description: form.description,
      priority: form.priority,
      assigned_date: form.assigned_date,
      due_date: form.due_date,
      assigned_quantity: effectiveAssigned,
      completed_quantity: effectiveCompleted,
      unit: isDeliverableWorkflow ? "items" : form.unit.trim(),
      ...(form.statusMode === "Blocked" ? { status: "Blocked" as WorkStatus } : editing ? { status: "Pending" as WorkStatus } : {}),
    };
    try {
      const saved = await api<WorkAssignment>(editing ? `/work-assignments/${editing.id}/` : "/work-assignments/", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      await syncDeliverables(saved.id, form.deliverables);
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
      <button type="button" className="secondary-button" onClick={() => { setFilters(EMPTY_FILTERS); setPage(1); }}>Reset</button>
      <button type="button" className="secondary-button" onClick={() => loadWork(filters)} disabled={loading}><RotateCw size={15} /> Refresh</button>
    </div>

    <div className="data-card work-card">
      <div className="data-table work-table">
        <div className="table-head">
          <span>Employee</span><span>Client</span><span>Work</span><span>Quantity</span><span>Priority</span><span>Status</span>
          <span>Progress</span><span>Assigned</span><span>Due</span><span>Owner</span><span />
        </div>
        {!loading && !error && items.map(item => <div className={`table-row ${item.is_overdue ? "overdue-row" : ""}`} key={item.id}>
          <span>{item.employee_name}</span>
          <span>{item.client_name}</span>
          <div className="work-title"><b>{item.title}</b><small>{item.description || "No description"}</small>{item.deliverables.length > 0 && <small>{item.deliverables.length} deliverable items</small>}</div>
          <div className="quantity-cell"><b>{quantityLabel(item)}</b><small>{item.remaining_quantity} {item.unit} remaining</small></div>
          <Badge tone={item.priority}>{item.priority}</Badge>
          <Badge tone={item.status}>{item.status}</Badge>
          <ProgressMeter value={item.progress} />
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
    </div>

    {modalOpen && <Modal title={editing ? "Edit work assignment" : "Assign work"} onClose={() => !submitting && setModalOpen(false)}>
      <form className="modal-form" onSubmit={saveAssignment}>
        <label>Employee<select value={form.employee} onChange={event => changeEmployee(event.target.value)} required disabled={optionsLoading}>
          <option value="">Select employee</option>
          {visibleEmployees.map(employee => <option key={employee.id} value={employee.id}>{employee.display_name} - {employee.department}</option>)}
        </select>{formErrors.employee && <small>{formErrors.employee}</small>}</label>
        <label>{isDeliverableWorkflow ? "Assignment client (optional)" : "Client"}<select value={form.client} onChange={event => setForm(current => ({ ...current, client: event.target.value }))} required={!isDeliverableWorkflow} disabled={optionsLoading}>
          <option value="">{isDeliverableWorkflow ? "Use deliverable client" : "Select client"}</option>
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
          <label>Status<select value={form.statusMode} onChange={event => setForm(current => ({ ...current, statusMode: event.target.value as WorkFormState["statusMode"] }))}>
            <option value="AUTO">Auto from quantity</option>
            <option value="Blocked">Blocked</option>
          </select>{formErrors.status && <small>{formErrors.status}</small>}</label>
        </div>
        <div className="two-col">
          <label>Assigned date<input type="date" value={form.assigned_date} onChange={event => setForm(current => ({ ...current, assigned_date: event.target.value }))} required />{formErrors.assigned_date && <small>{formErrors.assigned_date}</small>}</label>
          <label>Due date<input type="date" value={form.due_date} onChange={event => setForm(current => ({ ...current, due_date: event.target.value }))} required />{formErrors.due_date && <small>{formErrors.due_date}</small>}</label>
        </div>
        {isDeliverableWorkflow ? <div className="deliverable-editor">
          <div className="deliverable-editor-head">
            <div><b>Deliverable items</b><span>Designer and Video Editing work is tracked one item at a time.</span></div>
            <button type="button" className="secondary-button" onClick={openAddDeliverable}><Plus size={15} /> Add Deliverable</button>
          </div>
          {form.deliverables.length === 0 && !deliverablePanelOpen && <div className="deliverable-empty">No deliverables added yet. Add the first item when this assignment needs item-level tracking.</div>}
          {form.deliverables.length > 0 && <div className="deliverable-compact-list">
            {form.deliverables.map((deliverable, index) => {
              const client = clients.find(item => String(item.id) === deliverable.client);
              return <div className="deliverable-compact-row" key={deliverable.id || index}>
                <div>
                  <b>{deliverable.title}</b>
                  <span>{client?.name || "Selected client"} - {deliverable.work_type} - due {formatDate(deliverable.due_date)}</span>
                  {deliverable.brief && <small>{deliverable.brief}</small>}
                </div>
                <Badge tone={deliverable.status}>{deliverable.status}</Badge>
                <div className="row-actions">
                  <button type="button" onClick={() => openEditDeliverable(index)} aria-label={`Edit ${deliverable.title}`}><Pencil size={15} /></button>
                  <button type="button" onClick={() => removeDeliverable(index)} aria-label={`Delete ${deliverable.title}`}><Trash2 size={15} /></button>
                </div>
              </div>;
            })}
          </div>}
          {deliverablePanelOpen && <div className="deliverable-inline-panel">
            <div className="deliverable-panel-head">
              <b>{deliverableEditingIndex === null ? "Add deliverable" : "Edit deliverable"}</b>
              <button type="button" onClick={closeDeliverablePanel}>Cancel</button>
            </div>
            <div className="deliverable-form-row">
              <label>Client<select value={deliverableDraft.client || form.client} onChange={event => setDeliverableDraft(current => ({ ...current, client: event.target.value }))} required>
                <option value="">Assignment client</option>
                {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select></label>
              <label>Work title<input value={deliverableDraft.title} onChange={event => setDeliverableDraft(current => ({ ...current, title: event.target.value }))} required /></label>
              <label>Work type<input value={deliverableDraft.work_type} onChange={event => setDeliverableDraft(current => ({ ...current, work_type: event.target.value }))} placeholder="poster, video..." required /></label>
              <label>Due date<input type="date" value={deliverableDraft.due_date} onChange={event => setDeliverableDraft(current => ({ ...current, due_date: event.target.value }))} required /></label>
              <label>Status<select value={deliverableDraft.status} onChange={event => setDeliverableDraft(current => ({ ...current, status: event.target.value as WorkStatus }))}>
                {STATUSES.map(status => <option key={status}>{status}</option>)}
              </select></label>
              <label className="deliverable-brief">Brief<textarea value={deliverableDraft.brief} onChange={event => setDeliverableDraft(current => ({ ...current, brief: event.target.value }))} rows={2} /></label>
            </div>
            <div className="deliverable-panel-actions">
              <button type="button" className="secondary-button" onClick={closeDeliverablePanel}>Cancel</button>
              <button type="button" className="secondary-button" onClick={saveDeliverableDraft}>{deliverableEditingIndex === null ? "Save Deliverable" : "Save Changes"}</button>
            </div>
          </div>}
        </div> : <>
          <div className="two-col">
            <label>Assigned quantity<input type="number" min="1" step="1" value={form.assigned_quantity} onChange={event => setForm(current => ({ ...current, assigned_quantity: event.target.value }))} required />{formErrors.assigned_quantity && <small>{formErrors.assigned_quantity}</small>}</label>
            <label>Completed quantity<input type="number" min="0" step="1" value={form.completed_quantity} onChange={event => setForm(current => ({ ...current, completed_quantity: event.target.value }))} required />{formErrors.completed_quantity && <small>{formErrors.completed_quantity}</small>}</label>
          </div>
          <label>Unit<input value={form.unit} onChange={event => setForm(current => ({ ...current, unit: event.target.value }))} placeholder="tasks, designs, videos..." required />{formErrors.unit && <small>{formErrors.unit}</small>}</label>
        </>}
        {editing && <div className="quantity-preview">
          <span>Derived by backend</span>
          <b>{editing.progress}% - {editing.status}</b>
          <small>{editing.remaining_quantity} {editing.unit} remaining after the latest saved update.</small>
        </div>}
        {actionError && <div className="toast error">{actionError}</div>}
        <PrimaryButton type="submit" disabled={submitting}>{submitting ? "Saving..." : editing ? "Save changes" : "Assign work"}</PrimaryButton>
      </form>
    </Modal>}
  </>;
}
