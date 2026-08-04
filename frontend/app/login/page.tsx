"use client";

import { FormEvent, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import gsap from "gsap";
import { FlumenxMark } from "@/components/icons";
import { api, ApiError } from "@/lib/api";
import { setCachedAuthUser } from "@/lib/auth-cache";
import type { AuthUser } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const page = useRef<HTMLDivElement>(null);
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


  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.timeline({ delay: 0.15 })
        .from(".login-form-side", { y: 28, opacity: 0, scale: 0.985, duration: 0.7, ease: "power3.out" })
        .from(".login-form-side form>*", { y: 10, opacity: 0, stagger: 0.04, duration: 0.3 }, "-=0.38");
    }, page);
    return () => ctx.revert();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setLoading(true);
    try {
      const data = await api<{ user: AuthUser }>("/auth/login/", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      setCachedAuthUser(data.user);
      const destinations: Record<string, string> = {
        ADMIN: "/admin/dashboard",
        HR: "/hr/dashboard",
        ACCOUNTANT: "/accountant/dashboard",
        BDE: "/bdo/dashboard",
        TEAM_LEAD: "/team-lead/dashboard",
        EMPLOYEE: "/employee/dashboard",
      };
      router.push(destinations[data.user.portal_role] || "/login");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to sign in.");
      if (error instanceof ApiError) setFieldErrors(error.fields);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="simple-login-page" ref={page}>
      <div className="login-visual">
        <div className="login-grid" />
        <div className="login-glow" />
        <div className="orbit-system">
          <div className="orbit-ring one"><i /></div>
          <div className="orbit-ring two"><i /></div>
          <div className="orbit-core">FX</div>
        </div>
        <div className="visual-brand"><FlumenxMark /><span>EMPLOYEE OS / 2026</span></div>
        <div className="visual-copy">
          <div className="eyebrow">THE WORKPLACE, IN MOTION</div>
          <h1>
            <span className="hero-line"><span>WORK</span></span>
            <span className="hero-line"><span>WITH <em>FLOW.</em></span></span>
            <span className="hero-line outline"><span>MOVE AS ONE.</span></span>
          </h1>
          <p>One intelligent space for people, attendance, payroll, communication, and momentum.</p>
        </div>
        <div className="login-reel">
          <div className="login-reel-track">
            <span>PEOPLE</span><i /><span>CLARITY</span><i /><span>MOMENTUM</span><i /><span>FLUMENX</span><i />
            <span>PEOPLE</span><i /><span>CLARITY</span><i /><span>MOMENTUM</span><i /><span>FLUMENX</span>
          </div>
        </div>
        <div className="visual-foot"><span>FLUMENX SYSTEMS (c) 2026</span><span>FLOW / PEOPLE / FORWARD</span></div>
      </div>
      <div className="login-form-side">
        <div className="form-rail">SECURE ACCESS / FLX-01</div>
        <div className="mobile-brand"><FlumenxMark /></div>
        <form onSubmit={submit}>
          <div className="form-index">ONE PORTAL / EVERY ROLE</div>
          <h2>Welcome <i>back.</i></h2>
          <p className="form-subtitle">Use your work account. We automatically open the correct workspace for your role.</p>
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
              style={{ background: "none", border: "none", color: "#4DFFA0", fontSize: "11px", fontWeight: 600, cursor: "pointer", padding: 0 }}
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
          <div className="demo-note"><span>SECURE ACCESS</span><p>Enter the email and password assigned to your employee account.</p></div>
        </form>
      </div>

      {forgotModalOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0, 0, 0, 0.75)", backdropFilter: "blur(4px)", padding: "16px" }}>
          <div style={{ width: "100%", maxWidth: "420px", background: "#0F1A15", border: "1px solid rgba(77, 255, 160, 0.2)", borderRadius: "16px", padding: "24px", color: "#F3F4F6", display: "flex", flexDirection: "column", gap: "16px", boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <b style={{ fontSize: "16px", letterSpacing: "0.5px" }}>RESET PASSWORD</b>
              <button type="button" onClick={() => setForgotModalOpen(false)} style={{ background: "none", border: "none", color: "#8EA89D", cursor: "pointer", fontSize: "18px" }}>✕</button>
            </div>
            <p style={{ fontSize: "12.5px", color: "#A7C1B5", lineHeight: 1.5 }}>
              Enter the work email address linked to your account. We will send you a secure link to reset your password.
            </p>
            {forgotMessage ? (
              <div style={{ padding: "12px 14px", background: "rgba(77, 255, 160, 0.1)", border: "1px solid rgba(77, 255, 160, 0.3)", borderRadius: "8px", color: "#4DFFA0", fontSize: "12px", lineHeight: 1.4 }}>
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
                    style={{ flex: 1, padding: "10px", borderRadius: "8px", background: "var(--panel2)", color: "#8EA89D", border: "1px solid var(--border)", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
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
