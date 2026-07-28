"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, Pencil, Search, Trash2, UserPlus } from "lucide-react";
import { Department, Employee, Paginated, PortalRole } from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import { Avatar } from "@/components/icons";
import { Badge, EmptyState, PageHeader, PrimaryButton } from "@/components/ui";

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

export function EmployeesPage({ role = "admin" }: { role?: EmployeeWorkspaceRole }) {
  const employeeBasePath = `/${role}/employees`;
  const [items, setItems] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  async function removeEmployee(id: number) {
    try {
      await api(`/employees/${id}/`, { method: "DELETE" });
      setItems(items.filter(x => x.id !== id));
    } catch {}
  }


  const shown = useMemo(() => items.filter(e => (department === "All" || e.department === department) && `${e.name} ${e.email} ${e.employee_code}`.toLowerCase().includes(search.toLowerCase())), [items, search, department]);

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
