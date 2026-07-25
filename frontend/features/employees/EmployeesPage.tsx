"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BriefcaseBusiness, Check, Pencil, Plus, RotateCw, Search, Trash2, UserPlus } from "lucide-react";
import { Client, Department, Employee, Paginated, PortalRole, WorkAssignment, WorkPriority, WorkStatus } from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import { Avatar } from "@/components/icons";
import { Badge, EmptyState, PageHeader, PrimaryButton } from "@/components/ui";
import { Modal } from "@/features/common/Modal";

type EmployeeWorkspaceRole = "admin" | "hr";

const DEPARTMENT_OPTIONS: Department[] = [
  "Web Development",
  "Video Editing",
  "Design",
  "Digital Marketing",
  "Accountant",
  "HR",
  "Operations",
];

const ROLE_OPTIONS: Record<EmployeeWorkspaceRole, { value: PortalRole; label: string }[]> = {
  admin: [
    { value: "HR", label: "HR" },
    { value: "ACCOUNTANT", label: "Accountant" },
    { value: "BDE", label: "BDE" },
    { value: "EMPLOYEE", label: "Employee" },
  ],
  hr: [
    { value: "ACCOUNTANT", label: "Accountant" },
    { value: "BDE", label: "BDE" },
    { value: "EMPLOYEE", label: "Employee" },
  ],
};

type AssignWorkForm = {
  client: string; title: string; description: string; priority: WorkPriority;
  assigned_date: string; due_date: string; status: WorkStatus; progress: string;
};

