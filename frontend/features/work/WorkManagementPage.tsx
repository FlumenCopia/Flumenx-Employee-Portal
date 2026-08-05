"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BriefcaseBusiness, Globe, LayoutDashboard, ListFilter, Pencil, Plus, RotateCw, SlidersHorizontal, Trash2 } from "lucide-react";
import { ApiError, api } from "@/lib/api";
import type { Client, Paginated, WorkAssignment, WorkDeliverable, WorkEmployeeOption, WorkReviewerOption, WorkPriority, WorkStatus, WorkSummary } from "@/lib/types";
import { SHOW_ADVANCED_WORKBOARD } from "@/lib/types";


import { Badge, EmptyState, PageHeader, PrimaryButton, StatCard } from "@/components/ui";
import { Modal } from "@/features/common/Modal";
import { useShellUser } from "@/components/shell";
import { ShareLinkModal } from "./ShareLinkModal";
import { CommandCenterView } from "./CommandCenterView";




type ManagementWorkspace = "admin" | "hr" | "bdo" | "team-lead";
type WorkFormState = {
  employee: string; client: string; title: string; description: string; priority: WorkPriority;
  assigned_date: string; due_date: string; assigned_quantity: string; completed_quantity: string;
  unit: string; statusMode: "AUTO" | "Blocked"; deliverables: DeliverableFormState[];
  work_type?: string; reviewer?: string;
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
    assigned_quantity: "4",
    completed_quantity: "0",
    unit: "tasks",
    statusMode: "AUTO",
    deliverables: [],
    work_type: "design",
    reviewer: "",
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
    reviewer: String(item.reviewer || item.reviewer_name || ""),
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
  const currentShellUser = useShellUser();
  const canManageAll = ["ADMIN", "HR", "TEAM_LEAD", "OPERATIONS_HEAD", "OPERATIONS"].includes((currentShellUser?.portal_role || "").toUpperCase()) || ["admin", "hr", "bdo", "team-lead"].includes(role);
  const canAddClient = role !== "team-lead";
  const [summary, setSummary] = useState<WorkSummary>(EMPTY_SUMMARY);
  const [items, setItems] = useState<WorkAssignment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<WorkEmployeeOption[]>([]);
  const [reviewers, setReviewers] = useState<WorkReviewerOption[]>([]);
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
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedShareClient, setSelectedShareClient] = useState<{ id: number; name: string } | null>(null);
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
      const [clientData, employeeData, reviewerData] = await Promise.all([
        api<Paginated<Client>>("/clients/", { signal: controller.signal }),
        api<WorkEmployeeOption[]>("/work-employee-options/", { signal: controller.signal }),
        api<WorkReviewerOption[]>("/work-reviewer-options/", { signal: controller.signal }),
      ]);
      if (controller.signal.aborted) return;
      setClients(clientData.results);
      setEmployees(employeeData);
      setReviewers(reviewerData);
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
    const effectiveClient = deliverableDraft.client || form.client;
    if (!effectiveClient || !deliverableDraft.title.trim() || !deliverableDraft.work_type.trim() || !deliverableDraft.due_date) {
      setActionError("Each deliverable needs a title, work type, and due date.");
      return;
    }
    setActionError("");
    setForm(current => {
      const next = {
        ...deliverableDraft,
        client: effectiveClient,
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
    const effectiveClient = form.client || (clients.length > 0 ? String(clients[0].id) : "");
    if (!effectiveClient) {
      setFormErrors({ client: "Counts toward / Client is required." });
      setActionError("Counts toward / Client is required.");
      setSubmitting(false);
      return;
    }
    const deliverablesToSync: DeliverableFormState[] = form.deliverables.length > 0
      ? form.deliverables
      : [{
          client: effectiveClient,
          title: form.title.trim(),
          brief: form.description || "",
          work_type: form.work_type || "design",
          due_date: form.due_date,
          status: "Pending" as WorkStatus,
        }];

    const payload = {
      employee: Number(form.employee),
      client: Number(effectiveClient),
      title: form.title.trim(),
      description: form.description,
      priority: form.priority,
      assigned_date: form.assigned_date,
      due_date: form.due_date,
      assigned_quantity: assignedQuantity,
      completed_quantity: completedQuantity,
      unit: "tasks",
      reviewer: form.reviewer ? (isNaN(Number(form.reviewer)) ? form.reviewer : Number(form.reviewer)) : null,

      ...(form.statusMode === "Blocked" ? { status: "Blocked" as WorkStatus } : editing ? {} : { status: "Pending" as WorkStatus }),
    };

    try {
      const saved = await api<WorkAssignment>(editing ? `/work-assignments/${editing.id}/` : "/work-assignments/", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      await syncDeliverables(saved.id, deliverablesToSync);
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

  const handleDeleteWork = async (id: number): Promise<boolean> => {
    try {
      await api(`/work-assignments/${id}/`, { method: "DELETE" });
      setMessage("Work assignment deleted.");
      await loadWork(filters);
      return true;
    } catch (err) {
      setActionError(apiError(err, "Could not delete assignment."));
      return false;
    }
  };


  const shellUser = useShellUser();

  return <>
    <PageHeader
      eyebrow={SHOW_ADVANCED_WORKBOARD ? "WORK / EXECUTION COMMAND CENTER" : "WORK / TASK BOARD"}
      title={SHOW_ADVANCED_WORKBOARD ? "Work board & Command Center." : "Work Board"}
      subtitle={SHOW_ADVANCED_WORKBOARD ? "Assign client work, track taskboards, timeline phases, and KPI targets in real time." : "Assign client work, track taskboards, and update deliverable progress in real time."}
      action={
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
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
              <LayoutDashboard size={14} /> {SHOW_ADVANCED_WORKBOARD ? "Command Center" : "Task Board"}
            </button>

            <button
              type="button"
              onClick={() => setActiveViewMode("LIST")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeViewMode === "LIST"
                  ? "bg-[#4DFFA0] text-[#020806] shadow-[0_0_10px_rgba(77,255,160,0.3)]"
                  : "text-[#89ACA0] hover:text-white"
              }`}
            >
              <ListFilter size={14} /> List View
            </button>
          </div>
          {clients.length > 0 && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                const currentClient = clients.find(c => String(c.id) === filters.client) || clients[0];
                if (currentClient) {
                  setSelectedShareClient({ id: currentClient.id, name: currentClient.name });
                  setShareModalOpen(true);
                }
              }}
            >
              <Globe size={15} /> Share progress
            </button>
          )}
          <PrimaryButton onClick={openCreate}>Assign work</PrimaryButton>
        </div>
      }
    />

    {message && <div className="toast success">{message}</div>}
    {actionError && <div className="toast error">{actionError}</div>}
    {optionsError && <div className="toast error">{optionsError}</div>}

    {activeViewMode === "COMMAND_CENTER" ? (
      <CommandCenterView
        assignments={items}
        clients={clients}
        userRole={role}
        currentUser={shellUser ? { id: shellUser.id, name: shellUser.first_name || shellUser.username, username: shellUser.username, role: shellUser.portal_role } : undefined}
        onStatusChange={handleStatusChange}
        onDeleteWork={handleDeleteWork}
        initialTab={initialTab}
      />
    ) : (


      <>


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
          {canManageAll && (
            <div className="row-actions">
              <button type="button" onClick={() => openEdit(item)} aria-label={`Edit ${item.title}`}><Pencil size={16} /></button>
              <button type="button" disabled={deletingId !== null} onClick={() => deleteAssignment(item)} aria-label={`Delete ${item.title}`}><Trash2 size={16} /></button>
            </div>
          )}
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
    </>
    )}

    {modalOpen && <Modal title={editing ? "Edit Task" : "New Task"} onClose={() => !submitting && setModalOpen(false)}>
      <form className="modal-form" onSubmit={saveAssignment} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {/* TASK TITLE */}

        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
          TASK TITLE
          <input
            type="text"
            value={form.title}
            onChange={event => setForm(current => ({ ...current, title: event.target.value }))}
            placeholder="e.g. Countdown creative series (12 posters)"
            required
            className="fi"
          />
          {formErrors.title && <small style={{ color: "#EF4444" }}>{formErrors.title}</small>}
        </label>

        {/* DESCRIPTION / BRIEF */}
        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
          DESCRIPTION / BRIEF
          <textarea
            value={form.description}
            onChange={event => setForm(current => ({ ...current, description: event.target.value }))}
            placeholder="What exactly needs to be produced, and any constraints"
            rows={3}
            className="fi"
          />
          {formErrors.description && <small style={{ color: "#EF4444" }}>{formErrors.description}</small>}
        </label>

        {/* TYPE & PRIORITY */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
            TYPE
            <select
              value={form.work_type || "design"}
              onChange={event => setForm(current => ({ ...current, work_type: event.target.value }))}
              className="fs"
            >
              <option value="design">Design</option>
              <option value="video">Video</option>
              <option value="ads">Ads</option>
              <option value="it">IT / Web</option>
              <option value="content">Content</option>
              <option value="ops">Ops</option>
              <option value="client">Client</option>
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
            PRIORITY
            <select
              value={form.priority}
              onChange={event => setForm(current => ({ ...current, priority: event.target.value as WorkPriority }))}
              className="fs"
            >
              <option value="Urgent">P0 Critical</option>
              <option value="High">P1 High</option>
              <option value="Normal">P2 Normal</option>
              <option value="Low">P2 Low</option>
            </select>
          </label>
        </div>

        {/* ASSIGN TO & REVIEWER */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
            ASSIGN TO
            <select
              value={form.employee}
              onChange={event => changeEmployee(event.target.value)}
              required
              disabled={optionsLoading}
              className="fs"
            >
              <option value="">Select employee</option>
              {visibleEmployees.map(employee => (
                <option key={employee.id} value={employee.id}>
                  {employee.display_name} — {employee.department}
                </option>
              ))}
            </select>
            {formErrors.employee && <small style={{ color: "#EF4444" }}>{formErrors.employee}</small>}
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
            REVIEWER
            <select
              value={form.reviewer || ""}
              onChange={event => setForm(current => ({ ...current, reviewer: event.target.value }))}
              className="fs"
            >
              <option value="">Select Reviewer (Default: Admin)</option>
              {reviewers.map(r => (
                <option key={r.id} value={r.id}>
                  {r.display_name} ({r.username})
                </option>
              ))}
            </select>

          </label>
        </div>

        {/* DUE DATE, EST. HOURS & COUNTS TOWARD */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
            DUE DATE
            <input
              type="date"
              value={form.due_date}
              onChange={event => setForm(current => ({ ...current, due_date: event.target.value }))}
              required
              className="fi"
            />
            {formErrors.due_date && <small style={{ color: "#EF4444" }}>{formErrors.due_date}</small>}
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
            EST. HOURS
            <input
              type="number"
              min="1"
              step="1"
              value={form.assigned_quantity || 4}
              onChange={event => setForm(current => ({ ...current, assigned_quantity: event.target.value }))}
              placeholder="4"
              className="fi"
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
            COUNTS TOWARD
            <select
              value={form.client || (clients.length > 0 ? String(clients[0].id) : "")}
              onChange={event => setForm(current => ({ ...current, client: event.target.value }))}
              required
              disabled={optionsLoading}
              className="fs"
            >
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
            {formErrors.client && <small style={{ color: "#EF4444" }}>{formErrors.client}</small>}
          </label>
        </div>

        {actionError && <div className="toast error">{actionError}</div>}

        {/* ACTIONS */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setModalOpen(false)}
            disabled={submitting}
          >
            Cancel
          </button>
          <PrimaryButton type="submit" disabled={submitting}>
            {submitting ? "Saving..." : editing ? "Save Changes" : "Create Task"}
          </PrimaryButton>
        </div>

      </form>
    </Modal>}



    {selectedShareClient && (
      <ShareLinkModal
        clientId={selectedShareClient.id}
        clientName={selectedShareClient.name}
        assignments={items}
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
      />
    )}
  </>;
}
