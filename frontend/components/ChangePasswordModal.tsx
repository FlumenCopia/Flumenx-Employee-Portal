"use client";

import React, { useState } from "react";
import { Lock, Eye, EyeOff, Check, AlertCircle, ShieldCheck } from "lucide-react";
import { Modal } from "@/features/common/Modal";
import { api } from "@/lib/api";

interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({ open, onClose }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!currentPassword) {
      setError("Please enter your current password.");
      return;
    }

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation password do not match.");
      return;
    }

    setLoading(true);
    try {
      await api("/auth/change-password/", {
        method: "POST",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 1800);
    } catch (err: any) {
      setError(err.message || "Could not change password. Please verify current password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Change Password" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "4px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", background: "rgba(8, 122, 91, 0.08)", borderRadius: "10px", border: "1px solid rgba(8, 122, 91, 0.25)" }}>
          <ShieldCheck size={20} color="#087A5B" />
          <span style={{ fontSize: "12.5px", color: "#334155", lineHeight: "1.4" }}>
            Protect your FLUMENX OS account. Choose a secure password with at least 6 characters.
          </span>
        </div>

        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", background: "rgba(239, 68, 68, 0.1)", borderRadius: "8px", border: "1px solid #EF4444", color: "#B91C1C", fontSize: "13px" }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", background: "rgba(8, 122, 91, 0.15)", borderRadius: "8px", border: "1px solid #087A5B", color: "#065F46", fontSize: "13px", fontWeight: 700 }}>
            <Check size={16} />
            <span>Password changed successfully! Closing...</span>
          </div>
        )}

        {/* Current Password */}
        <div>
          <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, marginBottom: "6px", color: "#334155" }}>
            Current Password
          </label>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <input
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter your current password"
              required
              disabled={loading || success}
              style={{ width: "100%", padding: "10px 38px 10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13.5px", outline: "none" }}
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              style={{ position: "absolute", right: "10px", background: "none", border: "none", color: "#64748B", cursor: "pointer" }}
            >
              {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div>
          <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, marginBottom: "6px", color: "#334155" }}>
            New Password
          </label>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min. 6 chars)"
              required
              disabled={loading || success}
              style={{ width: "100%", padding: "10px 38px 10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13.5px", outline: "none" }}
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              style={{ position: "absolute", right: "10px", background: "none", border: "none", color: "#64748B", cursor: "pointer" }}
            >
              {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div>
          <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, marginBottom: "6px", color: "#334155" }}>
            Confirm New Password
          </label>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              required
              disabled={loading || success}
              style={{ width: "100%", padding: "10px 38px 10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13.5px", outline: "none" }}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              style={{ position: "absolute", right: "10px", background: "none", border: "none", color: "#64748B", cursor: "pointer" }}
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{ padding: "9px 18px", borderRadius: "8px", background: "#F1F5F9", border: "1px solid #CBD5E1", color: "#475569", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || success}
            style={{ padding: "9px 20px", borderRadius: "8px", background: "#087A5B", border: "none", color: "#FFFFFF", fontWeight: 800, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Lock size={14} />
            <span>{loading ? "Updating..." : "Update Password"}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