const WORK_PRIORITIES: WorkPriority[] = ["Low", "Normal", "High", "Urgent"];
const WORK_STATUSES: WorkStatus[] = ["Pending", "In Progress", "Blocked", "Completed"];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function defaultAssignForm(): AssignWorkForm {
  return {
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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function apiMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function apiFields(err: unknown) {
  return err instanceof ApiError ? err.fields : {};
}

export function EmployeesPage({ role = "admin" }: { role?: EmployeeWorkspaceRole }) {
  const employeeBasePath = `/${role}/employees`;
  const [items, setItems] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workEmployee, setWorkEmployee] = useState<Employee | null>(null);
  const [assignEmployee, setAssignEmployee] = useState<Employee | null>(null);
  const [workItems, setWorkItems] = useState<WorkAssignment[]>([]);
  const [workLoading, setWorkLoading] = useState(false);
  const [workError, setWorkError] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [assignForm, setAssignForm] = useState<AssignWorkForm>(defaultAssignForm);
  const [assignErrors, setAssignErrors] = useState<Record<string, string>>({});
  const [assignError, setAssignError] = useState("");
  const [assignMessage, setAssignMessage] = useState("");
  const [assignPending, setAssignPending] = useState(false);
  const workRequestRef = useRef(0);
  const workAbortRef = useRef<AbortController | null>(null);
  const clientsAbortRef = useRef<AbortController | null>(null);

  const loadEmployees = () => {
    setLoading(true);
    setError("");
    api<Paginated<Employee>>("/employees/")
      .then(data => setItems(data.results))
      .catch(err => {
        setItems([]);
        setError(err instanceof Error ? err.message : "Could not load employees.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadEmployees(); }, []);

  const loadEmployeeWork = useCallback(async (employee: Employee) => {
    workAbortRef.current?.abort();
    const controller = new AbortController();
    const requestId = workRequestRef.current + 1;
    workRequestRef.current = requestId;
    workAbortRef.current = controller;
    setWorkLoading(true);
    setWorkError("");
    try {
      const data = await api<Paginated<WorkAssignment>>(`/work-assignments/?employee=${employee.id}`, { signal: controller.signal });
      if (controller.signal.aborted || workRequestRef.current !== requestId) return;
      setWorkItems(data.results);
    } catch (err) {
      if (!controller.signal.aborted) {
        setWorkItems([]);
        setWorkError(apiMessage(err, "Could not load employee work."));
      }
    } finally {
      if (!controller.signal.aborted && workRequestRef.current === requestId) setWorkLoading(false);
    }
  }, []);

  const loadClients = useCallback(async () => {
    clientsAbortRef.current?.abort();
    const controller = new AbortController();
    clientsAbortRef.current = controller;
    setClientsLoading(true);
    try {
      const data = await api<Paginated<Client>>("/clients/", { signal: controller.signal });
      if (!controller.signal.aborted) setClients(data.results);
    } catch (err) {
      if (!controller.signal.aborted) setAssignError(apiMessage(err, "Could not load clients."));
    } finally {
      if (!controller.signal.aborted) setClientsLoading(false);
    }
  }, []);

  useEffect(() => () => {
    workRequestRef.current += 1;
    workAbortRef.current?.abort();
    clientsAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!workEmployee && !assignEmployee) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !assignPending) {
        setWorkEmployee(null);
        setAssignEmployee(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [workEmployee, assignEmployee, assignPending]);

  async function removeEmployee(id: number) {
    try {
      await api(`/employees/${id}/`, { method: "DELETE" });
      setItems(items.filter(x => x.id !== id));
    } catch {}
  }

  function viewWork(employee: Employee) {
    setWorkEmployee(employee);
    setWorkItems([]);
    setWorkError("");
    loadEmployeeWork(employee);
  }

  function assignWork(employee: Employee) {
    setAssignEmployee(employee);
    setAssignForm(defaultAssignForm());
    setAssignErrors({});
    setAssignError("");
    loadClients();
  }

  async function submitAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assignEmployee || assignPending) return;
    setAssignPending(true);
    setAssignErrors({});
    setAssignError("");
    try {
      await api<WorkAssignment>("/work-assignments/", {
        method: "POST",
        body: JSON.stringify({
          employee: assignEmployee.id,
          client: Number(assignForm.client),
          title: assignForm.title.trim(),
          description: assignForm.description,
          priority: assignForm.priority,
          assigned_date: assignForm.assigned_date,
          due_date: assignForm.due_date,
          status: assignForm.status,
          progress: Number(assignForm.progress),
        }),
      });
      setAssignMessage(`Work assigned to ${assignEmployee.name}.`);
      const employeeToRefresh = assignEmployee;
      setAssignEmployee(null);
      setAssignForm(defaultAssignForm());
      if (workEmployee?.id === employeeToRefresh.id) await loadEmployeeWork(employeeToRefresh);
    } catch (err) {
      setAssignErrors(apiFields(err));
      setAssignError(apiMessage(err, "Could not assign work."));
    } finally {
      setAssignPending(false);
    }
  }

  const shown = useMemo(() => items.filter(e => (department === "All" || e.department === department) && `${e.name} ${e.email} ${e.employee_code}`.toLowerCase().includes(search.toLowerCase())), [items, search, department]);
  const selectedWorkSummary = useMemo(() => ({
    total: workItems.length,
    pending: workItems.filter(item => item.status === "Pending").length,
    in_progress: workItems.filter(item => item.status === "In Progress").length,
    blocked: workItems.filter(item => item.status === "Blocked").length,
    completed: workItems.filter(item => item.status === "Completed").length,
    overdue: workItems.filter(item => item.is_overdue).length,
  }), [workItems]);

return <>
  <PageHeader
    eyebrow="PEOPLE / DIRECTORY"
    title="Your people."
    subtitle="A clear view of everyone building FLUMENX."
    action={
      <Link
        className="primary-button"
        href={`${employeeBasePath}/create`}
      >
        Add employee <UserPlus size={17} />
      </Link>
    }
  />

  {assignMessage && <div className="toast success">{assignMessage}</div>}

  <div className="toolbar">
    <div className="search-box">
      <Search size={18} />

      <input
        placeholder="Search name, email or ID..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
    </div>

    <select
      value={department}
      onChange={e => setDepartment(e.target.value)}
    >
      <option>All</option>

      {DEPARTMENT_OPTIONS.map(departmentName => (
        <option key={departmentName}>
          {departmentName}
        </option>
      ))}
    </select>

    <div className="record-count">
      {shown.length} PEOPLE
    </div>
  </div>

  <div className="data-card">
    <div className="data-table employees-table">
      <div className="table-head">
        <span>Employee</span>
        <span>Department</span>
        <span>Role</span>
        <span>Joined</span>
        <span>Status</span>
        <span />
      </div>

      {!loading &&
        !error &&
        shown.map(e => (
          <div
            className="table-row"
            key={e.id}
          >
            <div className="person-cell">
              <Avatar name={e.name} />

              <div>
                <Link href={`${employeeBasePath}/${e.id}`}>
                  {e.name}
                </Link>

                <span>
                  {e.employee_code} - {e.email}
                </span>
              </div>
            </div>

            <span>{e.department}</span>
            <span>{e.designation}</span>

            <span>
              {new Date(e.joining_date).toLocaleDateString(
                "en-US",
                {
                  month: "short",
                  year: "numeric",
                }
              )}
            </span>

            <Badge tone={e.status}>
              {e.status}
            </Badge>

            <div className="row-actions">
              <button type="button" onClick={() => viewWork(e)} aria-label={`View work for ${e.name}`}>
                <BriefcaseBusiness size={16} />
              </button>

              <button type="button" onClick={() => assignWork(e)} aria-label={`Assign work to ${e.name}`}>
                <Plus size={16} />
              </button>

              <Link href={`${employeeBasePath}/${e.id}`}>
                <Pencil size={16} />
              </Link>

              <button onClick={() => removeEmployee(e.id)}>
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
    </div>

    {loading && (
      <EmptyState
        title="Loading employees"
        text="Fetching the latest employee directory."
      />
    )}

    {error && (
      <EmptyState
        title="Could not load employees"
        text={error}
      />
    )}

    {!loading && !error && !shown.length && (
      <EmptyState
        title="No people found"
        text="Try a different search or department."
      />
    )}
  </div>

  {workEmployee && (
    <Modal title={`${workEmployee.name} work`} onClose={() => setWorkEmployee(null)}>
      <div className="employee-work-panel">
        <div className="mini-metrics">
          <div><span>Total</span><strong>{workLoading ? "--" : selectedWorkSummary.total}</strong><small>assignments</small></div>
          <div><span>Pending</span><strong>{workLoading ? "--" : selectedWorkSummary.pending}</strong><small>waiting</small></div>
          <div><span>In Progress</span><strong>{workLoading ? "--" : selectedWorkSummary.in_progress}</strong><small>moving</small></div>
          <div><span>Blocked</span><strong>{workLoading ? "--" : selectedWorkSummary.blocked}</strong><small>needs help</small></div>
          <div><span>Completed</span><strong>{workLoading ? "--" : selectedWorkSummary.completed}</strong><small>done</small></div>
          <div><span>Overdue</span><strong>{workLoading ? "--" : selectedWorkSummary.overdue}</strong><small>late</small></div>
        </div>
        <div className="work-drawer-actions">
          <button type="button" className="secondary-button" disabled={workLoading} onClick={() => loadEmployeeWork(workEmployee)}><RotateCw size={15} /> Refresh</button>
          <button type="button" className="secondary-button" onClick={() => assignWork(workEmployee)}><Plus size={15} /> Assign Work</button>
        </div>
        {workLoading && <EmptyState title="Loading work" text="Fetching this employee's assignments." />}
        {workError && <div className="toast error">{workError}</div>}
        {!workLoading && !workError && !workItems.length && <EmptyState title="No work assigned" text="There are no assignments for this employee yet." />}
        {!workLoading && !workError && Boolean(workItems.length) && <div className="employee-work-list">
          {workItems.map(item => <article key={item.id} className={item.is_overdue ? "overdue-row" : ""}>
            <div><span>{item.client_name}</span><b>{item.title}</b></div>
            <Badge tone={item.priority}>{item.priority}</Badge>
            <Badge tone={item.status}>{item.status}</Badge>
            <span>{item.progress}%</span>
            <span>{formatDate(item.due_date)} {item.is_overdue && <em>Overdue</em>}</span>
          </article>)}
        </div>}
      </div>
    </Modal>
  )}

  {assignEmployee && (
    <Modal title={`Assign work to ${assignEmployee.name}`} onClose={() => !assignPending && setAssignEmployee(null)}>
      <form className="modal-form" onSubmit={submitAssignment}>
        <label>Employee<input value={assignEmployee.name} readOnly /></label>
        <label>Client<select value={assignForm.client} onChange={event => setAssignForm(current => ({ ...current, client: event.target.value }))} required disabled={clientsLoading}>
          <option value="">Select client</option>
          {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>{assignErrors.client && <small>{assignErrors.client}</small>}</label>
        <label>Work title<input value={assignForm.title} onChange={event => setAssignForm(current => ({ ...current, title: event.target.value }))} required />{assignErrors.title && <small>{assignErrors.title}</small>}</label>
        <label>Description<textarea value={assignForm.description} onChange={event => setAssignForm(current => ({ ...current, description: event.target.value }))} rows={4} />{assignErrors.description && <small>{assignErrors.description}</small>}</label>
        <div className="two-col">
          <label>Priority<select value={assignForm.priority} onChange={event => setAssignForm(current => ({ ...current, priority: event.target.value as WorkPriority }))}>{WORK_PRIORITIES.map(option => <option key={option}>{option}</option>)}</select>{assignErrors.priority && <small>{assignErrors.priority}</small>}</label>
          <label>Status<select value={assignForm.status} onChange={event => setAssignForm(current => ({ ...current, status: event.target.value as WorkStatus }))}>{WORK_STATUSES.map(option => <option key={option}>{option}</option>)}</select>{assignErrors.status && <small>{assignErrors.status}</small>}</label>
        </div>
        <div className="two-col">
          <label>Assigned date<input type="date" value={assignForm.assigned_date} onChange={event => setAssignForm(current => ({ ...current, assigned_date: event.target.value }))} required />{assignErrors.assigned_date && <small>{assignErrors.assigned_date}</small>}</label>
          <label>Due date<input type="date" value={assignForm.due_date} onChange={event => setAssignForm(current => ({ ...current, due_date: event.target.value }))} required />{assignErrors.due_date && <small>{assignErrors.due_date}</small>}</label>
        </div>
        <label>Progress<input type="number" min="0" max="100" value={assignForm.progress} onChange={event => setAssignForm(current => ({ ...current, progress: event.target.value }))} required />{assignErrors.progress && <small>{assignErrors.progress}</small>}</label>
        {assignError && <div className="toast error">{assignError}</div>}
        <PrimaryButton type="submit" disabled={assignPending}>{assignPending ? "Assigning..." : "Assign Work"}</PrimaryButton>
      </form>
    </Modal>
  )}
</>;
}
export function EmployeeForm({ employee, employeeId, role = "admin" }: { employee?: Employee; employeeId?: number; role?: EmployeeWorkspaceRole }) {
  const router = useRouter();
  const employeeBasePath = `/${role}/employees`;
  const [saved, setSaved] = useState(false);
  const [loadedEmployee, setLoadedEmployee] = useState<Employee | undefined>(employee);
  const [loading, setLoading] = useState(Boolean(employeeId && !employee));
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!employeeId || employee) return;
    setLoading(true);
    setError("");
    api<Employee>(`/employees/${employeeId}/`)
      .then(setLoadedEmployee)
      .catch(err => setError(err instanceof Error ? err.message : "Could not load employee."))
      .finally(() => setLoading(false));
  }, [employeeId, employee]);

  const currentEmployee = loadedEmployee;
  const roleOptions = currentEmployee?.portal_role === "ADMIN"
    ? [{ value: "ADMIN" as PortalRole, label: "Admin" }, ...ROLE_OPTIONS[role]]
    : ROLE_OPTIONS[role];

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    const data = new FormData(e.currentTarget);
    const body = {
      employee_code: data.get("employee_code"), name: data.get("name"), email: data.get("email"),
      phone: data.get("phone"), department: data.get("department"), portal_role: data.get("portal_role"), designation: data.get("designation"),
      joining_date: data.get("joining_date"), status: data.get("status"), location: data.get("location"),
      ...(!currentEmployee ? { password: data.get("password") } : {}),
    };
    try {
      await api(currentEmployee ? `/employees/${currentEmployee.id}/` : "/employees/", {
        method: currentEmployee ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      setSaved(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => router.push(employeeBasePath), 500);
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fields);
        setError(err.message);
      } else {
        setError("Employee record could not be saved.");
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  if (loading) return <EmptyState title="Loading employee" text="Fetching the employee record." />;
  if (error) return <EmptyState title="Could not load employee" text={error} />;

  return <>
    <PageHeader eyebrow="PEOPLE / RECORD" title={currentEmployee ? "Employee profile." : "Add someone new."} subtitle={currentEmployee ? "Review and update this employee record." : "Create their FLUMENX identity and workspace access."} />
    {saved && <div className="toast success"><Check size={18} /> Employee record saved successfully.</div>}
    {error && <div className="toast error">{error}</div>}
    <form className="editor-card" onSubmit={submit}>
      <div className="editor-intro"><span>01</span><div><h2>Core information</h2><p>The details used across the employee directory.</p></div></div>
      <div className="form-grid">
        <label>Employee code<input name="employee_code" defaultValue={currentEmployee?.employee_code || ""} required />{fieldErrors.employee_code && <small>{fieldErrors.employee_code}</small>}</label>
        <label>Full name<input name="name" defaultValue={currentEmployee?.name} placeholder="Employee full name" required />{fieldErrors.name && <small>{fieldErrors.name}</small>}</label>
        <label>Work email<input name="email" defaultValue={currentEmployee?.email} type="email" placeholder="name@flumenx.local" required />{fieldErrors.email && <small>{fieldErrors.email}</small>}</label>
        <label>Phone number<input name="phone" defaultValue={currentEmployee?.phone} placeholder="+91" required />{fieldErrors.phone && <small>{fieldErrors.phone}</small>}</label>
        <label>Department<select name="department" defaultValue={currentEmployee?.department || ""} required><option value="" disabled>Select department</option>{DEPARTMENT_OPTIONS.map(option => <option key={option}>{option}</option>)}</select>{fieldErrors.department && <small>{fieldErrors.department}</small>}</label>
        <label>Portal role<select name="portal_role" defaultValue={roleOptions.some(option => option.value === currentEmployee?.portal_role) ? currentEmployee?.portal_role : roleOptions[0].value} required>{roleOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{fieldErrors.portal_role && <small>{fieldErrors.portal_role}</small>}</label>
        <label>Designation<input name="designation" defaultValue={currentEmployee?.designation} placeholder="Role title" required />{fieldErrors.designation && <small>{fieldErrors.designation}</small>}</label>
        <label>Joining date<input name="joining_date" defaultValue={currentEmployee?.joining_date} type="date" required />{fieldErrors.joining_date && <small>{fieldErrors.joining_date}</small>}</label>
        <label>Status<select name="status" defaultValue={currentEmployee?.status || "Active"}><option>Active</option><option>On Leave</option><option>Inactive</option></select>{fieldErrors.status && <small>{fieldErrors.status}</small>}</label>
        <label>Location<input name="location" defaultValue={currentEmployee?.location} placeholder="City" />{fieldErrors.location && <small>{fieldErrors.location}</small>}</label>
        {!currentEmployee && <label>Temporary password<input name="password" type="text" required />{fieldErrors.password && <small>{fieldErrors.password}</small>}</label>}
      </div>
      <div className="form-actions"><Link href={employeeBasePath}>Cancel</Link><PrimaryButton type="submit">{currentEmployee ? "Save changes" : "Create employee"}</PrimaryButton></div>
    </form>
  </>;
}
