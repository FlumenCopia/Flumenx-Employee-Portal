"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { FlumenxMark } from "@/components/icons";
import { api, ApiError } from "@/lib/api";
import { getWorkspaceDestination } from "@/components/layout/navigation";
import { clearCachedAuthUser, setCachedAuthUser } from "@/lib/auth-cache";
import type { AuthUser } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotError, setForgotError] = useState("");

  useEffect(() => {
    let active = true;

    const timer = setTimeout(() => {
      if (active) {
        clearCachedAuthUser();
        setCheckingSession(false);
      }
    }, 800);

    api<AuthUser>("/auth/me/")
      .then(user => {
        if (!active) return;
        clearTimeout(timer);
        setCachedAuthUser(user);
        const dest = getWorkspaceDestination(user.portal_role);
        if (dest && dest !== "/login") {
          router.replace(dest);
        } else {
          setCheckingSession(false);
        }
      })
      .catch(() => {
        if (active) {
          clearTimeout(timer);
          clearCachedAuthUser();
          setCheckingSession(false);
        }
      });

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [router]);

  async function handleForgotSubmit(e: FormEvent) {
    e.preventDefault();
    setForgotError("");
    setForgotMessage("");
    setForgotLoading(true);
    try {
      const res = await api<{ detail: string }>("/auth/password-reset/", {
        method: "POST",
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      setForgotMessage(res.detail || "If an account with that email exists, password reset instructions have been sent.");
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : "Unable to process password reset request.");
    } finally {
      setForgotLoading(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setLoading(true);
    try {
      clearCachedAuthUser();
      const res = await api<{ user: AuthUser }>("/auth/login/", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const loggedUser = res?.user;
      if (loggedUser) {
        setCachedAuthUser(loggedUser);
        const dest = getWorkspaceDestination(loggedUser.portal_role);
        router.replace(dest);
      } else {
        const meUser = await api<AuthUser>("/auth/me/");
        setCachedAuthUser(meUser);
        const dest = getWorkspaceDestination(meUser.portal_role);
        router.replace(dest);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to sign in.");
      if (error instanceof ApiError) setFieldErrors(error.fields);
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return <div className="route-loader"><span>F</span><p>Checking workspace session</p></div>;
  }

  return (
    <div className="simple-login-page">
      <div className="login-form-side">
        <form onSubmit={submit}>
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <div style={{ display: "inline-flex", justifyContent: "center", alignItems: "center", marginBottom: "8px" }}>
              <img
                src="/flumenx-logo.webp"
                alt="FLUMENX - Make It Happen"
                style={{ height: "46px", width: "auto", objectFit: "contain" }}
              />
            </div>
            <div style={{ fontSize: "10px", letterSpacing: "0.22em", color: "var(--neon)", fontWeight: 700, textTransform: "uppercase" }}>
              EMPLOYEE PORTAL
            </div>
          </div>

          <h2>Welcome <i>back.</i></h2>
          <p className="form-subtitle">Use your work account to sign in to your workspace.</p>

          <label>
            Work email
            <div className="input-wrap">
              <Mail size={18} />
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="name@company.com" required />
            </div>
            {fieldErrors.username && <span className="form-field-error">{fieldErrors.username}</span>}
          </label>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", color: "#aaa" }}>Password</span>
            <button
              type="button"
              onClick={() => {
                setForgotModalOpen(true);
                setForgotEmail(email);
                setForgotMessage("");
                setForgotError("");
              }}
              style={{ background: "none", border: "none", color: "var(--neon)", fontSize: "11px", fontWeight: 600, cursor: "pointer", padding: 0 }}
            >
              Forgot password?
            </button>
          </div>
          <label style={{ marginBottom: "16px" }}>
            <div className="input-wrap" style={{ marginTop: 0 }}>
              <LockKeyhole size={18} />
              <input value={password} onChange={e => setPassword(e.target.value)} type={show ? "text" : "password"} required />
              <button type="button" onClick={() => setShow(!show)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
            {fieldErrors.password && <span className="form-field-error">{fieldErrors.password}</span>}
          </label>

          {error && <div className="form-error">{error}</div>}
          <button type="submit" className="login-button" disabled={loading}>
            {loading ? "Signing in..." : "Login to FLUMENX"}<ArrowRight size={18} />
          </button>
        </form>
      </div>

      {forgotModalOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0, 0, 0, 0.75)", backdropFilter: "blur(4px)", padding: "16px" }}>
          <div style={{ width: "100%", maxWidth: "420px", background: "var(--panel)", border: "1px solid var(--border2)", borderRadius: "16px", padding: "24px", color: "var(--text)", display: "flex", flexDirection: "column", gap: "16px", boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <b style={{ fontSize: "16px", letterSpacing: "0.5px" }}>RESET PASSWORD</b>
              <button type="button" onClick={() => setForgotModalOpen(false)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "18px" }}>✕</button>
            </div>
            <p style={{ fontSize: "12.5px", color: "var(--muted)", lineHeight: 1.5 }}>
              Enter the work email address linked to your account. We will send you a secure link to reset your password.
            </p>
            {forgotMessage ? (
              <div style={{ padding: "12px 14px", background: "rgba(203, 168, 110, 0.08)", border: "1px solid rgba(203, 168, 110, 0.25)", borderRadius: "8px", color: "var(--neon)", fontSize: "12px", lineHeight: 1.4 }}>
                {forgotMessage}
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.5px" }}>
                  WORK EMAIL ADDRESS
                  <div className="input-wrap">
                    <Mail size={18} />
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      placeholder="name@company.com"
                      required
                    />
                  </div>
                </label>
                {forgotError && <div className="form-error">{forgotError}</div>}
                <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                  <button
                    type="button"
                    onClick={() => setForgotModalOpen(false)}
                    style={{ flex: 1, padding: "10px", borderRadius: "8px", background: "var(--panel2)", color: "var(--muted)", border: "1px solid var(--border)", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="login-button"
                    style={{ flex: 1.5, margin: 0, padding: "10px" }}
                  >
                    {forgotLoading ? "Sending link..." : "Send Reset Link"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
