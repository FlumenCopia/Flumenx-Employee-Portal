"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Key, Shield, Users as UsersIcon, ArrowRight, Trash2 } from "lucide-react";
import { useShellUser } from "@/components/shell";
import { EmptyState, PageHeader, PrimaryButton } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { DepartmentItem, DynamicRole, SuperAdminUser } from "@/lib/types";
import { DepartmentFormModal } from "./DepartmentFormModal";
import { RoleFormModal } from "./RoleFormModal";
import { UserFormModal } from "./UserFormModal";
import { UserPasswordModal } from "./UserPasswordModal";

export function SettingsAccessPage() {
  const router = useRouter();
  const user = useShellUser();

  const [roles, setRoles] = useState<DynamicRole[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [usersList, setUsersList] = useState<SuperAdminUser[]>([]);

  const [loadingRoles, setLoadingRoles] = useState(true);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [actionError, setActionError] = useState("");
  const [permissionDenied, setPermissionDenied] = useState(false);

  const isSuperAdmin = Boolean(
    user && (user.portal_role === "SUPER_ADMIN" || user.role === "SUPER_ADMIN")
  );

  const loadRoles = () => {
    setLoadingRoles(true);
    api<DynamicRole[] | { results: DynamicRole[] }>("/portal/roles/")
      .then((data) => setRoles(Array.isArray(data) ? data : data?.results || []))
      .catch((err) => {
        setRoles([]);
        if (err instanceof ApiError && err.status === 403) {
          setPermissionDenied(true);
        }
      })
      .finally(() => setLoadingRoles(false));
  };

  const loadDepartments = () => {
    setLoadingDepts(true);
    api<DepartmentItem[] | { results: DepartmentItem[] }>("/portal/departments/")
      .then((data) => setDepartments(Array.isArray(data) ? data : data?.results || []))
      .catch(() => setDepartments([]))
      .finally(() => setLoadingDepts(false));
  };

  const loadUsers = () => {
    setLoadingUsers(true);
    api<SuperAdminUser[] | { results: SuperAdminUser[] }>("/portal/super-admin/users/")
      .then((data) => setUsersList(Array.isArray(data) ? data : data?.results || []))
      .catch((err) => {
        setUsersList([]);
        if (err instanceof ApiError && err.status === 403) {
          setPermissionDenied(true);
        }
      })
      .finally(() => setLoadingUsers(false));
  };

  useEffect(() => {
    loadRoles();
    loadDepartments();
    loadUsers();
  }, []);

  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<DynamicRole | null>(null);

  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentItem | null>(null);

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SuperAdminUser | null>(null);

  const [passModalOpen, setPassModalOpen] = useState(false);
  const [passTargetUser, setPassTargetUser] = useState<SuperAdminUser | null>(null);

  async function handleDeleteRole(role: DynamicRole) {
    if (!confirm(`Are you sure you want to delete role "${role.name}"?`)) return;
    setActionError("");
    try {
      await api(`/portal/roles/${role.id}/`, { method: "DELETE" });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("flumenx:roles_refresh"));
      }
      loadRoles();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not delete role.");
    }
  }

  async function handleDeleteUser(targetUser: SuperAdminUser) {
    if (targetUser.user_id === user?.id) {
      setActionError("You cannot delete your own logged-in account.");
      return;
    }
    if (!confirm(`Are you sure you want to delete user "${targetUser.full_name || targetUser.work_email}"?`)) return;
    setActionError("");
    try {
      await api(`/portal/super-admin/users/${targetUser.user_id}/`, { method: "DELETE" });
      loadUsers();
      loadRoles();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not delete user account.");
    }
  }

  if (permissionDenied && !loadingRoles && !loadingUsers) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#FF594D" }}>Access Denied</h2>
        <p style={{ fontSize: "13px", color: "var(--muted)", marginTop: "8px" }}>
          You do not have permission to view Settings & Access.
        </p>
        <button
          className="secondary-button"
          onClick={() => router.push("/")}
          style={{ marginTop: "16px" }}
        >
          Return to Workspace
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <PageHeader
        title="Settings & Access"
        subtitle="RBAC, Users & Roles"
      />

      {actionError && <div className="toast error" style={{ background: "rgba(223,125,110,0.15)", border: "1px solid var(--red)", color: "var(--red)", padding: "10px 14px", borderRadius: "6px" }}>{actionError}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: "16px", alignItems: "start" }}>
        {/* LEFT COLUMN: DYNAMIC ROLES & PERMISSIONS MATRIX */}
        <div className="panel" style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "16px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <b style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)", display: "flex", alignItems: "center", gap: "8px" }}>
                Dynamic Roles & Permissions Matrix
              </b>
              <p style={{ fontSize: "11.5px", color: "var(--muted)", margin: "2px 0 0 0" }}>Edit permissions granted to each role</p>
            </div>
            <PrimaryButton
              onClick={() => {
                setEditingRole(null);
                setRoleModalOpen(true);
              }}
            >
              + Add Role
            </PrimaryButton>
          </div>

          {loadingRoles && <EmptyState title="Loading roles" text="Fetching dynamic system roles." />}

          {!loadingRoles && Boolean(roles.length) && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--muted)", fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.08em" }}>
                    <th style={{ padding: "8px 10px 8px 0" }}>ROLE</th>
                    <th style={{ padding: "8px 10px" }}>ASSIGNED MEMBERS</th>
                    <th style={{ padding: "8px 10px" }}>PERMISSIONS</th>
                    <th style={{ padding: "8px 0 8px 10px", textAlign: "right" }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((r, index) => {
                    const assignedMembers = usersList.filter((u) => {
                      if (u.dynamic_role?.id === r.id) return true;
                      if (u.dynamic_role?.code && u.dynamic_role.code.toUpperCase() === r.code.toUpperCase()) return true;
                      if (u.legacy_portal_role && u.legacy_portal_role.toUpperCase() === r.code.toUpperCase()) return true;
                      return false;
                    });
                    return (
                      <tr key={r.id || r.code || index} style={{ borderBottom: "1px solid var(--line)" }}>
                        <td style={{ padding: "10px 10px 10px 0", verticalAlign: "top" }}>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <b style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>{r.name}</b>
                            <small style={{ fontSize: "10px", color: "var(--muted)", fontFamily: "monospace" }}>{r.code.toLowerCase()}</small>
                          </div>
                        </td>
                        <td style={{ padding: "10px 10px", verticalAlign: "top" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                            {assignedMembers.length > 0 ? (
                              assignedMembers.map((m, mIdx) => (
                                <span
                                  key={m.user_id || m.work_email || mIdx}
                                  style={{
                                    fontSize: "9.5px",
                                    fontWeight: 700,
                                    letterSpacing: "0.04em",
                                    background: "rgba(203, 168, 110, 0.12)",
                                    color: "var(--neon)",
                                    border: "1px solid rgba(203, 168, 110, 0.25)",
                                    padding: "2px 7px",
                                    borderRadius: "4px",
                                    textTransform: "uppercase",
                                  }}
                                >
                                  {m.full_name}
                                </span>
                              ))
                            ) : (
                              <span style={{ fontSize: "11px", color: "var(--muted)" }}>None</span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "10px 10px", verticalAlign: "top" }}>
                          {r.is_superadmin_wildcard || r.code === "SUPER_ADMIN" ? (
                            <span style={{ fontSize: "11px", color: "var(--neon)", fontWeight: 600 }}>
                              ★ Full access (* wildcards)
                            </span>
                          ) : (
                            <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                              {r.permissions_count ?? 0} permissions granted
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "10px 0 10px 10px", textAlign: "right", verticalAlign: "top" }}>
                          <div style={{ display: "inline-flex", gap: "5px" }}>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => {
                                setEditingRole(r);
                                setRoleModalOpen(true);
                              }}
                              style={{ padding: "0 10px", height: "30px", fontSize: "11px", borderRadius: "5px" }}
                            >
                              Edit
                            </button>
                            {!r.is_system_role && r.code !== "SUPER_ADMIN" && (
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => handleDeleteRole(r)}
                                style={{ padding: "0 8px", height: "30px", fontSize: "11px", color: "#FF594D", borderColor: "rgba(255,89,77,0.3)", borderRadius: "5px" }}
                                title="Delete Role"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: USER ACCOUNTS & ACCESS */}
        <div className="panel" style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "16px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <b style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)", display: "flex", alignItems: "center", gap: "8px" }}>
                User Accounts & Access
              </b>
              <p style={{ fontSize: "11.5px", color: "var(--muted)", margin: "2px 0 0 0" }}>Manage user roles & passwords</p>
            </div>
            <PrimaryButton
              onClick={() => {
                setEditingUser(null);
                setUserModalOpen(true);
              }}
            >
              + Add User
            </PrimaryButton>
          </div>

          {loadingUsers && <EmptyState title="Loading users" text="Fetching portal user accounts." />}

          {!loadingUsers && Boolean(usersList.length) && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--muted)", fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.08em" }}>
                    <th style={{ padding: "8px 10px 8px 0" }}>MEMBER</th>
                    <th style={{ padding: "8px 10px" }}>ROLE</th>
                    <th style={{ padding: "8px 10px" }}>CAP</th>
                    <th style={{ padding: "8px 0 8px 10px", textAlign: "right" }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map((u) => {
                    const roleLabel = u.dynamic_role?.name || u.legacy_portal_role || "Employee";
                    return (
                      <tr key={u.user_id} style={{ borderBottom: "1px solid var(--line)" }}>
                        <td style={{ padding: "10px 10px 10px 0", verticalAlign: "top" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div
                              style={{
                                width: "30px",
                                height: "30px",
                                borderRadius: "50%",
                                background: "rgba(203, 168, 110, 0.15)",
                                color: "var(--neon)",
                                display: "grid",
                                placeItems: "center",
                                fontWeight: 700,
                                fontSize: "12px",
                                flexShrink: 0,
                              }}
                            >
                              {(u.full_name || u.work_email).charAt(0).toUpperCase()}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <b style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text)" }}>{u.full_name || u.work_email}</b>
                              <small style={{ fontSize: "11px", color: "var(--muted)" }}>{u.work_email}</small>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "10px 10px", verticalAlign: "top" }}>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              letterSpacing: "0.04em",
                              background: "rgba(203, 168, 110, 0.12)",
                              color: "var(--neon)",
                              border: "1px solid rgba(203, 168, 110, 0.22)",
                              padding: "2px 7px",
                              borderRadius: "4px",
                              textTransform: "uppercase",
                            }}
                          >
                            {roleLabel}
                          </span>
                        </td>
                        <td style={{ padding: "10px 10px", verticalAlign: "top", color: "var(--muted)", fontSize: "11.5px" }}>
                          40h
                        </td>
                        <td style={{ padding: "10px 0 10px 10px", textAlign: "right", verticalAlign: "top" }}>
                          <div style={{ display: "inline-flex", gap: "5px" }}>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => {
                                setEditingUser(u);
                                setUserModalOpen(true);
                              }}
                              style={{ padding: "0 10px", height: "30px", fontSize: "11px", borderRadius: "5px" }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => {
                                setPassTargetUser(u);
                                setPassModalOpen(true);
                              }}
                              style={{ padding: "0 8px", height: "30px", fontSize: "11px", borderRadius: "5px" }}
                              title="Reset Password"
                            >
                              <Key size={13} />
                            </button>
                            {u.user_id !== user?.id && (
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => handleDeleteUser(u)}
                                style={{ padding: "0 8px", height: "30px", fontSize: "11px", color: "#FF594D", borderColor: "rgba(255,89,77,0.3)", borderRadius: "5px" }}
                                title="Delete User Account"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <RoleFormModal
        key={editingRole?.id ?? "new"}
        role={editingRole}
        open={roleModalOpen}
        onClose={() => setRoleModalOpen(false)}
        onSuccess={() => {
          loadRoles();
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("flumenx:navigation_refresh"));
          }
        }}
      />

      <UserFormModal
        user={editingUser}
        open={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        onSuccess={loadUsers}
      />

      <UserPasswordModal
        user={passTargetUser}
        open={passModalOpen}
        onClose={() => setPassModalOpen(false)}
        onSuccess={loadUsers}
      />
    </div>
  );
}
