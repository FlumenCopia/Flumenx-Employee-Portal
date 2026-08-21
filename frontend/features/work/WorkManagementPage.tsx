"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BriefcaseBusiness, Pencil, Plus, RotateCw, SlidersHorizontal, Trash2 } from "lucide-react";
import { ApiError, api } from "@/lib/api";
import type { Client, DepartmentItem, Paginated, WorkAssignment, WorkDeliverable, WorkEmployeeOption, WorkReviewerOption, WorkPriority, WorkStatus, WorkSummary, WorkspaceRole } from "@/lib/types";
import { SHOW_ADVANCED_WORKBOARD, normalizeDepartment } from "@/lib/types";

import { Badge, EmptyState, PageHeader, PrimaryButton, StatCard } from "@/components/ui";
import { Modal } from "@/features/common/Modal";
import { useShellUser } from "@/components/shell";
import { ShareLinkModal } from "./ShareLinkModal";
import { CommandCenterView } from "./CommandCenterView";

type ManagementWorkspace = WorkspaceRole;
type WorkFormState = {
  employee: string; client: string; title: string; description: string; priority: WorkPriority;
  assigned_date: string; due_date: string; assigned_quantity: string; completed_quantity: string;
  unit: string; statusMode: "AUTO" | "Blocked"; deliverables: DeliverableFormState[];
  work_type?: string; reviewer?: string; phase?: string; estimated_hours?: string;
};
type DeliverableFormState = {
  id?: number; client: string; title: string; brief: string; work_type: string; due_date: string; status: WorkStatus;
};
type WorkFilters = {
  employee: string; client: string; status: string; priority: string; due_date: string; assigned_date: string; is_overdue: string; review_status: string;
};

const EMPTY_SUMMARY: WorkSummary = { total: 0, pending: 0, in_progress: 0, blocked: 0, completed: 0, overdue: 0, review_pending: 0, review_ok: 0, review_correction: 0 };
const PRIORITIES: WorkPriority[] = ["Low", "Normal", "High", "Urgent"];
const STATUSES: WorkStatus[] = ["Backlog", "Assigned", "In Progress", "In Review", "Approved", "Published"];
const EMPTY_FILTERS: WorkFilters = { employee: "", client: "", status: "", priority: "", due_date: "", assigned_date: "", is_overdue: "", review_status: "" };

function today() {
  return new Date().toISOString().slice(0, 10);
}

type TaskRowState = {
  id: string;
  title: string;
  due_date: string;
};

const defaultTaskRow = (dueDate?: string): TaskRowState => ({
  id: String(Math.random()),
  title: "",
  due_date: dueDate || today(),
});

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
    work_type: "design",
    reviewer: "",
    phase: "ph1",
    estimated_hours: "4",
  };
}

