"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Modal } from "@/features/common/Modal";
import { PrimaryButton } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { DepartmentItem, DynamicRole, SuperAdminUser } from "@/lib/types";

type Props = {
  user?: SuperAdminUser | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function UserFormModal({ user, open, onClose, onSuccess }: Props) {
  const isEdit = Boolean(user);
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [workEmail, setWorkEmail] = useState(user?.work_email || "");
  const [password, setPassword] = useState("");
  const [designation, setDesignation] = useState(user?.designation || "");
  const [departmentId, setDepartmentId] = useState<number | "">(user?.department_id || "");
  const [departmentStr, setDepartmentStr] = useState(user?.department || "");
  const [dynamicRoleId, setDynamicRoleId] = useState<number | "">(user?.dynamic_role?.id || "");
  const [statusVal, setStatusVal] = useState<"Active" | "On Leave" | "Inactive">(user?.status || "Active");

  const [roles, setRoles] = useState<DynamicRole[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [deptsLoading, setDeptsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const departmentOptions = useMemo(() => {
    return (departments || []).map((d) => ({
      id: d.id,
      name: d.name,
    }));
  }, [departments]);

  useEffect(() => {
    const handleRolesRefresh = () => {
      api<DynamicRole[] | { results: DynamicRole[] }>("/portal/roles/")
        .then((res) => {
          const list = Array.isArray(res) ? res : res?.results || [];
          setRoles(list);
        })
        .catch(() => {});
    };
    window.addEventListener("flumenx:roles_refresh", handleRolesRefresh);
    return () => {
      window.removeEventListener("flumenx:roles_refresh", handleRolesRefresh);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    setError("");
    setFieldErrors({});

    setFullName(user?.full_name || "");
    setWorkEmail(user?.work_email || "");
    setPassword("");
    setDesignation(user?.designation || "");
    setDepartmentStr(user?.department || "");
    setDepartmentId(user?.department_id || "");
    setStatusVal(user?.status || "Active");

    setRolesLoading(true);
    setDeptsLoading(true);

    api<DynamicRole[] | { results: DynamicRole[] }>("/portal/roles/")
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.results || [];
        setRoles(list);

        let selId: number | "" = "";

        if (isEdit && user) {
          if (user.dynamic_role?.id) {
            selId = user.dynamic_role.id;
          } else if (user.legacy_portal_role) {
            const match = list.find(
              (r) => r.code.toUpperCase() === user.legacy_portal_role.toUpperCase()
            );
            if (match) selId = match.id;
          }
        }

        if (selId === "" && list.length > 0) {
          selId = list[0].id;
        }

        setDynamicRoleId(selId);
      })
      .catch(() => setRoles([]))
      .finally(() => setRolesLoading(false));

    api<DepartmentItem[] | { results: DepartmentItem[] }>("/portal/departments/")
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.results || [];
        setDepartments(list);

        let initialDeptId: number | "" = user?.department_id || "";
        let initialDeptName = user?.department || "";

        if (!initialDeptId && initialDeptName) {
          const match = list.find((d) => d.name.toLowerCase() === initialDeptName.toLowerCase());
          if (match) {
            initialDeptId = match.id;
            initialDeptName = match.name;
          }
        }

        if (initialDeptId === "" && !initialDeptName && list.length > 0) {
          initialDeptId = list[0].id;
          initialDeptName = list[0].name;
        }

        setDepartmentId(initialDeptId);
        setDepartmentStr(initialDeptName);
      })
      .catch(() => setDepartments([]))
      .finally(() => setDeptsLoading(false));
  }, [open, isEdit, user]);

  if (!open) return null;

  async function handleDeleteUser() {
    if (!user) return;
    if (!window.confirm(`Are you sure you want to delete / deactivate user account "${user.full_name}"?`)) {
      return;
    }
    setDeleteLoading(true);
    setError("");
    try {
      await api(`/portal/super-admin/users/${user.user_id}/`, { method: "DELETE" });
      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Failed to delete user.");
      } else {
        setError(err instanceof Error ? err.message : "An error occurred while deleting user.");
      }
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setLoading(true);

    try {
      const selectedDept = departments.find((d) => d.id === Number(departmentId));
      const targetDeptStr = selectedDept ? selectedDept.name : departmentStr || "Web Development";

      if (!isEdit) {
        const errors: Record<string, string> = {};
        if (!fullName.trim()) {
          errors.full_name = "Full name is required.";
        }
        if (!workEmail.trim()) {
          errors.work_email = "Work email is required.";
        }
        if (!password || password.length < 8) {
          errors.initial_password = "Initial password must be at least 8 characters long.";
        }
        if (!dynamicRoleId || Number.isNaN(Number(dynamicRoleId))) {
          errors.dynamic_role_id = "Please select an assigned role.";
        }
        if (Object.keys(errors).length > 0) {
          setFieldErrors(errors);
          setError(Object.values(errors).join(" | "));
          setLoading(false);
          return;
        }
      }

      if (isEdit && user) {
        const updatePayload: Record<string, any> = {
          full_name: fullName.trim(),
          designation: designation.trim(),
          department: targetDeptStr,
          status: statusVal,
        };
        if (departmentId !== "") {
          updatePayload.department_id = Number(departmentId);
        }
        if (dynamicRoleId !== "") {
          updatePayload.dynamic_role_id = Number(dynamicRoleId);
        }
        await api<SuperAdminUser>(`/portal/super-admin/users/${user.user_id}/`, {
          method: "PATCH",
          body: JSON.stringify(updatePayload),
        });
      } else {
        const createPayload: Record<string, any> = {
          full_name: fullName.trim(),
          work_email: workEmail.trim().toLowerCase(),
          initial_password: password,
          designation: designation.trim() || "Employee",
          department: targetDeptStr,
          dynamic_role_id: Number(dynamicRoleId),
        };
        if (departmentId !== "") {
          createPayload.department_id = Number(departmentId);
        }
        await api<SuperAdminUser>("/portal/super-admin/users/", {
          method: "POST",
          body: JSON.stringify(createPayload),
        });
      }
      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        const fields = err.fields || {};
        setFieldErrors(fields);
        const detailMsg = Object.values(fields).length > 0 ? Object.values(fields).join(" | ") : err.message;
        setError(detailMsg || "Failed to save user.");
      } else {
        setError(err instanceof Error ? err.message : "An error occurred.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={isEdit ? "Edit Team Member Account" : "Add New Team User"} onClose={() => !loading && !deleteLoading && onClose()}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px", maxHeight: "75vh", overflowY: "auto", paddingRight: "4px" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
          FULL NAME
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Rahul K"
            required
            className="fi"
          />
          {fieldErrors.full_name && <small style={{ color: "#EF4444" }}>{fieldErrors.full_name}</small>}
        </label>

        {!isEdit && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
              WORK EMAIL ADDRESS
              <input
                type="email"
                value={workEmail}
                onChange={(e) => setWorkEmail(e.target.value)}
                placeholder="rahul@flumenx.com"
                required
                className="fi"
              />
              {(fieldErrors.work_email || fieldErrors.email) && (
                <small style={{ color: "#EF4444" }}>{fieldErrors.work_email || fieldErrors.email}</small>
              )}
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
              INITIAL PASSWORD
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                minLength={8}
                className="fi"
              />
              {fieldErrors.initial_password && <small style={{ color: "#EF4444" }}>{fieldErrors.initial_password}</small>}
            </label>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
            FUNCTION / DESIGNATION
            <input
              type="text"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="e.g. Lead Graphic Designer"
              required
              className="fi"
            />
            {fieldErrors.designation && <small style={{ color: "#EF4444" }}>{fieldErrors.designation}</small>}
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
            ASSIGNED TEAM / UNIT
            <select
              value={departmentId || ""}
              onChange={(e) => {
                const idVal = Number(e.target.value);
                setDepartmentId(idVal);
                const foundDept = departmentOptions.find((d) => d.id === idVal);
                if (foundDept) {
                  setDepartmentStr(foundDept.name);
                }
              }}
              disabled={deptsLoading}
              required
              className="fs"
            >
              <option value="" disabled>
                {deptsLoading ? "Loading departments..." : "Select Assigned Team / Unit"}
              </option>
              {departmentOptions.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
            {fieldErrors.department && <small style={{ color: "#EF4444" }}>{fieldErrors.department}</small>}
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
            ASSIGNED ROLE (ROLE ID SELECTION)
            <select
              value={dynamicRoleId}
              onChange={(e) => setDynamicRoleId(Number(e.target.value))}
              disabled={rolesLoading}
              required
              className="fs"
            >
              <option value="" disabled>
                {rolesLoading ? "Loading dynamic roles..." : "Select Assigned Role"}
              </option>
              {(roles || []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.code})
                </option>
              ))}
            </select>
            {fieldErrors.dynamic_role_id && <small style={{ color: "#EF4444" }}>{fieldErrors.dynamic_role_id}</small>}
          </label>
        </div>

        {isEdit && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
              ACCOUNT STATUS
              <select
                value={statusVal}
                onChange={(e) => setStatusVal(e.target.value as any)}
                className="fs"
              >
                <option value="Active">Active</option>
                <option value="On Leave">On Leave</option>
                <option value="Inactive">Inactive</option>
              </select>
            </label>
          </div>
        )}

        {error && <div className="toast error">{error}</div>}

        <div style={{ display: "flex", justifyContent: isEdit ? "space-between" : "flex-end", alignItems: "center", gap: "10px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
          {isEdit && user && (
            <button
              type="button"
              onClick={handleDeleteUser}
              disabled={loading || deleteLoading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "8px",
                background: "rgba(239, 68, 68, 0.12)",
                color: "#EF4444",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <Trash2 size={14} />
              {deleteLoading ? "Deleting..." : "Delete User"}
            </button>
          )}
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button type="button" className="secondary-button" onClick={onClose} disabled={loading || deleteLoading}>
              Cancel
            </button>
            <PrimaryButton type="submit" disabled={loading || deleteLoading}>
              {loading ? "Saving..." : isEdit ? "Save Changes" : "Create User Account"}
            </PrimaryButton>
          </div>
        </div>
      </form>
    </Modal>
  );
}
