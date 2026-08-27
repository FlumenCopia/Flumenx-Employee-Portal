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

  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotError, setForgotError] = useState("");

  const [splashActive, setSplashActive] = useState(true);
  const [splashHiding, setSplashHiding] = useState(false);
  const [counter, setCounter] = useState(0);

  useEffect(() => {
    let current = 0;
    const interval = setInterval(() => {
      current += Math.floor(Math.random() * 7) + 4;
      if (current >= 100) {
        current = 100;
        clearInterval(interval);
        setTimeout(() => {
          setSplashHiding(true);
        }, 200);
        setTimeout(() => {
          setSplashActive(false);
        }, 950);
      }
      setCounter(current);
    }, 55);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;

    api<AuthUser>("/auth/me/")
      .then(user => {
        if (!active) return;
        setCachedAuthUser(user);
        const dest = getWorkspaceDestination(user.portal_role);
        if (dest && dest !== "/login") {
          router.replace(dest);
        }
      })
      .catch(() => {
        if (active) {
          clearCachedAuthUser();
        }
      });

    return () => {
      active = false;
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
      const res = await api<{ user: AuthUser; access?: string }>("/auth/login/", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (res?.access) {
        localStorage.setItem("flumenx_access_token", res.access);
      }
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

  return (
    <div className="simple-login-page">
      {splashActive && (
        <div className={`g3-splash-overlay ${splashHiding ? "hiding" : ""}`}>
          <div className="g3-splash-container">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/flumenx-mark-only.png"
              alt="FLUMENX"
              className="g3-splash-logo-img"
            />

            <div className="g3-expand-line-track">
              <div className="g3-expand-line-fill" style={{ width: `${counter}%` }} />
            </div>

            <div className="g3-bottom-meta">
              <div className="g3-meta-label">
                <i /> INITIALIZING WORKSPACE
              </div>
              <div className="g3-meta-counter">
                {String(counter).padStart(2, "0")}
                <span>%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="login-form-side">
        <form onSubmit={submit}>
          <div style={{ textAlign: "center", marginBottom: "18px" }}>
            <div style={{ fontSize: "11px", letterSpacing: "0.22em", color: "#087A5B", fontWeight: 800, textTransform: "uppercase" }}>
              FLUMENX OS
            </div>
          </div>

          <h2 style={{ fontSize: "28px", fontWeight: 800, color: "#18231F", letterSpacing: "-0.02em", marginBottom: "6px", textAlign: "center" }}>
            Welcome <span style={{ color: "#087A5B" }}>back.</span>
          </h2>
          <p className="form-subtitle" style={{ fontSize: "13.5px", color: "#64748B", marginBottom: "26px", textAlign: "center", fontWeight: 500, lineHeight: "1.4" }}>
            Sign in with your work account to access your workspace.
          </p>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 700, color: "#18231F", marginBottom: "18px" }}>
            Work email
            <div className="input-wrap" style={{ background: "#ffffff", border: "1.5px solid #CBD5E1", borderRadius: "10px", padding: "10px 14px", minHeight: "46px" }}>
              <Mail size={18} style={{ color: "#087A5B" }} />
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                type="email"
                placeholder="name@company.com"
                required
                style={{ fontSize: "13.5px", fontWeight: 600, color: "#18231F" }}
              />
            </div>
            {fieldErrors.username && <span className="form-field-error">{fieldErrors.username}</span>}
          </label>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.02em", color: "#18231F" }}>Password</span>
            <button
              type="button"
              onClick={() => {
                setForgotModalOpen(true);
                setForgotEmail(email);
                setForgotMessage("");
                setForgotError("");
              }}
              style={{ background: "none", border: "none", color: "#087A5B", fontSize: "12.5px", fontWeight: 800, cursor: "pointer", padding: 0 }}
            >
              Forgot password?
            </button>
          </div>
          <label style={{ marginBottom: "22px" }}>
            <div className="input-wrap" style={{ marginTop: 0, background: "#ffffff", border: "1.5px solid #CBD5E1", borderRadius: "10px", padding: "10px 14px", minHeight: "46px" }}>
              <LockKeyhole size={18} style={{ color: "#087A5B" }} />
              <input
                value={password}
                onChange={e => setPassword(e.target.value)}
                type={show ? "text" : "password"}
                required
                style={{ fontSize: "13.5px", fontWeight: 600, color: "#18231F" }}
              />
              <button
                type="button"
                onClick={() => setShow((prev) => !prev)}
                style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", display: "flex", alignItems: "center", padding: 0 }}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {fieldErrors.password && <span className="form-field-error">{fieldErrors.password}</span>}
          </label>

          {error && <div className="form-error" style={{ marginBottom: "16px", fontSize: "12.5px", fontWeight: 700 }}>{error}</div>}
          <button
            type="submit"
            className="login-button"
            disabled={loading}
            style={{
              background: "#087A5B",
              color: "#FFFFFF",
              border: "1px solid #066349",
              borderRadius: "10px",
              height: "48px",
              minHeight: "48px",
              width: "100%",
              fontSize: "14px",
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              boxShadow: "0 4px 14px rgba(8, 122, 91, 0.35)",
            }}
          >
            {loading ? "Signing in..." : "Login"} <ArrowRight size={18} />
          </button>
        </form>

        {/* FLUMENX LOGO (ONLY DISPLAYED ON MOBILE PHONES BELOW LOGIN FORM) */}
        <div className="mobile-login-logo">
          <FlumenxMark height={32} />
        </div>
      </div>

      {/* LOGIN FOOTER */}
      <footer style={{ marginTop: "20px", textAlign: "center", color: "#64748B", fontSize: "11.5px", fontWeight: 600, zIndex: 2 }}>
        <div style={{ display: "flex", justifyContent: "center", gap: "14px", flexWrap: "wrap", marginBottom: "6px" }}>
          <span style={{ color: "#475569" }}>Privacy Policy</span>
          <span>•</span>
          <span style={{ color: "#475569" }}>Terms of Service</span>
          <span>•</span>
          <span style={{ color: "#475569" }}>Help &amp; Support</span>
        </div>
        <div>© {new Date().getFullYear()} FLUMENX • Enterprise Employee Portal. All rights reserved.</div>
      </footer>

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
                    style={{
                      flex: 1.5,
                      margin: 0,
                      padding: "10px",
                      background: "#087A5B",
                      color: "#FFFFFF",
                      border: "1px solid #066349",
                      borderRadius: "10px",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: forgotLoading ? "not-allowed" : "pointer",
                      opacity: forgotLoading ? 0.7 : 1,
                    }}
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
