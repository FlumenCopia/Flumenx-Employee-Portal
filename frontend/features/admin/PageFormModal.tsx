"use client";

import { FormEvent, useState } from "react";
import { Modal } from "@/features/common/Modal";
import { PrimaryButton } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { triggerNavigationRefresh } from "@/lib/navigation";
import type { PortalPage } from "@/lib/types";

type Props = {
  page?: PortalPage | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function PageFormModal({ page, open, onClose, onSuccess }: Props) {
  const isEdit = Boolean(page);
  const [title, setTitle] = useState(page?.title || "");
  const [routePath, setRoutePath] = useState(page?.route_path || "");
  const [moduleCode, setModuleCode] = useState(page?.module_code || "");
  const [icon, setIcon] = useState(page?.icon || "LayoutDashboard");
  const [sidebarOrder, setSidebarOrder] = useState(page?.sidebar_order ?? 10);
  const [isActive, setIsActive] = useState(page?.is_active ?? true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setLoading(true);

    const payload = {
      title: title.trim(),
      route_path: routePath.trim(),
      module_code: moduleCode.trim().toUpperCase().replace(/\s+/g, "_"),
      icon: icon.trim() || "LayoutDashboard",
      sidebar_order: Number(sidebarOrder) || 0,
      is_active: isActive,
    };

    try {
      if (isEdit && page) {
        await api<PortalPage>(`/portal/pages/${page.id}/`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await api<PortalPage>("/portal/pages/", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      triggerNavigationRefresh();
      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fields);
        setError(err.message || "Failed to save page.");
      } else {
        setError(err instanceof Error ? err.message : "An error occurred.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={isEdit ? "Edit System Page Route" : "Add New System Page"} onClose={() => !loading && onClose()}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px", maxHeight: "75vh", overflowY: "auto", paddingRight: "4px" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
          PAGE TITLE
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Command Center Dashboard"
            required
            className="fi"
          />
          {fieldErrors.title && <small style={{ color: "#EF4444" }}>{fieldErrors.title}</small>}
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
            ROUTE PATH
            <input
              type="text"
              value={routePath}
              onChange={(e) => setRoutePath(e.target.value)}
              placeholder="e.g. /admin/work"
              required
              className="fi"
            />
            {fieldErrors.route_path && <small style={{ color: "#EF4444" }}>{fieldErrors.route_path}</small>}
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
            MODULE CODE
            <input
              type="text"
              value={moduleCode}
              onChange={(e) => setModuleCode(e.target.value)}
              placeholder="e.g. TASKS"
              required
              className="fi"
            />
            {fieldErrors.module_code && <small style={{ color: "#EF4444" }}>{fieldErrors.module_code}</small>}
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
            ICON NAME
            <input
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="e.g. Sparkles, Kanban, Users"
              className="fi"
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
            SIDEBAR ORDER
            <input
              type="number"
              value={sidebarOrder}
              onChange={(e) => setSidebarOrder(Number(e.target.value))}
              placeholder="1"
              min="0"
              className="fi"
            />
          </label>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12px", cursor: "pointer", marginTop: "4px" }}>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            style={{ width: "16px", height: "16px", accentColor: "var(--brand)" }}
          />
          <span style={{ color: "#E2E8F0" }}>Active / Visible in Navigation</span>
        </label>

        {error && <div className="toast error">{error}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
          <button type="button" className="secondary-button" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? "Saving..." : isEdit ? "Save Changes" : "Create Page"}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
