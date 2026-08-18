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

  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<DynamicRole | null>(null);

  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentItem | null>(null);

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SuperAdminUser | null>(null);

  const [passModalOpen, setPassModalOpen] = useState(false);
  const [passTargetUser, setPassTargetUser] = useState<SuperAdminUser | null>(null);

  // Route Guard: Super Admin Only
  useEffect(() => {
    if (!user) return;
    const isSuperAdmin = user.portal_role === "SUPER_ADMIN" || user.role === "SUPER_ADMIN";
    if (!isSuperAdmin) {
      router.replace("/admin/dashboard");
    }
  }, [user, router]);

  const loadRoles = () => {
    setLoadingRoles(true);
    api<DynamicRole[] | { results: DynamicRole[] }>("/portal/roles/")
      .then((data) => setRoles(Array.isArray(data) ? data : data?.results || []))
      .catch(() => setRoles([]))
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
      .catch(() => setUsersList([]))
      .finally(() => setLoadingUsers(false));
  };

  useEffect(() => {
    loadRoles();
    loadDepartments();
    loadUsers();
  }, []);

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <PageHeader
        title="Settings & Access"
        subtitle="RBAC, Users & Roles"
      />

      {actionError && <div className="toast error">{actionError}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: "16px", alignItems: "start" }}>
        {/* LEFT COLUMN: DYNAMIC ROLES & PERMISSIONS MATRIX */}
        <div className="panel" style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "16px", background: "#0C2117", border: "1px solid rgba(70, 150, 105, 0.22)", borderRadius: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <b style={{ fontSize: "15px", fontWeight: 700, color: "#F2F6F3", display: "flex", alignItems: "center", gap: "8px" }}>
                Dynamic Roles & Permissions Matrix
              </b>
              <p style={{ fontSize: "11.5px", color: "#9CB8A8", margin: "2px 0 0 0" }}>Edit permissions granted to each role</p>
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
                  <tr style={{ borderBottom: "1px solid rgba(70, 150, 105, 0.22)", color: "#5F8872", fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.08em" }}>
                    <th style={{ padding: "8px 10px 8px 0" }}>ROLE</th>
                    <th style={{ padding: "8px 10px" }}>ASSIGNED MEMBERS</th>
                    <th style={{ padding: "8px 10px" }}>PERMISSIONS</th>
                    <th style={{ padding: "8px 0 8px 10px", textAlign: "right" }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((r) => {
                    const assignedMembers = usersList.filter((u) => {
                      if (u.dynamic_role?.id === r.id) return true;
                      if (u.dynamic_role?.code && u.dynamic_role.code.toUpperCase() === r.code.toUpperCase()) return true;
                      if (u.legacy_portal_role && u.legacy_portal_role.toUpperCase() === r.code.toUpperCase()) return true;
                      if (u.department && u.department.trim().toLowerCase() === r.code.trim().toLowerCase()) return true;
                      if (u.department && u.department.trim().toLowerCase() === r.name.trim().toLowerCase()) return true;
                      return false;
                    });
                    return (
                      <tr key={r.id} style={{ borderBottom: "1px solid rgba(70, 150, 105, 0.12)" }}>
                        <td style={{ padding: "10px 10px 10px 0", verticalAlign: "top" }}>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <b style={{ fontSize: "13px", fontWeight: 600, color: "#F2F6F3" }}>{r.name}</b>
                            <small style={{ fontSize: "10px", color: "#5F8872", fontFamily: "monospace" }}>{r.code.toLowerCase()}</small>
                          </div>
                        </td>
                        <td style={{ padding: "10px 10px", verticalAlign: "top" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                            {assignedMembers.length > 0 ? (
                              assignedMembers.map((m) => (
                                <span
                                  key={m.user_id}
                                  style={{
                                    fontSize: "9.5px",
                                    fontWeight: 700,
                                    letterSpacing: "0.04em",
                                    background: "#063D28",
                                    color: "#00E889",
                                    border: "1px solid rgba(0, 232, 137, 0.25)",
                                    padding: "2px 7px",
                                    borderRadius: "4px",
                                    textTransform: "uppercase",
                                  }}
                                >
                                  {m.full_name}
                                </span>
                              ))
                            ) : (
                              <span style={{ fontSize: "11px", color: "#5F8872" }}>None</span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "10px 10px", verticalAlign: "top" }}>
                          {r.is_superadmin_wildcard || r.code === "SUPER_ADMIN" ? (
                            <span style={{ fontSize: "11px", color: "#00E889", fontWeight: 600 }}>
                              ★ Full access (* wildcards)
                            </span>
                          ) : (
                            <span style={{ fontSize: "11px", color: "#9CB8A8" }}>
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
        <div className="panel" style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "16px", background: "#0C2117", border: "1px solid rgba(70, 150, 105, 0.22)", borderRadius: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <b style={{ fontSize: "15px", fontWeight: 700, color: "#F2F6F3", display: "flex", alignItems: "center", gap: "8px" }}>
                User Accounts & Access
              </b>
              <p style={{ fontSize: "11.5px", color: "#9CB8A8", margin: "2px 0 0 0" }}>Manage user roles & passwords</p>
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
                  <tr style={{ borderBottom: "1px solid rgba(70, 150, 105, 0.22)", color: "#5F8872", fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.08em" }}>
                    <th style={{ padding: "8px 10px 8px 0" }}>MEMBER</th>
                    <th style={{ padding: "8px 10px" }}>ROLE</th>
                    <th style={{ padding: "8px 10px" }}>CAP</th>
                    <th style={{ padding: "8px 0 8px 10px", textAlign: "right" }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map((u) => {
                    const roleLabel = (u.dynamic_role?.name || u.legacy_portal_role || "TEAM MEMBER").toUpperCase();
                    const initials = u.full_name ? u.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "U";
                    return (
                      <tr key={u.user_id} style={{ borderBottom: "1px solid rgba(70, 150, 105, 0.12)" }}>
                        <td style={{ padding: "10px 10px 10px 0" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div
                              style={{
                                width: "28px",
                                height: "28px",
                                borderRadius: "50%",
                                background: "#063D28",
                                color: "#00E889",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                                fontSize: "10px",
                                border: "1px solid rgba(0, 232, 137, 0.3)",
                              }}
                            >
                              {initials}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <b style={{ fontSize: "13px", fontWeight: 600, color: "#F2F6F3" }}>{u.full_name}</b>
                              <small style={{ fontSize: "10.5px", color: "#9CB8A8" }}>{u.work_email}</small>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "10px" }}>
                          <span
                            style={{
                              fontSize: "9.5px",
                              fontWeight: 700,
                              letterSpacing: "0.04em",
                              background: "#063D28",
                              color: "#00E889",
                              border: "1px solid rgba(0, 232, 137, 0.25)",
                              padding: "2px 7px",
                              borderRadius: "4px",
                              display: "inline-block",
                            }}
                          >
                            {roleLabel}
                          </span>
                        </td>
                        <td style={{ padding: "10px", color: "#9CB8A8", fontSize: "11.5px" }}>
                          40h
                        </td>
                        <td style={{ padding: "10px 0 10px 10px", textAlign: "right" }}>
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
        onSuccess={loadRoles}
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
