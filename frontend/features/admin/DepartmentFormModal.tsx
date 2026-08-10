"use client";

import { FormEvent, useState } from "react";
import { Modal } from "@/features/common/Modal";
import { PrimaryButton } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { DepartmentItem } from "@/lib/types";

type Props = {
  department?: DepartmentItem | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function DepartmentFormModal({ department, open, onClose, onSuccess }: Props) {
  const isEdit = Boolean(department);
  const [name, setName] = useState(department?.name || "");
  const [code, setCode] = useState(department?.code || "");
  const [description, setDescription] = useState(department?.description || "");
  const [displayOrder, setDisplayOrder] = useState(department?.display_order ?? 10);
  const [isActive, setIsActive] = useState(department?.is_active ?? true);

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
      name: name.trim(),
      code: code.trim().toUpperCase().replace(/\s+/g, "_"),
      description: description.trim(),
      display_order: Number(displayOrder) || 0,
      is_active: isActive,
    };

    try {
      if (isEdit && department) {
        await api<DepartmentItem>(`/portal/departments/${department.id}/`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await api<DepartmentItem>("/portal/departments/", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fields);
        setError(err.message || "Failed to save department.");
      } else {
        setError(err instanceof Error ? err.message : "An error occurred.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={isEdit ? "Edit Department" : "Add New Department"} onClose={() => !loading && onClose()}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px", maxHeight: "75vh", overflowY: "auto", paddingRight: "4px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
            DEPARTMENT NAME
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cyber Security"
              required
              className="fi"
            />
            {fieldErrors.name && <small style={{ color: "#EF4444" }}>{fieldErrors.name}</small>}
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
            CODE (UNIQUE IDENTIFIER)
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. CYBER_SECURITY"
              required
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
            placeholder="Department scope and objectives..."
            rows={2}
            className="fi"
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
            DISPLAY ORDER
            <input
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(Number(e.target.value))}
              placeholder="1"
              min="0"
              className="fi"
            />
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12px", cursor: "pointer", marginTop: "20px" }}>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              style={{ width: "16px", height: "16px", accentColor: "var(--brand)" }}
            />
            <span style={{ color: "#E2E8F0" }}>Active Department</span>
          </label>
        </div>

        {error && <div className="toast error">{error}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
          <button type="button" className="secondary-button" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? "Saving..." : isEdit ? "Save Changes" : "Create Department"}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
