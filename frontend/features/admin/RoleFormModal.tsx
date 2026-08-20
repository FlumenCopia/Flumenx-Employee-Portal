"use client";

import { FormEvent, useEffect, useState } from "react";
import { Modal } from "@/features/common/Modal";
import { PrimaryButton } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { triggerNavigationRefresh } from "@/lib/navigation";
import type { DynamicRole, PortalPage, RolePermissionItem, RolePermissionMatrixResponse } from "@/lib/types";

type Props = {
  role?: DynamicRole | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function RoleFormModal({ role, open, onClose, onSuccess }: Props) {
  const isEdit = Boolean(role);
  const [name, setName] = useState(role?.name || "");
  const [code, setCode] = useState(role?.code || "");
  const [description, setDescription] = useState(role?.description || "");
  const [isSuperadminWildcard, setIsSuperadminWildcard] = useState(role?.is_superadmin_wildcard || false);

  const [matrixItems, setMatrixItems] = useState<RolePermissionItem[]>([]);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;

    setError("");
    setFieldErrors({});

    if (isEdit && role) {
      setName(role.name || "");
      setCode(role.code || "");
      setDescription(role.description || "");
      setIsSuperadminWildcard(Boolean(role.is_superadmin_wildcard));
    } else {
      setName("");
      setCode("");
      setDescription("");
      setIsSuperadminWildcard(false);
    }

    setMatrixLoading(true);

    if (isEdit && role) {
      api<RolePermissionMatrixResponse>(`/portal/roles/${role.id}/permissions/`)
        .then((res) => setMatrixItems(res?.permissions || []))
        .catch(() => setMatrixItems([]))
        .finally(() => setMatrixLoading(false));
    } else {
      api<PortalPage[] | { results: PortalPage[] }>("/portal/pages/")
        .then((pagesRes) => {
          const pages = Array.isArray(pagesRes) ? pagesRes : pagesRes?.results || [];
          const items: RolePermissionItem[] = pages
            .filter((p) => p?.is_active)
            .map((p) => ({
              page_id: p.id,
              page_title: p.title,
              route_path: p.route_path,
              module_code: p.module_code,
              can_view: false,
              can_create: false,
              can_edit: false,
              can_delete: false,
            }));
          setMatrixItems(items);
        })
        .catch(() => setMatrixItems([]))
        .finally(() => setMatrixLoading(false));
    }
  }, [open, isEdit, role]);

  if (!open) return null;

  function togglePermission(pageId: number, key: "can_view" | "can_create" | "can_edit" | "can_delete") {
    setMatrixItems((current) =>
      current.map((item) => {
        if (item.page_id !== pageId) return item;
        const nextVal = !item[key];
        // If enabling create/edit/delete, auto-enable view
        if (nextVal && key !== "can_view") {
          return { ...item, [key]: nextVal, can_view: true };
        }
        // If disabling view, auto-disable all actions
        if (!nextVal && key === "can_view") {
          return { ...item, can_view: false, can_create: false, can_edit: false, can_delete: false };
        }
        return { ...item, [key]: nextVal };
      })
    );
  }

  function toggleRow(pageId: number) {
    setMatrixItems((current) =>
      current.map((item) => {
        if (item.page_id !== pageId) return item;
        const allChecked = item.can_view && item.can_create && item.can_edit && item.can_delete;
        return {
          ...item,
          can_view: !allChecked,
          can_create: !allChecked,
          can_edit: !allChecked,
          can_delete: !allChecked,
        };
      })
    );
  }

  function toggleColumn(key: "can_view" | "can_create" | "can_edit" | "can_delete") {
    setMatrixItems((current) => {
      const allChecked = current.every((item) => item[key]);
      return current.map((item) => {
        if (key !== "can_view" && !allChecked) {
          return { ...item, [key]: true, can_view: true };
        }
        if (key === "can_view" && allChecked) {
          return { ...item, can_view: false, can_create: false, can_edit: false, can_delete: false };
        }
        return { ...item, [key]: !allChecked };
      });
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setLoading(true);

    const rolePayload = {
      name: name.trim(),
      code: code.trim().toUpperCase().replace(/\s+/g, "_"),
      description: description.trim(),
      is_superadmin_wildcard: isSuperadminWildcard,
    };

    try {
      let targetRole = role;
      if (isEdit && role) {
        targetRole = await api<DynamicRole>(`/portal/roles/${role.id}/`, {
          method: "PATCH",
          body: JSON.stringify(rolePayload),
        });
      } else {
        targetRole = await api<DynamicRole>("/portal/roles/", {
          method: "POST",
          body: JSON.stringify(rolePayload),
        });
      }

      if (targetRole && matrixItems.length) {
        await api<RolePermissionMatrixResponse>(`/portal/roles/${targetRole.id}/permissions/`, {
          method: "PUT",
          body: JSON.stringify({
            permissions: matrixItems.map((item) => ({
              page_id: item.page_id,
              can_view: item.can_view,
              can_create: item.can_create,
              can_edit: item.can_edit,
              can_delete: item.can_delete,
            })),
          }),
        });
      }

      triggerNavigationRefresh();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("flumenx:roles_refresh"));
      }
      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fields);
        setError(err.message || "Failed to save role.");
      } else {
        setError(err instanceof Error ? err.message : "An error occurred.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={isEdit ? "Edit Dynamic Role & Permissions" : "Create New Dynamic Role"} onClose={() => !loading && onClose()}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "640px", maxHeight: "75vh", overflowY: "auto", paddingRight: "4px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
            ROLE NAME
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Content Creator"
              required
              className="fi"
            />
            {fieldErrors.name && <small style={{ color: "#EF4444" }}>{fieldErrors.name}</small>}
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
            ROLE CODE (UNIQUE IDENTIFIER)
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. CONTENT_CREATOR"
              required
              disabled={isEdit && role?.is_system_role}
              className="fi"
            />
            {fieldErrors.code && <small style={{ color: "#EF4444" }}>{fieldErrors.code}</small>}
          </label>
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
          DESCRIPTION
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Responsibilities and access scope..."
            rows={2}
            className="fi"
          />
        </label>

        {role?.code === "SUPER_ADMIN" && (
          <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12px", background: "rgba(203, 168, 110, 0.08)", padding: "10px 14px", borderRadius: "8px", border: "1px solid rgba(203, 168, 110, 0.2)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={isSuperadminWildcard}
              onChange={(e) => setIsSuperadminWildcard(e.target.checked)}
              style={{ width: "16px", height: "16px", accentColor: "var(--brand)" }}
            />
            <span style={{ color: "var(--brand)", fontWeight: 600 }}>Enable Super Admin Wildcard (*) Full Access</span>
          </label>
        )}

        <div style={{ marginTop: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
              GRANTED PAGE PERMISSIONS MATRIX ({matrixItems.filter((i) => i.can_view).length} PAGES)
            </span>
          </div>

          {matrixLoading && <div style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>Loading permission matrix...</div>}

          {!matrixLoading && (
            <div style={{ overflowX: "auto", border: "1px solid var(--border2)", borderRadius: "10px", background: "#ffffff" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e8e6e1", background: "#f9f8f4" }}>
                    <th style={{ padding: "12px 14px", color: "#5c606b", fontWeight: 800, fontSize: "11px", letterSpacing: "0.05em" }}>PAGE / FEATURE</th>
                    <th style={{ padding: "12px 14px", textAlign: "center", cursor: "pointer", color: "#5c606b", fontWeight: 800, fontSize: "11px" }} onClick={() => toggleColumn("can_view")}>
                      VIEW <br /><small style={{ color: "#a8874e", fontWeight: 700 }}>Toggle All</small>
                    </th>
                    <th style={{ padding: "12px 14px", textAlign: "center", cursor: "pointer", color: "#5c606b", fontWeight: 800, fontSize: "11px" }} onClick={() => toggleColumn("can_create")}>
                      CREATE <br /><small style={{ color: "#a8874e", fontWeight: 700 }}>Toggle All</small>
                    </th>
                    <th style={{ padding: "12px 14px", textAlign: "center", cursor: "pointer", color: "#5c606b", fontWeight: 800, fontSize: "11px" }} onClick={() => toggleColumn("can_edit")}>
                      EDIT <br /><small style={{ color: "#a8874e", fontWeight: 700 }}>Toggle All</small>
                    </th>
                    <th style={{ padding: "12px 14px", textAlign: "center", cursor: "pointer", color: "#5c606b", fontWeight: 800, fontSize: "11px" }} onClick={() => toggleColumn("can_delete")}>
                      DELETE <br /><small style={{ color: "#a8874e", fontWeight: 700 }}>Toggle All</small>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {matrixItems.map((item) => (
                    <tr key={item.page_id} style={{ borderBottom: "1px solid #e8e6e1" }}>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ fontWeight: 700, color: "#1a1b1e", fontSize: "13px" }}>{item.page_title}</div>
                        <div style={{ fontSize: "11px", color: "#5c606b", fontFamily: "monospace", fontWeight: 600, marginTop: "2px" }}>{item.route_path}</div>
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={item.can_view}
                          onChange={() => togglePermission(item.page_id, "can_view")}
                          style={{ width: "16px", height: "16px", accentColor: "#a8874e", cursor: "pointer" }}
                        />
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={item.can_create}
                          onChange={() => togglePermission(item.page_id, "can_create")}
                          style={{ width: "16px", height: "16px", accentColor: "#a8874e", cursor: "pointer" }}
                        />
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={item.can_edit}
                          onChange={() => togglePermission(item.page_id, "can_edit")}
                          style={{ width: "16px", height: "16px", accentColor: "#a8874e", cursor: "pointer" }}
                        />
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={item.can_delete}
                          onChange={() => togglePermission(item.page_id, "can_delete")}
                          style={{ width: "16px", height: "16px", accentColor: "#a8874e", cursor: "pointer" }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {error && <div className="toast error">{error}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
          <button type="button" className="secondary-button" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? "Saving..." : isEdit ? "Save Role & Matrix" : "Create Role"}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
