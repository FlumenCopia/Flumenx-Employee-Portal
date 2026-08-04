"use client";

import { FormEvent, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, AlertTriangle } from "lucide-react";
import { FlumenxMark } from "@/components/icons";
import { api, ApiError } from "@/lib/api";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid") || "";
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const isLinkInvalid = !uid || !token;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);
    try {
      await api<{ detail: string }>("/auth/password-reset/confirm/", {
        method: "POST",
        body: JSON.stringify({
          uid,
          token,
          new_password: newPassword,
        }),
      });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError && err.fields?.new_password) {
        setError(Array.isArray(err.fields.new_password) ? err.fields.new_password.join(" ") : String(err.fields.new_password));
      } else {
        setError(err instanceof Error ? err.message : "Invalid or expired reset token.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-form-side" style={{ maxWidth: "480px", margin: "0 auto", padding: "32px 24px" }}>
      <div className="form-rail">SECURE ACCOUNT RESET / FLX-02</div>
      <div className="mobile-brand" style={{ marginBottom: "20px" }}><FlumenxMark /></div>

      {isLinkInvalid ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", background: "#0F1A15", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "16px", padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#EF4444" }}>
            <AlertTriangle size={20} />
            <b style={{ fontSize: "15px" }}>Invalid Reset Link</b>
          </div>
          <p style={{ fontSize: "13px", color: "#A7C1B5", lineHeight: 1.5 }}>
            This password reset link is incomplete, invalid, or has expired. Please request a new link from the login page.
          </p>
          <button
            type="button"
            className="login-button"
            onClick={() => router.push("/login")}
            style={{ marginTop: "8px" }}
          >
            Return to Login <ArrowRight size={18} />
          </button>
        </div>
      ) : success ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", background: "#0F1A15", border: "1px solid rgba(77, 255, 160, 0.3)", borderRadius: "16px", padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#4DFFA0" }}>
            <CheckCircle2 size={22} />
            <b style={{ fontSize: "16px" }}>Password Reset Complete</b>
          </div>
          <p style={{ fontSize: "13px", color: "#A7C1B5", lineHeight: 1.5 }}>
            Your FLUMENX account password has been updated successfully. You can now log in using your new credentials.
          </p>
          <button
            type="button"
            className="login-button"
            onClick={() => router.push("/login")}
            style={{ marginTop: "8px" }}
          >
            Log In to FLUMENX <ArrowRight size={18} />
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="form-index">ACCOUNT SECURITY</div>
          <h2>Set new <i>password.</i></h2>
          <p className="form-subtitle">Choose a strong password containing at least 8 characters.</p>

          <label>
            New Password
            <div className="input-wrap">
              <LockKeyhole size={18} />
              <input
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                placeholder="At least 8 characters"
                required
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <label>
            Confirm New Password
            <div className="input-wrap">
              <LockKeyhole size={18} />
              <input
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                placeholder="Repeat new password"
                required
              />
            </div>
          </label>

          {error && <div className="form-error">{error}</div>}

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? "Updating password..." : "Update Password"}<ArrowRight size={18} />
          </button>

          <div style={{ marginTop: "16px", textAlign: "center" }}>
            <button
              type="button"
              onClick={() => router.push("/login")}
              style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "12px", cursor: "pointer" }}
            >
              Back to Login
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="simple-login-page" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#05110B" }}>
      <Suspense fallback={<div style={{ color: "#4DFFA0", fontSize: "14px" }}>Loading password reset form...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
