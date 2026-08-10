"use client";

import { FormEvent, useState } from "react";
import { Modal } from "@/features/common/Modal";
import { PrimaryButton } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { SuperAdminUser } from "@/lib/types";

type Props = {
  user: SuperAdminUser | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function UserPasswordModal({ user, open, onClose, onSuccess }: Props) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open || !user) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      if (!user) return;
      await api<{ detail: string }>(`/portal/super-admin/users/${user.user_id}/password/`, {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Failed to update password.");
      } else {
        setError(err instanceof Error ? err.message : "An error occurred.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={`Reset Password · ${user?.full_name || ""}`} onClose={() => !loading && onClose()}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px", maxHeight: "75vh", overflowY: "auto", paddingRight: "4px" }}>
        <p style={{ fontSize: "12.5px", color: "var(--muted)", lineHeight: 1.5 }}>
          Set a new temporary or permanent password for <b>{user?.work_email || ""}</b>.
        </p>

        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
          NEW PASSWORD
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            required
            minLength={8}
            className="fi"
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--muted)" }}>
          CONFIRM NEW PASSWORD
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••••••"
            required
            minLength={8}
            className="fi"
          />
        </label>

        {error && <div className="toast error">{error}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
          <button type="button" className="secondary-button" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? "Updating..." : "Update Password"}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
