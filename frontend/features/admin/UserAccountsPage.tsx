"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Pencil, Key, UserCheck, UserX, Trash2 } from "lucide-react";
import { useShellUser } from "@/components/shell";
import { EmptyState, PageHeader, PrimaryButton } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { DynamicRole, SuperAdminUser } from "@/lib/types";
import { UserFormModal } from "./UserFormModal";
import { UserPasswordModal } from "./UserPasswordModal";

export function UserAccountsPage() {
  const router = useRouter();
  const user = useShellUser();

  const [usersList, setUsersList] = useState<SuperAdminUser[]>([]);
  const [roles, setRoles] = useState<DynamicRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SuperAdminUser | null>(null);

  const [passModalOpen, setPassModalOpen] = useState(false);
  const [passTargetUser, setPassTargetUser] = useState<SuperAdminUser | null>(null);

  const [actionError, setActionError] = useState("");

  // Route Guard: Super Admin Only
  useEffect(() => {
    if (!user) return;
    const isSuperAdmin = user.portal_role === "SUPER_ADMIN" || user.role === "SUPER_ADMIN";
    if (!isSuperAdmin) {
      router.replace("/admin/dashboard");
    }
  }, [user, router]);

  const loadData = () => {
    setLoading(true);
    setError("");
    Promise.all([
      api<SuperAdminUser[] | { results: SuperAdminUser[] }>("/portal/super-admin/users/"),
      api<DynamicRole[] | { results: DynamicRole[] }>("/portal/roles/"),
    ])
      .then(([uData, rData]) => {
        setUsersList(Array.isArray(uData) ? uData : uData?.results || []);
        setRoles(Array.isArray(rData) ? rData : rData?.results || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load user accounts."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return usersList.filter((u) => {
      const matchesSearch =
        !q ||
        u.full_name.toLowerCase().includes(q) ||
        u.work_email.toLowerCase().includes(q) ||
        u.designation.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q);

      const matchesRole =
        roleFilter === "ALL" ||
        (u.dynamic_role && u.dynamic_role.code === roleFilter) ||
        (!u.dynamic_role && u.legacy_portal_role === roleFilter);

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "Active" && u.is_active) ||
        (statusFilter === "Inactive" && !u.is_active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [usersList, search, roleFilter, statusFilter]);

  async function handleDeactivate(targetUser: SuperAdminUser) {
    if (!confirm(`Are you sure you want to deactivate user account "${targetUser.full_name}"?`)) return;
    setActionError("");
    try {
      await api(`/portal/super-admin/users/${targetUser.user_id}/`, { method: "DELETE" });
      loadData();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not deactivate user.");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <PageHeader
        title="User Accounts & Access"
        subtitle="Manage employee credentials, assign dynamic system roles, and trigger password resets"
        action={
          <PrimaryButton
            onClick={() => {
              setEditingUser(null);
              setUserModalOpen(true);
            }}
          >
            <Plus size={16} /> Add User Account
          </PrimaryButton>
        }
      />

      {actionError && <div className="toast error">{actionError}</div>}

      <div className="panel" style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", flex: 1 }}>
            <div style={{ position: "relative", minWidth: "240px", flex: 1 }}>
              <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, designation..."
                className="fi"
                style={{ paddingLeft: "36px" }}
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="fs"
              style={{ width: "auto", minWidth: "160px" }}
            >
              <option value="ALL">All System Roles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.code}>
                  {r.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="fs"
              style={{ width: "auto", minWidth: "140px" }}
            >
              <option value="ALL">All Status</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive Only</option>
            </select>
          </div>

          <span style={{ fontSize: "12px", color: "var(--muted)" }}>
            Showing {filteredUsers.length} of {usersList.length} users
          </span>
        </div>

        {loading && <EmptyState title="Loading user accounts" text="Fetching team profiles and assigned credentials." />}
        {error && <EmptyState title="Could not load user accounts" text={error} />}

        {!loading && !error && !filteredUsers.length && (
          <EmptyState title="No user accounts found" text="Try clearing search filters or add a new team member." />
        )}

        {!loading && !error && Boolean(filteredUsers.length) && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--muted)", fontSize: "11px", fontWeight: 700 }}>
                  <th style={{ padding: "12px" }}>MEMBER</th>
                  <th style={{ padding: "12px" }}>WORK EMAIL</th>
                  <th style={{ padding: "12px" }}>DESIGNATION</th>
                  <th style={{ padding: "12px" }}>DEPARTMENT</th>
                  <th style={{ padding: "12px" }}>ASSIGNED ROLE</th>
                  <th style={{ padding: "12px" }}>STATUS</th>
                  <th style={{ padding: "12px", textAlign: "right" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((item) => (
                  <tr key={item.user_id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "rgba(77,255,160,0.15)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "11.5px" }}>
                          {item.full_name ? item.full_name.charAt(0).toUpperCase() : "U"}
                        </div>
                        <b style={{ color: "#F3F4F6", fontSize: "13px" }}>{item.full_name}</b>
                      </div>
                    </td>
                    <td style={{ padding: "12px", fontFamily: "monospace", color: "var(--muted)" }}>{item.work_email}</td>
                    <td style={{ padding: "12px", color: "#E2E8F0" }}>{item.designation || "—"}</td>
                    <td style={{ padding: "12px", color: "var(--muted)" }}>{item.department || "—"}</td>
                    <td style={{ padding: "12px" }}>
                      <span style={{ fontSize: "10px", fontWeight: 700, background: "rgba(77,255,160,0.1)", color: "var(--brand)", padding: "3px 8px", borderRadius: "6px" }}>
                        {item.dynamic_role?.name || item.legacy_portal_role}
                      </span>
                    </td>
                    <td style={{ padding: "12px" }}>
                      {item.is_active ? (
                        <span style={{ color: "var(--brand)", fontSize: "11px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <UserCheck size={13} /> ACTIVE
                        </span>
                      ) : (
                        <span style={{ color: "#EF4444", fontSize: "11px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <UserX size={13} /> INACTIVE
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "6px" }}>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => {
                            setEditingUser(item);
                            setUserModalOpen(true);
                          }}
                          style={{ padding: "5px 9px", fontSize: "11px" }}
                          title="Edit User Details"
                        >
                          <Pencil size={13} /> Edit
                        </button>

                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => {
                            setPassTargetUser(item);
                            setPassModalOpen(true);
                          }}
                          style={{ padding: "5px 9px", fontSize: "11px" }}
                          title="Reset Password"
                        >
                          <Key size={13} /> Password
                        </button>

                        {item.is_active && (
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => handleDeactivate(item)}
                            style={{ padding: "5px 9px", fontSize: "11px", color: "#EF4444", borderColor: "rgba(239,68,68,0.3)" }}
                            title="Deactivate Account"
                          >
                            <Trash2 size={13} /> Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <UserFormModal
        user={editingUser}
        open={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        onSuccess={loadData}
      />

      <UserPasswordModal
        user={passTargetUser}
        open={passModalOpen}
        onClose={() => setPassModalOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
}
