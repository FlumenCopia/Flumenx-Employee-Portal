"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, Eye, FileText, MessageSquare, Pencil, Phone, Search, Trash2, UserPlus, Video } from "lucide-react";
import { Department, Employee, Paginated, PortalRole } from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import { Avatar } from "@/components/icons";
import { Badge, EmptyState, PageHeader, PrimaryButton } from "@/components/ui";
import { Modal } from "@/features/common/Modal";
import { getCachedAuthUser } from "@/lib/auth-cache";
import { EmployeeDocumentsModal } from "./EmployeeDocumentsModal";


export type EmployeeWorkspaceRole = "admin" | "hr" | "employee" | "team-lead" | "bdo" | "accountant";

const DEPARTMENT_OPTIONS: Department[] = [
  "Web Development",
  "Video Editing",
  "Design",
  "Digital Marketing",
  "Accountant",
  "HR",
  "Operations",
];

const DEFAULT_ROLE_ITEMS: { value: PortalRole; label: string }[] = [
  { value: "HR", label: "HR" },
  { value: "ACCOUNTANT", label: "Accountant" },
  { value: "BDE", label: "BDE" },
  { value: "TEAM_LEAD", label: "Team Lead" },
  { value: "OPERATIONS_HEAD", label: "Operations Head" },
  { value: "EMPLOYEE", label: "Employee" },
];

const ROLE_OPTIONS: Record<string, { value: PortalRole; label: string }[]> = {
  admin: DEFAULT_ROLE_ITEMS,
  hr: [
    { value: "ACCOUNTANT", label: "Accountant" },
    { value: "BDE", label: "BDE" },
    { value: "TEAM_LEAD", label: "Team Lead" },
    { value: "EMPLOYEE", label: "Employee" },
  ],
};


