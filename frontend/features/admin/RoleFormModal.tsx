"use client";

import { FormEvent, useEffect, useState } from "react";
import { Modal } from "@/features/common/Modal";
import { PrimaryButton } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { triggerNavigationRefresh } from "@/lib/navigation";
import type { DynamicRole, PortalPage, RolePermissionItem, RolePermissionMatrixResponse } from "@/lib/types";
import {
  Kanban,
  TrendingUp,
  CalendarCheck,
  Calendar,
  Video,
  FileText,
  Settings,
  ShieldCheck,
  Check,
  Users,
  Sparkles
} from "lucide-react";

type Props = {
  role?: DynamicRole | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

function getPageIcon(title: string, route: string) {
  const t = (title || "").toLowerCase();
  const r = (route || "").toLowerCase();
  if (t.includes("command") || r.includes("command")) return <Sparkles size={15} style={{ color: "#8b5cf6" }} />;
  if (t.includes("task") || r.includes("kanban")) return <Kanban size={15} style={{ color: "#d97706" }} />;
  if (t.includes("kpi") || r.includes("kpi")) return <TrendingUp size={15} style={{ color: "#059669" }} />;
  if (t.includes("attendance") || r.includes("attendance")) return <CalendarCheck size={15} style={{ color: "#2563eb" }} />;
  if (t.includes("leave") || r.includes("leave")) return <Calendar size={15} style={{ color: "#7c3aed" }} />;
  if (t.includes("meeting") || r.includes("meeting")) return <Video size={15} style={{ color: "#db2777" }} />;
  if (t.includes("report") || r.includes("report")) return <FileText size={15} style={{ color: "#087a5b" }} />;
  if (t.includes("client") || r.includes("client")) return <Users size={15} style={{ color: "#0284c7" }} />;
  if (t.includes("page") || r.includes("page")) return <FileText size={15} style={{ color: "#0891b2" }} />;
  if (t.includes("setting") || r.includes("setting")) return <Settings size={15} style={{ color: "#475569" }} />;
  return <Users size={15} style={{ color: "#a8874e" }} />;
}

export function RoleFormModal({ role, open, onClose, onSuccess }: Props) {
  const isEdit = Boolean(role);
  const [name, setName] = useState(role?.name || "");
  const [code, setCode] = useState(role?.code || "");
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(Boolean(role));
  const [description, setDescription] = useState(role?.description || "");
  const [isSuperadminWildcard, setIsSuperadminWildcard] = useState(role?.is_superadmin_wildcard || false);

  const [matrixItems, setMatrixItems] = useState<RolePermissionItem[]>([]);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function handleNameChange(val: string) {
    setName(val);
    if (!isEdit && !codeManuallyEdited) {
      const autoCode = val
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      setCode(autoCode);
    }
  }

  function handleCodeChange(val: string) {
    setCode(val);
    setCodeManuallyEdited(true);
  }

  function applyPreset(preset: "read_only" | "full_access" | "clear_all") {
    setMatrixItems((current) =>
      current.map((item) => {
        if (preset === "read_only") {
          return { ...item, can_view: true, can_create: false, can_edit: false, can_delete: false };
        }
        if (preset === "full_access") {
          return { ...item, can_view: true, can_create: true, can_edit: true, can_delete: true };
        }
        return { ...item, can_view: false, can_create: false, can_edit: false, can_delete: false };
      })
    );
  }

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
        .then((res) => {
          const raw = res?.permissions || [];
          setMatrixItems(raw);
        })
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

  const activePageCount = matrixItems.filter((i) => i.can_view).length;

  return (
    <Modal
      title={isEdit ? "Edit Dynamic Role & Permissions" : "Create New Dynamic Role"}
      onClose={() => !loading && onClose()}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          maxHeight: "75vh",
          overflowY: "auto",
          paddingRight: "4px",
        }}
      >
        {/* Top Form Fields Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "12px",
            background: "#fafafa",
            padding: "14px",
            borderRadius: "12px",
            border: "1px solid #eaeaea",
          }}
        >
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.05em",
              color: "#4b5563",
            }}
          >
            ROLE NAME <span style={{ color: "#ef4444" }}>*</span>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="team member"
              required
              className="fi"
              style={{
                padding: "9px 12px",
                borderRadius: "8px",
                border: "1.5px solid #e5e7eb",
                fontSize: "13px",
                fontWeight: 600,
                outline: "none",
                transition: "all 0.15s ease",
                background: "#ffffff",
              }}
            />
            {fieldErrors.name && <small style={{ color: "#EF4444" }}>{fieldErrors.name}</small>}
          </label>

          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.05em",
              color: "#4b5563",
            }}
          >
            ROLE CODE (UNIQUE IDENTIFIER) <span style={{ color: "#ef4444" }}>*</span>
            <input
              type="text"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="e.g. PROJECT_LEAD"
              required
              disabled={isEdit && role?.is_system_role}
              className="fi"
              style={{
                padding: "9px 12px",
                borderRadius: "8px",
                border: "1.5px solid #e5e7eb",
                fontSize: "13px",
                fontWeight: 600,
                fontFamily: "monospace",
                outline: "none",
                transition: "all 0.15s ease",
                background: isEdit && role?.is_system_role ? "#f3f4f6" : "#ffffff",
              }}
            />
            {fieldErrors.code && <small style={{ color: "#EF4444" }}>{fieldErrors.code}</small>}
          </label>
        </div>

        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.05em",
            color: "#4b5563",
          }}
        >
          DESCRIPTION & SCOPE
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Responsibilities, department scope, and permission context..."
            rows={2}
            className="fi"
            style={{
              padding: "9px 12px",
              borderRadius: "8px",
              border: "1.5px solid #e5e7eb",
              fontSize: "13px",
              outline: "none",
              transition: "all 0.15s ease",
              resize: "vertical",
            }}
          />
        </label>

        {role?.code === "SUPER_ADMIN" && (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              fontSize: "12px",
              background: "linear-gradient(135deg, rgba(203, 168, 110, 0.1) 0%, rgba(168, 135, 78, 0.05) 100%)",
              padding: "12px 16px",
              borderRadius: "10px",
              border: "1px solid rgba(203, 168, 110, 0.3)",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={isSuperadminWildcard}
              onChange={(e) => setIsSuperadminWildcard(e.target.checked)}
              style={{ width: "18px", height: "18px", accentColor: "#a8874e", cursor: "pointer" }}
            />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ color: "#a8874e", fontWeight: 700, fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Sparkles size={14} /> Enable Super Admin Wildcard (*) Full Access
              </span>
              <span style={{ color: "#6b7280", fontSize: "11px", marginTop: "2px" }}>
                Bypasses individual page permission matrix rules.
              </span>
            </div>
          </label>
        )}

        {/* Matrix Header & Table */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <ShieldCheck size={16} style={{ color: "#a8874e" }} />
              <span style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.05em", color: "#1f2937", textTransform: "uppercase" }}>
                GRANTED PERMISSIONS MATRIX
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                type="button"
                onClick={() => applyPreset("read_only")}
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "4px 9px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  background: "#ffffff",
                  color: "#374151",
                  cursor: "pointer",
                }}
              >
                Read-Only View
              </button>
              <button
                type="button"
                onClick={() => applyPreset("full_access")}
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "4px 9px",
                  borderRadius: "6px",
                  border: "1px solid #087a5b",
                  background: "rgba(8, 122, 91, 0.08)",
                  color: "#087a5b",
                  cursor: "pointer",
                }}
              >
                Full Access
              </button>
              <button
                type="button"
                onClick={() => applyPreset("clear_all")}
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "4px 9px",
                  borderRadius: "6px",
                  border: "1px solid #e5e7eb",
                  background: "#ffffff",
                  color: "#6b7280",
                  cursor: "pointer",
                }}
              >
                Clear All
              </button>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#a8874e",
                  background: "rgba(203, 168, 110, 0.12)",
                  padding: "4px 10px",
                  borderRadius: "20px",
                  border: "1px solid rgba(203, 168, 110, 0.2)",
                  marginLeft: "4px",
                }}
              >
                {activePageCount} of {matrixItems.length} Viewable
              </span>
            </div>
          </div>

          {matrixLoading && (
            <div style={{ padding: "32px", textAlign: "center", color: "#6b7280", fontSize: "13px", background: "#f9fafb", borderRadius: "12px" }}>
              Loading permission matrix...
            </div>
          )}

          {!matrixLoading && (
            <div
              style={{
                overflowX: "auto",
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                background: "#ffffff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
              }}
            >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                      <th
                        style={{
                          position: "sticky",
                          top: 0,
                          background: "#f9fafb",
                          zIndex: 10,
                          padding: "14px 16px",
                          color: "#374151",
                          fontWeight: 700,
                          fontSize: "11px",
                          letterSpacing: "0.05em",
                          width: "40%",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                        }}
                      >
                        PAGE / FEATURE
                      </th>
                      {(["can_view", "can_create", "can_edit", "can_delete"] as const).map((colKey) => {
                        const labels = {
                          can_view: "VIEW",
                          can_create: "CREATE",
                          can_edit: "EDIT",
                          can_delete: "DELETE",
                        };
                        const hints = {
                          can_view: "Access page",
                          can_create: "Add new",
                          can_edit: "Modify",
                          can_delete: "Remove",
                        };
                        return (
                          <th
                            key={colKey}
                            style={{
                              position: "sticky",
                              top: 0,
                              background: "#f9fafb",
                              zIndex: 10,
                              padding: "12px 10px",
                              textAlign: "center",
                              cursor: "pointer",
                              color: "#374151",
                              fontWeight: 700,
                              fontSize: "11px",
                              userSelect: "none",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                            }}
                            onClick={() => toggleColumn(colKey)}
                            title="Click to toggle column"
                          >
                            <div style={{ textTransform: "uppercase" }}>{labels[colKey]}</div>
                            <div style={{ fontSize: "9px", fontWeight: 500, color: "#9ca3af", marginTop: "2px" }}>{hints[colKey]}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixItems.map((item) => (
                      <tr
                        key={item.page_id}
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          transition: "background 0.15s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#fcfbf8")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div
                              style={{
                                width: "28px",
                                height: "28px",
                                borderRadius: "8px",
                                background: "#f3f4f6",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              {getPageIcon(item.page_title, item.route_path)}
                            </div>
                            <div>
                              <div
                                style={{
                                  fontWeight: 700,
                                  color: "#111827",
                                  fontSize: "13px",
                                  cursor: "pointer",
                                }}
                                onClick={() => toggleRow(item.page_id)}
                              >
                                {item.page_title}
                              </div>
                              <div
                                style={{
                                  fontSize: "11px",
                                  color: "#6b7280",
                                  fontFamily: "monospace",
                                  fontWeight: 500,
                                  marginTop: "2px",
                                  display: "inline-block",
                                  background: "#f3f4f6",
                                  padding: "1px 6px",
                                  borderRadius: "4px",
                                }}
                              >
                                {item.route_path}
                              </div>
                            </div>
                          </div>
                        </td>
                        {(["can_view", "can_create", "can_edit", "can_delete"] as const).map((key) => {
                          const isChecked = item[key];
                          return (
                            <td key={key} style={{ padding: "14px 16px", textAlign: "center" }}>
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={isChecked}
                                aria-label={`${key} permission for ${item.page_title}`}
                                onClick={() => togglePermission(item.page_id, key)}
                                style={{
                                  width: "20px",
                                  height: "20px",
                                  borderRadius: "6px",
                                  border: isChecked ? "1.5px solid #a8874e" : "1.5px solid #d1d5db",
                                  background: isChecked ? "linear-gradient(135deg, #cba86e 0%, #a8874e 100%)" : "#ffffff",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                  boxShadow: isChecked ? "0 2px 5px rgba(168, 135, 78, 0.25)" : "none",
                                  margin: "0 auto",
                                }}
                              >
                                {isChecked && <Check size={13} color="#ffffff" strokeWidth={3} />}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        {error && (
          <div className="toast error" style={{ margin: "8px 0" }}>
            {error}
          </div>
        )}

        {/* Sticky Action Footer */}
        <div
          style={{
            position: "sticky",
            bottom: 0,
            background: "#ffffff",
            paddingTop: "14px",
            marginTop: "8px",
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: "12px",
            zIndex: 20,
          }}
        >
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