function formFromAssignment(item: WorkAssignment): WorkFormState {
  let phase = "ph1";
  let estimated_hours = "4";
  let cleanDesc = item.description || "";

  const phaseMatch = cleanDesc.match(/\[PHASE:\s*(ph\d)\]/i);
  if (phaseMatch) phase = phaseMatch[1].toLowerCase();

  const estMatch = cleanDesc.match(/\[EST_HOURS:\s*(\d+)\]/i);
  if (estMatch) estimated_hours = estMatch[1];

  cleanDesc = cleanDesc.replace(/\[PHASE:\s*ph\d\]/gi, "").replace(/\[EST_HOURS:\s*\d+\]/gi, "").trim();

  return {
    employee: String(item.employee),
    client: String(item.client),
    title: item.title,
    description: cleanDesc,
    priority: item.priority,
    assigned_date: item.assigned_date,
    due_date: item.due_date,
    assigned_quantity: String(item.assigned_quantity || 1),
    completed_quantity: String(item.completed_quantity || 0),
    unit: item.unit || "tasks",
    statusMode: item.status === "Blocked" ? "Blocked" : "AUTO",
    reviewer: String(item.reviewer || item.reviewer_name || ""),
    phase,
    estimated_hours,
    deliverables: (item.deliverables || []).map(deliverable => ({
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
  return { client, title: "", brief: "", work_type: "web_development", due_date: dueDate, status: "Assigned" };
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

export function WorkManagementPage({ role }: { role?: WorkspaceRole } = {}) {
  const currentShellUser = useShellUser();
  const effectiveRole = role || (currentShellUser ? (["SUPER_ADMIN", "ADMIN", "OPERATIONS", "OPERATIONS_HEAD"].includes(currentShellUser.portal_role.toUpperCase()) ? "admin" : currentShellUser.portal_role.toLowerCase() as WorkspaceRole) : "admin");
  const isEmployeeWorkspace = effectiveRole === "employee";
  const userRoleStr = (currentShellUser?.portal_role || "").toUpperCase();
  const isTeamLeadOrCreator = ["SUPER_ADMIN", "ADMIN", "HR", "TEAM_LEAD", "OPERATIONS_HEAD"].includes(userRoleStr) || userRoleStr.endsWith("_TEAM_LEAD") || userRoleStr.endsWith("TEAM_LEAD") || userRoleStr.includes("LEAD");
  const workPerms = (currentShellUser as any)?.permissions?.WORK_BOARD || (currentShellUser as any)?.permissions?.["*"];
  const hasDynamicCreate = workPerms ? Boolean(workPerms.can_create) : false;
  const canManageAll = isTeamLeadOrCreator || hasDynamicCreate || Boolean((currentShellUser as any)?.is_superuser);
  const canAddClient = (["SUPER_ADMIN", "ADMIN", "HR", "OPERATIONS_HEAD"].includes(userRoleStr) || ["admin", "hr"].includes(effectiveRole)) && !isEmployeeWorkspace;
  const [summary, setSummary] = useState<WorkSummary>(EMPTY_SUMMARY);
  const [items, setItems] = useState<WorkAssignment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<WorkEmployeeOption[]>([]);
  const [reviewers, setReviewers] = useState<WorkReviewerOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [filters, setFilters] = useState<WorkFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [tasksToAssign, setTasksToAssign] = useState<TaskRowState[]>([defaultTaskRow()]);

  const dynamicWorkTypeOptions = useMemo(() => {
    return [
      { value: "web_development", label: "Web Development" },
      { value: "video_editing", label: "Video Editing" },
      { value: "design", label: "Design" },
      { value: "digital_marketing", label: "Digital Marketing" },
      { value: "accountant", label: "Accountant" },
      { value: "operations", label: "Operations" },
      { value: "hr", label: "HR" },
    ];
  }, []);

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

  const addTaskRow = () => {
    const lastDate = tasksToAssign.length ? tasksToAssign[tasksToAssign.length - 1].due_date : form.due_date;
    setTasksToAssign(current => [...current, defaultTaskRow(lastDate)]);
  };

  const removeTaskRow = (id: string) => {
    setTasksToAssign(current => (current.length > 1 ? current.filter(t => t.id !== id) : current));
  };

  const updateTaskRow = (id: string, field: "title" | "due_date", value: string) => {
    setTasksToAssign(current => current.map(t => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const visibleEmployees = useMemo(() => {
    const targetDept = normalizeDepartment(form.work_type || "web_development");
    const matching = employees
      .filter((emp) => normalizeDepartment(emp.department) === targetDept)
      .sort((a, b) => a.display_name.localeCompare(b.display_name));
    const remaining = employees
      .filter((emp) => normalizeDepartment(emp.department) !== targetDept)
      .sort((a, b) => a.display_name.localeCompare(b.display_name));
    return [...matching, ...remaining];
  }, [employees, form.work_type]);
  const selectedEmployee = useMemo(() => employees.find(employee => String(employee.id) === form.employee), [employees, form.employee]);
  const selectedClient = useMemo(() => clients.find(client => String(client.id) === filters.client), [clients, filters.client]);
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
      const summaryQuery = queryFromFilters({ client: nextFilters.client } as WorkFilters);
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
      const [clientData, employeeData, reviewerData, deptData] = await Promise.all([
        api<Paginated<Client>>("/clients/", { signal: controller.signal }),
        api<WorkEmployeeOption[]>("/work-employee-options/", { signal: controller.signal }),
        api<WorkReviewerOption[]>("/work-reviewer-options/", { signal: controller.signal }),
        api<DepartmentItem[] | { results: DepartmentItem[] }>("/portal/departments/", { signal: controller.signal }).catch(() => []),
      ]);
      if (controller.signal.aborted) return;
      setClients(clientData.results);
      setEmployees(employeeData);
      setReviewers(reviewerData);
      const deptList = Array.isArray(deptData) ? deptData : (deptData as any)?.results || [];
      setDepartments(deptList);
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
    const initialForm = defaultForm();
    if (clients.length > 0) {
      initialForm.client = String(clients[0].id);
    }
    setForm(initialForm);
    setTasksToAssign([defaultTaskRow(initialForm.due_date)]);
    setFormErrors({});
    setActionError("");
    setClientName("");
    setClientError("");
    setDeliverablePanelOpen(false);
    setDeliverableEditingIndex(null);
    setDeliverableDraft(defaultDeliverable());
    setModalOpen(true);
  }

  useEffect(() => {
    const handleOpenModal = () => openCreate();
    window.addEventListener("flumenx:open_new_task_modal", handleOpenModal);
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("createTask") === "true") {
      openCreate();
      const url = new URL(window.location.href);
      url.searchParams.delete("createTask");
      window.history.replaceState({}, "", url.toString());
    }
    return () => window.removeEventListener("flumenx:open_new_task_modal", handleOpenModal);
  }, []);

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

    const effectiveClient = form.client || (clients.length > 0 ? String(clients[0].id) : "");
    const phaseTag = `[PHASE: ${form.phase || "ph1"}]`;
    const estTag = `[EST_HOURS: ${form.estimated_hours || "4"}]`;
    const cleanDesc = form.description ? form.description.trim() : "";
    const fullDesc = `${cleanDesc ? cleanDesc + "\n\n" : ""}${phaseTag} ${estTag}`.trim();

    if (!editing) {
      if (!effectiveClient) {
        setFormErrors({ client: "Client is required." });
        setActionError("Client is required.");
        setSubmitting(false);
        return;
      }
      if (!form.employee) {
        setFormErrors({ employee: "Assigned employee is required." });
        setActionError("Assigned employee is required.");
        setSubmitting(false);
        return;
      }
      for (let i = 0; i < tasksToAssign.length; i++) {
        if (!tasksToAssign[i].title.trim()) {
          setActionError(`Please enter a title for Task #${i + 1}.`);
          setSubmitting(false);
          return;
        }
        if (!tasksToAssign[i].due_date) {
          setActionError(`Please select a due date for Task #${i + 1}.`);
          setSubmitting(false);
          return;
        }
      }

      const bulkPayload = {
        client: Number(effectiveClient),
        employee: Number(form.employee),
        reviewer: form.reviewer ? (isNaN(Number(form.reviewer)) ? form.reviewer : Number(form.reviewer)) : null,
        work_type: form.work_type || "web_development",
        priority: form.priority || "Normal",
        description: fullDesc,
        tasks: tasksToAssign.map(t => ({
          title: t.title.trim(),
          due_date: t.due_date,
        })),
      };

      try {
        await api<WorkAssignment[]>("/work-assignments/bulk-create/", {
          method: "POST",
          body: JSON.stringify(bulkPayload),
        });
        setMessage(
          tasksToAssign.length > 1
            ? `Successfully created ${tasksToAssign.length} tasks.`
            : "Successfully created task."
        );
        setModalOpen(false);
        loadWork(filters);
      } catch (err) {
        setActionError(apiError(err, "Could not save work assignments."));
      } finally {
        setSubmitting(false);
      }
      return;
    }

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

    const payload = {
      employee: Number(form.employee),
      title: form.title.trim(),
      description: fullDesc,
      priority: form.priority,
      assigned_date: form.assigned_date || today(),
      due_date: form.due_date,
      assigned_quantity: assignedQuantity,
      completed_quantity: completedQuantity,
      unit: "tasks",
      reviewer: form.reviewer ? (isNaN(Number(form.reviewer)) ? form.reviewer : Number(form.reviewer)) : null,
      ...(effectiveClient ? { client: Number(effectiveClient) } : {}),
    };

    try {
      const saved = await api<WorkAssignment>(`/work-assignments/${editing.id}/`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      const savedClient = String(saved.client);
      const deliverablesToSync: DeliverableFormState[] = form.deliverables.length > 0
        ? form.deliverables.map(deliverable => ({ ...deliverable, client: deliverable.client || savedClient }))
        : [{
            title: saved.title,
            brief: saved.description,
            work_type: form.work_type || "web_development",
            due_date: saved.due_date,
            status: saved.status === "Approved" || saved.status === "Completed" ? "Approved" : "Pending",
            client: savedClient,
          }];
      await syncDeliverables(saved.id, deliverablesToSync);
      setMessage("Saved work assignment successfully.");
      setModalOpen(false);
      setEditing(null);
      setForm(defaultForm());
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

  const [activeViewMode] = useState<"COMMAND_CENTER" | "LIST">("COMMAND_CENTER");


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

  const handleReviewCheck = async (id: number, reviewStatus: "PENDING_REVIEW" | "OK" | "CORRECTION_NEEDED", note?: string) => {
    try {
      const updated = await api<WorkAssignment>(`/work-assignments/${id}/review/`, {
        method: "POST",
        body: JSON.stringify({ review_status: reviewStatus, review_note: note || "" }),
      });
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
      await loadWork(filters);
    } catch (err) {
      const msg = apiError(err, "Could not update reviewer check.");
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
    />

    {message && <div className="toast success">{message}</div>}
    {actionError && <div className="toast error">{actionError}</div>}
    {optionsError && <div className="toast error">{optionsError}</div>}

    {activeViewMode === "COMMAND_CENTER" ? (
      <CommandCenterView
        assignments={items}
        clients={clients}
        members={visibleEmployees}
        userRole={role}
        currentUser={shellUser ? { id: shellUser.id, employeeId: shellUser.employee?.id, name: shellUser.first_name || shellUser.username, username: shellUser.username, role: shellUser.portal_role } : undefined}
        workSummary={summary}
        selectedClientName={selectedClient?.name}
        selectedClientId={filters.client}
        onClientChange={(clientId) => updateFilters({ ...filters, client: clientId })}
        onStatusChange={handleStatusChange}
        onReviewCheck={handleReviewCheck}
        onDeleteWork={canManageAll ? handleDeleteWork : undefined}
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

    {modalOpen && <Modal title={editing ? "Edit Task" : "New Task"} eyebrow={editing ? "FLUMENX / EDIT" : "FLUMENX / CREATE"} size="lg" onClose={() => !submitting && setModalOpen(false)}>
      <form className="modal-form" onSubmit={saveAssignment} style={{ display: "flex", flexDirection: "column", gap: "14px", maxHeight: "80vh", overflowY: "auto", paddingRight: "4px" }}>
        {editing ? (
          <>
            {/* SINGLE TASK EDIT FORM */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
                TASK TITLE *
                <input
                  type="text"
                  value={form.title}
                  onChange={event => setForm(current => ({ ...current, title: event.target.value }))}
                  placeholder="e.g. Countdown creative series"
                  required
                  className="fi"
                />
                {formErrors.title && <small style={{ color: "#EF4444" }}>{formErrors.title}</small>}
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
                CLIENT / ACCOUNT *
                <select
                  value={form.client}
                  onChange={event => setForm(current => ({ ...current, client: event.target.value }))}
                  required
                  className="fs"
                >
                  <option value="" disabled>Select Client</option>
                  {clients.map(c => (
                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
                WORK TYPE
                <select
                  value={form.work_type || "web_development"}
                  onChange={event => setForm(current => ({ ...current, work_type: event.target.value }))}
                  className="fs"
                >
                  {dynamicWorkTypeOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
                ASSIGN TO *
                <select
                  value={form.employee}
                  onChange={event => changeEmployee(event.target.value)}
                  required
                  disabled={optionsLoading}
                  className="fs"
                >
                  {visibleEmployees.map(employee => (
                    <option key={employee.id} value={employee.id}>
                      {employee.display_name} — {employee.department}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
                REVIEWER
                <select
                  value={form.reviewer || ""}
                  onChange={event => setForm(current => ({ ...current, reviewer: event.target.value }))}
                  className="fs"
                >
                  <option value="">Default Reviewer (Admin)</option>
                  {reviewers.map(r => (
                    <option key={r.id} value={r.id}>{r.display_name} ({r.username})</option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
                DUE DATE *
                <input
                  type="date"
                  value={form.due_date}
                  onChange={event => setForm(current => ({ ...current, due_date: event.target.value }))}
                  required
                  className="fi"
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
                ESTIMATED HOURS
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.estimated_hours || "4"}
                  onChange={event => setForm(current => ({ ...current, estimated_hours: event.target.value }))}
                  placeholder="e.g. 4"
                  className="fi"
                />
              </label>
            </div>
          </>
        ) : (
          <>
            {/* BULK NEW TASK CREATION FORM */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
                CLIENT / ACCOUNT *
                <select
                  value={form.client}
                  onChange={event => setForm(current => ({ ...current, client: event.target.value }))}
                  required
                  className="fs"
                >
                  <option value="" disabled>
                    {optionsLoading ? "Loading clients..." : clients.length ? "Select Client" : "No clients available"}
                  </option>
                  {clients.map(c => (
                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                  ))}
                </select>
                {formErrors.client && <small style={{ color: "#EF4444" }}>{formErrors.client}</small>}
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
                WORK TYPE / DEPARTMENT
                <select
                  value={form.work_type || "web_development"}
                  onChange={event => setForm(current => ({ ...current, work_type: event.target.value }))}
                  className="fs"
                >
                  {dynamicWorkTypeOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {canAddClient && (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "-4px" }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    type="text"
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    placeholder="+ Or type new client name to add dynamically..."
                    className="fi"
                    style={{ flex: 1, padding: "7px 10px", fontSize: "11px" }}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addClient();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={addClient}
                    disabled={clientPending || !clientName.trim()}
                    style={{
                      padding: "7px 12px",
                      borderRadius: "8px",
                      background: "rgba(5, 150, 105, 0.1)",
                      color: "#059669",
                      border: "1px solid rgba(5, 150, 105, 0.3)",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: clientName.trim() ? "pointer" : "not-allowed",
                      whiteSpace: "nowrap",
                      opacity: clientName.trim() ? 1 : 0.6,
                    }}
                  >
                    {clientPending ? "Adding..." : "+ Add Client"}
                  </button>
                </div>
                {clientError && <small style={{ color: "#EF4444", fontSize: "10.5px" }}>{clientError}</small>}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
                ASSIGN TO *
                <select
                  value={form.employee}
                  onChange={event => changeEmployee(event.target.value)}
                  required
                  disabled={optionsLoading}
                  className="fs"
                >
                  <option value="" disabled>
                    {optionsLoading ? "Loading employees..." : visibleEmployees.length ? "Select employee" : "No active employees available"}
                  </option>
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
                  <option value="">Default Reviewer (Admin)</option>
                  {reviewers.map(r => (
                    <option key={r.id} value={r.id}>{r.display_name} ({r.username})</option>
                  ))}
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

            {/* TASKS TO ASSIGN SECTION */}
            <div style={{ marginTop: "6px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.05em", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                  TASKS TO ASSIGN
                  <span className="badge active" style={{ fontSize: "10px", padding: "2px 8px" }}>
                    {tasksToAssign.length} {tasksToAssign.length === 1 ? "Task" : "Tasks"}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {tasksToAssign.map((taskRow, idx) => (
                  <div
                    key={taskRow.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr 140px auto",
                      gap: "10px",
                      alignItems: "center",
                      background: "var(--card2)",
                      padding: "8px 12px",
                      borderRadius: "var(--r-sm)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", minWidth: "22px" }}>
                      #{idx + 1}
                    </span>

                    <input
                      type="text"
                      value={taskRow.title}
                      onChange={e => updateTaskRow(taskRow.id, "title", e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (idx === tasksToAssign.length - 1 && taskRow.title.trim()) {
                            addTaskRow();
                          }
                        }
                      }}
                      placeholder="e.g. Independence Day Poster"
                      required
                      className="fi"
                      style={{ width: "100%" }}
                    />

                    <input
                      type="date"
                      value={taskRow.due_date}
                      onChange={e => updateTaskRow(taskRow.id, "due_date", e.target.value)}
                      required
                      className="fi"
                    />

                    {tasksToAssign.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeTaskRow(taskRow.id)}
                        title="Remove Task"
                        style={{
                          background: "rgba(239, 68, 68, 0.08)",
                          color: "#EF4444",
                          border: "1px solid rgba(239, 68, 68, 0.2)",
                          borderRadius: "6px",
                          padding: "6px 8px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : (
                      <div style={{ width: "28px" }} />
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={addTaskRow}
                style={{ marginTop: "10px", width: "100%", justifyContent: "center", gap: "6px" }}
              >
                <Plus size={14} /> + Add Another Task
              </button>
            </div>
          </>
        )}

        {actionError && <div className="toast error" style={{ margin: "4px 0" }}>{actionError}</div>}

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
            {submitting ? "Saving..." : editing ? "Save Changes" : tasksToAssign.length > 1 ? `Create ${tasksToAssign.length} Tasks` : "Create Task"}
          </PrimaryButton>
        </div>
      </form>
    </Modal>}


{
  selectedShareClient && (
    <ShareLinkModal
      clientId={selectedShareClient.id}
      clientName={selectedShareClient.name}
      assignments={items}
      open={shareModalOpen}
      onClose={() => setShareModalOpen(false)}
    />
  )
}
  </>;
}