export function EmployeesPage({ role }: { role?: EmployeeWorkspaceRole }) {
  const employeeBasePath = role ? `/${role}/employees` : `/employees`;
  const [items, setItems] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const [departmentsList, setDepartmentsList] = useState<string[]>(DEPARTMENT_OPTIONS);
  const [dynamicRolesList, setDynamicRolesList] = useState<{ value: PortalRole | string; label: string }[]>(DEFAULT_ROLE_ITEMS);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ results: { name: string }[] } | { name: string }[]>("/departments/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res as any)?.results || [];
        if (list.length > 0) {
          const names = Array.from(new Set(list.map((d: any) => d.name).filter(Boolean)));
          setDepartmentsList(names as string[]);
        }
      })
      .catch(() => {});

    api<{ results: { code: string; name: string }[] } | { code: string; name: string }[]>("/portal/roles/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res as any)?.results || [];
        if (list.length > 0) {
          const roles = list.map((r: any) => ({ value: r.code, label: r.name }));
          setDynamicRolesList(roles);
        }
      })
      .catch(() => {});
  }, []);

  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [documentsModalOpen, setDocumentsModalOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);


  const currentUser = getCachedAuthUser();
  const canManageEmployees =
    role === "admin" ||
    role === "hr" ||
    currentUser?.role === "SUPER_ADMIN" ||
    currentUser?.role === "ADMIN" ||
    currentUser?.role === "HR" ||
    currentUser?.role === "OPERATIONS" ||
    currentUser?.role === "OPERATIONS_HEAD" ||
    Boolean((currentUser as any)?.isSuperuser);

  const isSelf = Boolean(
    selectedEmployee &&
      currentUser &&
      (currentUser.employee?.id === selectedEmployee.id ||
        (currentUser.email && selectedEmployee.email && currentUser.email.toLowerCase() === selectedEmployee.email.toLowerCase()))
  );

  const loadEmployees = () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    if (search.trim()) params.set("search", search.trim());
    if (department !== "All") params.set("department", department);
    const queryString = params.toString() ? `?${params.toString()}` : "";

    api<Paginated<Employee> | Employee[]>(`/employees/${queryString}`)
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
        setError(err instanceof Error ? err.message : "Could not load employees.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadEmployees(); }, [page, search, department]);

  const confirmDelete = async () => {
    if (!selectedEmployee || isSelf) return;
    setIsDeleting(true);
    setDeleteError("");
    try {
      await api(`/employees/${selectedEmployee.id}/`, { method: "DELETE" });
      setDeleteModalOpen(false);
      setSelectedEmployee(null);
      loadEmployees();
    } catch (err) {
      if (err instanceof ApiError) {
        setDeleteError(err.message || err.fields?.detail || "Could not delete employee.");
      } else {
        setDeleteError("Could not delete employee record.");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const shown = items || [];

  return (
    <>
      <PageHeader
        eyebrow="PEOPLE / DIRECTORY"
        title="Your people."
        subtitle="A clear view of everyone building FLUMENX."
        action={
          canManageEmployees ? (
            <Link className="primary-button" href={`${employeeBasePath}/create`}>
              Add employee <UserPlus size={17} />
            </Link>
          ) : undefined
        }
      />

  <div className="toolbar">
    <div className="search-box">
      <Search size={18} />

      <input
        placeholder="Search name, email or ID..."
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(1); }}
      />
    </div>

    <select
      value={department}
      onChange={e => { setDepartment(e.target.value); setPage(1); }}
    >
      <option>All</option>

      {departmentsList.map(departmentName => (
        <option key={departmentName}>
          {departmentName}
        </option>
      ))}
    </select>

    <div className="record-count">
      {count} PEOPLE
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
              <Avatar name={e.name} avatar={e.avatar} size={36} />

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
              {e.joining_date && !isNaN(new Date(e.joining_date).getTime())
                ? new Date(e.joining_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                : "N/A"}
            </span>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-start" }}>
              <Badge tone={e.status}>
                {e.status}
              </Badge>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "2px 6px",
                  borderRadius: "4px",
                  backgroundColor: (e.employment_status || "Probation") === "Permanent" ? "#EFF6FF" : "#FEF3C7",
                  color: (e.employment_status || "Probation") === "Permanent" ? "#1E40AF" : "#92400E",
                  whiteSpace: "nowrap",
                }}
              >
                {e.employment_status || "Probation"}
              </span>
            </div>

            <div className="row-actions">
              <Link
                href={`${employeeBasePath}/${e.id}`}
                title="View 360° Profile & Details"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "32px",
                  height: "32px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  backgroundColor: "#F8FAFC",
                  color: "#334155",
                  textDecoration: "none",
                }}
              >
                <Eye size={16} />
              </Link>

              <Link
                href={`/chat?emp=${e.id}`}
                title={`Start Chat with ${e.name}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "32px",
                  height: "32px",
                  borderRadius: "6px",
                  border: "1px solid #B2D8CB",
                  backgroundColor: "#E7F3EE",
                  color: "#087A5B",
                  textDecoration: "none",
                }}
              >
                <MessageSquare size={15} />
              </Link>

              {e.phone ? (
                <a
                  href={`tel:${e.phone}`}
                  title={`Call ${e.name} (${e.phone})`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "32px",
                    height: "32px",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    backgroundColor: "#F8FAFC",
                    color: "#087A5B",
                    textDecoration: "none",
                  }}
                >
                  <Phone size={15} />
                </a>
              ) : null}

              <Link
                href={`/chat?emp=${e.id}`}
                title={`Video Call ${e.name}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "32px",
                  height: "32px",
                  borderRadius: "6px",
                  border: "1px solid #BFDBFE",
                  backgroundColor: "#EFF6FF",
                  color: "#2563EB",
                  textDecoration: "none",
                }}
              >
                <Video size={15} />
              </Link>

              {canManageEmployees && (
                <>
                  <button
                    type="button"
                    title="Employee documents"
                    onClick={(evt) => {
                      evt.stopPropagation();
                      setSelectedEmployee(e);
                      setDocumentsModalOpen(true);
                    }}
                  >
                    <FileText size={16} />
                  </button>

                  <button
                    type="button"
                    title="Edit employee"
                    onClick={(evt) => {
                      evt.stopPropagation();
                      setSelectedEmployee(e);
                      setEditModalOpen(true);
                    }}
                  >
                    <Pencil size={16} />
                  </button>

                  <button
                    type="button"
                    title="Delete employee"
                    onClick={(evt) => {
                      evt.stopPropagation();
                      setSelectedEmployee(e);
                      setDeleteError("");
                      setDeleteModalOpen(true);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
    </div>

    <EmployeeDocumentsModal
      isOpen={documentsModalOpen}
      onClose={() => setDocumentsModalOpen(false)}
      employee={selectedEmployee}
    />


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

  {editModalOpen && selectedEmployee && (
    <Modal title={`Edit ${selectedEmployee.name}`} onClose={() => { setEditModalOpen(false); setSelectedEmployee(null); }}>
      <EmployeeForm
        employee={selectedEmployee}
        role={role}
        onSuccess={() => {
          setEditModalOpen(false);
          setSelectedEmployee(null);
          loadEmployees();
        }}
        onCancel={() => {
          setEditModalOpen(false);
          setSelectedEmployee(null);
        }}
      />
    </Modal>
  )}

  {deleteModalOpen && selectedEmployee && (
    <Modal
      title="Delete Employee Record"
      onClose={() => {
        if (!isDeleting) {
          setDeleteModalOpen(false);
          setSelectedEmployee(null);
          setDeleteError("");
        }
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.5" }}>
          Are you sure you want to delete <strong>{selectedEmployee.name}</strong> ({selectedEmployee.employee_code})?
        </p>
        <p style={{ margin: 0, fontSize: "12px", color: "var(--muted, #888)" }}>
          This will remove their employee directory profile and portal user account.
        </p>

        {isSelf && (
          <div
            className="toast error"
            style={{
              background: "rgba(255,107,107,0.15)",
              border: "1px solid rgba(255,107,107,0.3)",
              color: "#FF6B6B",
              padding: "12px 16px",
              borderRadius: "var(--r-sm, 6px)",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            ⚠️ You cannot delete your own logged-in employee profile.
          </div>
        )}

        {deleteError && (
          <div
            className="toast error"
            style={{
              background: "rgba(255,107,107,0.15)",
              border: "1px solid rgba(255,107,107,0.3)",
              color: "#FF6B6B",
              padding: "12px 16px",
              borderRadius: "var(--r-sm, 6px)",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            ⚠️ {deleteError}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "12px" }}>
          <button
            type="button"
            className="secondary-button"
            disabled={isDeleting}
            onClick={() => {
              setDeleteModalOpen(false);
              setSelectedEmployee(null);
              setDeleteError("");
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            style={{ background: "#FF6B6B", borderColor: "#FF6B6B", color: "#FFFFFF" }}
            disabled={isDeleting || isSelf}
            onClick={confirmDelete}
          >
            {isDeleting ? "Deleting..." : "Confirm Delete"}
          </button>
        </div>
      </div>
    </Modal>
  )}
    </>
  );
}
export function EmployeeForm({
  employee,
  employeeId,
  role,
  onSuccess,
  onCancel,
}: {
  employee?: Employee;
  employeeId?: number;
  role?: EmployeeWorkspaceRole;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const employeeBasePath = role ? `/${role}/employees` : `/employees`;
  const [saved, setSaved] = useState(false);
  const [loadedEmployee, setLoadedEmployee] = useState<Employee | undefined>(employee);
  const [loading, setLoading] = useState(Boolean(employeeId && !employee));
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!employeeId || employee) return;
    setLoading(true);
    setLoadError("");
    api<Employee>(`/employees/${employeeId}/`)
      .then(setLoadedEmployee)
      .catch(err => setLoadError(err instanceof Error ? err.message : "Could not load employee."))
      .finally(() => setLoading(false));
  }, [employeeId, employee]);

  const [formDepartments, setFormDepartments] = useState<string[]>(DEPARTMENT_OPTIONS);
  const [formRoles, setFormRoles] = useState<{ value: string; label: string }[]>(DEFAULT_ROLE_ITEMS);

  useEffect(() => {
    api<{ results: { name: string }[] } | { name: string }[]>("/departments/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res as any)?.results || [];
        if (list.length > 0) {
          setFormDepartments(Array.from(new Set(list.map((d: any) => d.name).filter(Boolean))) as string[]);
        }
      })
      .catch(() => {});

    api<{ results: { code: string; name: string }[] } | { code: string; name: string }[]>("/portal/roles/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res as any)?.results || [];
        if (list.length > 0) {
          setFormRoles(list.map((r: any) => ({ value: r.code, label: r.name })));
        }
      })
      .catch(() => {});
  }, []);

  const currentEmployee = loadedEmployee;
  const roleOptions = formRoles;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    const data = new FormData(e.currentTarget);
    const body = {
      employee_code: data.get("employee_code"), name: data.get("name"), email: data.get("email"),
      phone: data.get("phone"), department: data.get("department"), portal_role: data.get("portal_role"), designation: data.get("designation"),
      joining_date: data.get("joining_date"), status: data.get("status"),
      employment_status: data.get("employment_status"),
      probation_end_date: data.get("probation_end_date") || null,
      confirmation_date: data.get("confirmation_date") || null,
      location: data.get("location"),
      ...(!currentEmployee ? { password: data.get("password") } : {}),
    };
    try {
      await api(currentEmployee ? `/employees/${currentEmployee.id}/` : "/employees/", {
        method: currentEmployee ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      setSaved(true);
      if (onSuccess) {
        onSuccess();
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
        setTimeout(() => router.push(employeeBasePath), 500);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fields);
        const firstError = err.fields.email || err.fields.employee_code || err.fields.detail || err.message;
        setError(firstError);
      } else {
        setError("Employee record could not be saved.");
      }
      if (!onSuccess) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  }

  if (loading) return <EmptyState title="Loading employee" text="Fetching the employee record." />;
  if (loadError) return <EmptyState title="Could not load employee" text={loadError} />;

  return <>
    <PageHeader eyebrow="PEOPLE / RECORD" title={currentEmployee ? "Employee profile." : "Add someone new."} subtitle={currentEmployee ? "Review and update this employee record." : "Create their FLUMENX identity and workspace access."} />
    {saved && <div className="toast success"><Check size={18} /> Employee record saved successfully.</div>}
    {error && (
      <div className="toast error" style={{ background: "rgba(255,107,107,0.15)", border: "1px solid rgba(255,107,107,0.3)", color: "#FF6B6B", padding: "12px 16px", borderRadius: "var(--r-sm)", marginBottom: "16px", fontSize: "12px", fontWeight: 600 }}>
        ⚠️ {error}
      </div>
    )}
    <form className="editor-card" onSubmit={submit}>
      <div className="editor-intro"><span>01</span><div><h2>Core information</h2><p>The details used across the employee directory.</p></div></div>
      <div className="form-grid">
        <label>
          Employee code
          <input name="employee_code" defaultValue={currentEmployee?.employee_code || ""} required />
          {fieldErrors.employee_code && <small style={{ color: "#FF6B6B", display: "block", marginTop: "4px", fontSize: "11px", fontWeight: 600 }}>{fieldErrors.employee_code}</small>}
        </label>
        <label>
          Full name
          <input name="name" defaultValue={currentEmployee?.name} placeholder="Employee full name" required />
          {fieldErrors.name && <small style={{ color: "#FF6B6B", display: "block", marginTop: "4px", fontSize: "11px", fontWeight: 600 }}>{fieldErrors.name}</small>}
        </label>
        <label>
          Work email
          <input name="email" defaultValue={currentEmployee?.email} type="email" placeholder="name@flumenx.local" required />
          {fieldErrors.email && <small style={{ color: "#FF6B6B", display: "block", marginTop: "4px", fontSize: "11px", fontWeight: 600 }}>{fieldErrors.email}</small>}
        </label>
        <label>
          Phone number
          <input name="phone" defaultValue={currentEmployee?.phone} placeholder="+91" required />
          {fieldErrors.phone && <small style={{ color: "#FF6B6B", display: "block", marginTop: "4px", fontSize: "11px", fontWeight: 600 }}>{fieldErrors.phone}</small>}
        </label>
        <label>
          Department
          <select name="department" defaultValue={currentEmployee?.department || ""} required>
            <option value="" disabled>Select department</option>
            {formDepartments.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
          {fieldErrors.department && <small style={{ color: "#FF6B6B", display: "block", marginTop: "4px", fontSize: "11px", fontWeight: 600 }}>{fieldErrors.department}</small>}
        </label>
        <label>
          Portal role
          <select name="portal_role" defaultValue={roleOptions.some(option => option.value === currentEmployee?.portal_role) ? currentEmployee?.portal_role : roleOptions[0].value} required>
            {roleOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          {fieldErrors.portal_role && <small style={{ color: "#FF6B6B", display: "block", marginTop: "4px", fontSize: "11px", fontWeight: 600 }}>{fieldErrors.portal_role}</small>}
        </label>
        <label>
          Designation
          <input name="designation" defaultValue={currentEmployee?.designation} placeholder="Role title" required />
          {fieldErrors.designation && <small style={{ color: "#FF6B6B", display: "block", marginTop: "4px", fontSize: "11px", fontWeight: 600 }}>{fieldErrors.designation}</small>}
        </label>
        <label>
          Joining date
          <input name="joining_date" defaultValue={currentEmployee?.joining_date} type="date" required />
          {fieldErrors.joining_date && <small style={{ color: "#FF6B6B", display: "block", marginTop: "4px", fontSize: "11px", fontWeight: 600 }}>{fieldErrors.joining_date}</small>}
        </label>
        <label>
          Employment Status
          <select name="employment_status" defaultValue={currentEmployee?.employment_status || "Probation"}>
            <option value="Probation">Probation</option>
            <option value="Permanent">Permanent (Confirmed)</option>
            <option value="Contract">Contract</option>
            <option value="Intern">Intern</option>
          </select>
          {fieldErrors.employment_status && <small style={{ color: "#FF6B6B", display: "block", marginTop: "4px", fontSize: "11px", fontWeight: 600 }}>{fieldErrors.employment_status}</small>}
        </label>
        <label>
          Probation End Date
          <input name="probation_end_date" defaultValue={currentEmployee?.probation_end_date || ""} type="date" />
          <small style={{ color: "var(--muted)", display: "block", marginTop: "2px", fontSize: "10px" }}>Leave empty for default 90 days</small>
        </label>
        <label>
          Confirmation Date
          <input name="confirmation_date" defaultValue={currentEmployee?.confirmation_date || ""} type="date" />
          <small style={{ color: "var(--muted)", display: "block", marginTop: "2px", fontSize: "10px" }}>Set when graduate from probation</small>
        </label>
        <label>
          Account Status
          <select name="status" defaultValue={currentEmployee?.status || "Active"}>
            <option>Active</option>
            <option>On Leave</option>
            <option>Inactive</option>
          </select>
          {fieldErrors.status && <small style={{ color: "#FF6B6B", display: "block", marginTop: "4px", fontSize: "11px", fontWeight: 600 }}>{fieldErrors.status}</small>}
        </label>
        <label>
          Location
          <input name="location" defaultValue={currentEmployee?.location} placeholder="City" />
          {fieldErrors.location && <small style={{ color: "#FF6B6B", display: "block", marginTop: "4px", fontSize: "11px", fontWeight: 600 }}>{fieldErrors.location}</small>}
        </label>
        {!currentEmployee && (
          <label>
            Temporary password
            <input name="password" type="text" required />
            {fieldErrors.password && <small style={{ color: "#FF6B6B", display: "block", marginTop: "4px", fontSize: "11px", fontWeight: 600 }}>{fieldErrors.password}</small>}
          </label>
        )}
      </div>
      <div className="form-actions">
        {onCancel ? (
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
        ) : (
          <Link href={employeeBasePath}>Cancel</Link>
        )}
        <PrimaryButton type="submit">{currentEmployee ? "Save changes" : "Create employee"}</PrimaryButton>
      </div>
    </form>
  </>;
}
